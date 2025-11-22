import { RoleMessage, type Session } from '../session.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { TransientError } from './base.ts';
import { OpenAIChatCompletionsEngineBase } from './openai-chatcompletions-base.ts';
import { type InferenceContext } from '../inference-context.ts';
import { fetch } from 'undici';
import { type Engine } from '../engine.ts';


export abstract class OpenAIChatCompletionsMonolithEngineBase<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsEngineBase<fdm> {
	private apiURL: URL;

	public constructor(options: Engine.Options<fdm>) {
		super(options);
		this.apiURL = new URL(`${this.baseUrl}/chat/completions`);
	}

	protected convertToAIMessage(message: OpenAI.ChatCompletionMessage): RoleMessage.AI<Function.Declaration.From<fdm>> {
		const parts: RoleMessage.AI.Part<Function.Declaration.From<fdm>>[] = [];
		if (message.content)
			parts.push(RoleMessage.Part.Text.create(this.extractContent(message.content)));
		if (message.tool_calls)
			parts.push(...message.tool_calls.map(apifc => {
				assert(apifc.type === 'function');
				return this.convertToFunctionCall(apifc);
			}));
		return RoleMessage.AI.create(parts);
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
			max_completion_tokens: this.tokenLimit ? this.tokenLimit+1 : undefined,
			...this.customOptions,
		};
	}

	public async monolith(
		ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, retry = 0,
	): Promise<RoleMessage.AI<Function.Declaration.From<fdm>>> {
		const signalTimeout = this.timeout ? AbortSignal.timeout(this.timeout) : undefined;
		const signal = ctx.signal && signalTimeout ? AbortSignal.any([
			ctx.signal,
			signalTimeout,
		]) : ctx.signal || signalTimeout;
		const params = this.makeMonolithParams(session);
		ctx.logger.message?.trace(params);

		await this.throttle.requests(ctx);
		try {
			const res = await fetch(this.apiURL, {
				method: 'POST',
				headers: new Headers({
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.apiKey}`,
				}),
				body: JSON.stringify(params),
				dispatcher: this.proxyAgent,
				signal,
			}).catch(e => Promise.reject(new TransientError(undefined, { cause: e })));
			assert(res.ok, new Error(undefined, { cause: res }));
			const completion = await res.json() as OpenAI.ChatCompletion;
			ctx.logger.message?.trace(completion);
			assert(completion.choices[0], new TransientError('No choices', { cause: completion }));

			assert(
				completion.choices[0]!.finish_reason && ['stop', 'tool_calls'].includes(completion.choices[0]!.finish_reason),
				new TransientError('Invalid finish reason', { cause: completion.choices[0]!.finish_reason }),
			);
			assert(completion.usage);
			assert(
				completion.usage.completion_tokens <= (this.tokenLimit || Number.POSITIVE_INFINITY),
				new TransientError('Token limit exceeded.', { cause: completion }),
			);

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
			else if (signalTimeout?.aborted) {} // 推理超时
			else if (e instanceof TransientError) {}	// 模型抽风
			else throw e;
			ctx.logger.message?.warn(e);
			if (retry < 3) return await this.monolith(ctx, session, retry+1);
			else throw e;
		}
	}

}
