import { RoleMessage, type Session } from '../session.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { OpenAIChatCompletionsAPIBase } from './openai-chatcompletions-base.ts';
import { type InferenceContext } from '../inference-context.ts';
import { TransientError } from './base.ts';



export abstract class OpenAIChatCompletionsStreamAPIBase<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsAPIBase<fdm> {

	protected makeStreamParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsStreaming {
		return {
			model: this.model,
			messages: [
				...(session.developerMessage ? this.convertFromRoleMessage(session.developerMessage) : []),
				...session.chatMessages.flatMap(chatMessage => this.convertFromRoleMessage(chatMessage)),
			],
			tools: Object.keys(this.functionDeclarationMap).length
				? Object.entries(this.functionDeclarationMap).map(
					fdentry => this.convertFromFunctionDeclarationEntry(fdentry as Function.Declaration.Entry.From<fdm>),
				) : undefined,
			tool_choice: Object.keys(this.functionDeclarationMap).length && this.toolChoice ? this.convertFromFunctionCallMode(this.toolChoice) : undefined,
			stream: true,
			stream_options: {
				include_usage: true
			},
			...this.customOptions,
		};
	}

	protected convertToFunctionCallFromDelta(apifc: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
		assert(apifc.id);
		assert(apifc.function?.name);
		assert(apifc.function?.arguments);
		return this.convertToFunctionCall(apifc as OpenAI.ChatCompletionMessageFunctionToolCall);
	}

	protected abstract getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string;

	protected async stream(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, retry = 0): Promise<RoleMessage.AI<Function.Declaration.From<fdm>>> {
		const signalTimeout = this.timeout ? AbortSignal.timeout(this.timeout) : undefined;
		const signal = ctx.signal && signalTimeout ? AbortSignal.any([
			ctx.signal,
			signalTimeout,
		]) : ctx.signal || signalTimeout;
		const params = this.makeStreamParams(session);
		ctx.logger.message?.trace(params);

		await this.throttle.requests(ctx);
		await this.throttle.inputTokens(this.tokenize(params), ctx);

		try {
			const stream = await this.client.chat.completions.create(params, { signal })
				.catch(e => Promise.reject(new TransientError(undefined, { cause: e })));

			let chunk: OpenAI.ChatCompletionChunk | null = null;
			let usage: OpenAI.CompletionUsage = { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 };
			let finishReason: OpenAI.ChatCompletionChunk.Choice['finish_reason'] = null;

			const toolCalls: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall[] = [];
			let thoughts = '', text = '', cost = 0, thinking = true;
			ctx.logger.inference?.trace('<think>\n');

			for await (chunk of stream) {
				const deltaThoughts = chunk.choices[0] ? this.getDeltaThoughts(chunk.choices[0].delta) : '';
				thoughts += deltaThoughts;

				const deltaText = chunk.choices[0]?.delta.content ?? '';
				text += deltaText;

				const deltaToolCalls = chunk.choices[0]?.delta.tool_calls ?? [];
				for (const deltaToolCall of deltaToolCalls) {
					toolCalls[deltaToolCall.index] ||= { index: deltaToolCall.index };
					toolCalls[deltaToolCall.index]!.id ||= deltaToolCall.id;
					toolCalls[deltaToolCall.index]!.function ||= {};
					toolCalls[deltaToolCall.index]!.function!.name ||= deltaToolCall.function?.name;
					toolCalls[deltaToolCall.index]!.function!.arguments ||= '';
					toolCalls[deltaToolCall.index]!.function!.arguments! += deltaToolCall.function?.arguments || '';
				}

				if (chunk.usage) cost = this.calcCost(chunk.usage);
				const newUsage = chunk.usage || usage;
				this.throttle.outputTokens(newUsage.completion_tokens - usage.completion_tokens);

				finishReason = chunk.choices[0]?.finish_reason ?? finishReason;
				ctx.logger.inference?.trace(deltaThoughts);
				if (thinking && (deltaText || deltaToolCalls.length)) {
					thinking = false;
					ctx.logger.inference?.trace('\n</think>\n');
				}
				ctx.logger.inference?.debug(deltaText);

				usage = newUsage;
			}
			assert(
				finishReason && ['stop', 'tool_calls'].includes(finishReason),
				new TransientError('Invalid finish reason', { cause: finishReason }),
			);
			ctx.logger.inference?.debug('\n');
			assert(usage);
			if (toolCalls.length) ctx.logger.message?.debug(toolCalls);
			ctx.logger.message?.debug(usage);
			ctx.logger.cost?.(cost);

			const fcs = toolCalls.map(apifc => this.convertToFunctionCallFromDelta(apifc));
			this.validateFunctionCallByToolChoice(fcs);

			return new RoleMessage.AI([
				new RoleMessage.Text(this.extractContent(text)),
				...fcs,
			]);
		} catch (e) {
			if (ctx.signal?.aborted) throw new DOMException(undefined, 'AbortError');
			else if (signalTimeout?.aborted) {} // 推理超时
			else if (e instanceof TransientError) {}	// 模型抽风
			else throw e;
			ctx.logger.message?.warn(e);
			if (retry < 3) return this.stream(ctx, session, retry+1);
			else throw e;
		}
	}

}
