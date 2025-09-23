import { RoleMessage, type Session } from '../session.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { TransientError, RetryLimitError } from './base.ts';
import { InvalidFinishReason } from './openai-chatcompletions-base.ts';
import { OpenAIChatCompletionsAPIBase } from './openai-chatcompletions-base.ts';
import { type InferenceContext } from '../inference-context.ts';


export abstract class OpenAIChatCompletionsMonolithAPIBase<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsAPIBase<fdm> {

	protected convertToAIMessage(message: OpenAI.ChatCompletionMessage): RoleMessage.AI<Function.Declaration.From<fdm>> {
		const parts: RoleMessage.AI.Part<Function.Declaration.From<fdm>>[] = [];
		if (message.content)
			parts.push(new RoleMessage.Text(this.extractContent(message.content)));
		if (message.tool_calls)
			parts.push(...message.tool_calls.map(apifc => {
				assert(apifc.type === 'function');
				return this.convertToFunctionCall(apifc);
			}));
		return new RoleMessage.AI(parts);
	}

	protected makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsNonStreaming {
		return {
			model: this.model,
			messages: [
				...(session.developerMessage ? this.convertFromRoleMessage(session.developerMessage) : []),
				...session.chatMessages.flatMap(chatMessage => this.convertFromRoleMessage(chatMessage)),
			],
			tools: Object.keys(this.functionDeclarationMap).length
				? Object.entries(this.functionDeclarationMap).map(
					fdentry => this.convertFromFunctionDeclarationEntry(fdentry as Function.Declaration.Entry.From<fdm>),
				)
				: undefined,
			tool_choice: Object.keys(this.functionDeclarationMap).length && this.toolChoice ? this.convertFromFunctionCallMode(this.toolChoice) : undefined,
			parallel_tool_calls: Object.keys(this.functionDeclarationMap).length ? false : undefined,
			...this.customOptions,
		};
	}

	protected async monolith(
		ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, retry = 0,
	): Promise<RoleMessage.AI<Function.Declaration.From<fdm>>> {
		if (retry > 2) throw new RetryLimitError();
		const signalTimeout = this.timeout ? AbortSignal.timeout(this.timeout) : undefined;
		const signal = ctx.signal && signalTimeout ? AbortSignal.any([
			ctx.signal,
			signalTimeout,
		]) : ctx.signal || signalTimeout;
		const params = this.makeMonolithParams(session);
		ctx.logger.message?.trace(params);

		await this.throttle.requests(ctx);
		await this.throttle.inputTokens(this.tokenize(params), ctx);
		try {
			const completion: OpenAI.ChatCompletion = await this.client.chat.completions.create(params, { signal });
			ctx.logger.message?.trace(completion);
			assert(completion.choices[0], new TransientError('No choices', { cause: completion }));

			assert(
				completion.choices[0]!.finish_reason && ['stop', 'tool_calls'].includes(completion.choices[0]!.finish_reason),
				new InvalidFinishReason(completion.choices[0]!.finish_reason),
			);
			assert(completion.usage);
			this.throttle.outputTokens(completion.usage.completion_tokens);

			const cost = this.calcCost(completion.usage);
			ctx.logger.cost?.(cost);

			const aiMessage = this.convertToAIMessage(completion.choices[0]!.message);

			const text = aiMessage.getText();
			if (text) ctx.logger.inference?.debug(text + '\n');
			const apifcs = completion.choices[0]!.message.tool_calls || [];
			if (apifcs.length) ctx.logger.message?.debug(apifcs);
			ctx.logger.message?.debug(completion.usage);

			this.validateFunctionCallByToolChoice(aiMessage.getFunctionCalls());

			return aiMessage;
		} catch (e) {
			if (ctx.signal?.aborted) throw new DOMException(undefined, 'AbortError');
			if (e instanceof TransientError) {}	// 模型抽风
			else if (e instanceof InvalidFinishReason) {}	// 服务器中道崩殂
			else if (e instanceof OpenAI.APIUserAbortError) {}	// 推理超时
			else if (e instanceof OpenAI.BadRequestError) {
				ctx.logger.message?.warn(params);
			} else throw e;
			ctx.logger.message?.warn(e);
			return await this.monolith(ctx, session, retry+1)
				.catch(nexte => Promise.reject(nexte instanceof RetryLimitError ? e : nexte));
		}
	}

}
