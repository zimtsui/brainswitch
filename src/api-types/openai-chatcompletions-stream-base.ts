import { RoleMessage, type Session } from '../session.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { OpenAIChatCompletionsEngineBase } from './openai-chatcompletions-base.ts';
import { type InferenceContext } from '../inference-context.ts';
import { TransientError } from './base.ts';
import { type Engine } from '../engine.ts';


export abstract class OpenAIChatCompletionsStreamEngineBase<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsEngineBase<fdm> {
	private client: OpenAI;

	public constructor(options: Engine.Options<fdm>) {
		super(options);
		this.client = new OpenAI({
			baseURL: this.baseUrl,
			apiKey: this.apiKey,
			fetchOptions: {
				dispatcher: this.proxyAgent,
			},
		});
	}

	protected makeParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsStreaming {
		const fdentries = Object.entries(this.fdm);
		const tools = fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry as Function.Declaration.Entry.From<fdm>));
		return {
			model: this.model,
			messages: [
				...(session.developerMessage ? this.convertFromRoleMessage(session.developerMessage) : []),
				...session.chatMessages.flatMap(chatMessage => this.convertFromRoleMessage(chatMessage)),
			],
			tools: tools.length ? tools : undefined,
			tool_choice: fdentries.length ? this.convertFromToolChoice(this.toolChoice) : undefined,
			parallel_tool_calls: tools.length ? this.parallel : undefined,
			stream: true,
			stream_options: {
				include_usage: true
			},
			max_completion_tokens: this.tokenLimit ? this.tokenLimit+1 : undefined,
			...this.additionalOptions,
		};
	}

	protected convertToFunctionCallFromDelta(apifc: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
		assert(apifc.id);
		assert(apifc.function?.name);
		assert(apifc.function?.arguments);
		return this.convertToFunctionCall(apifc as OpenAI.ChatCompletionMessageFunctionToolCall);
	}

	protected abstract getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string;

	public async stream(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, retry = 0): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
		const signalTimeout = this.timeout ? AbortSignal.timeout(this.timeout) : undefined;
		const signal = ctx.signal && signalTimeout ? AbortSignal.any([
			ctx.signal,
			signalTimeout,
		]) : ctx.signal || signalTimeout;

		try {
			const params = this.makeParams(session);
			ctx.logger.message?.trace(params);

			await this.throttle.requests(ctx);

			const stream = await this.client.chat.completions.create(params, { signal })
				.catch(e => Promise.reject(new TransientError(undefined, { cause: e })));

			let chunk: OpenAI.ChatCompletionChunk | null = null;
			let usage: OpenAI.CompletionUsage = { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 };
			let finishReason: OpenAI.ChatCompletionChunk.Choice['finish_reason'] = null;

			const toolCalls: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall[] = [];
			let thoughts = '', content = '', cost = 0, thinking = true;
			ctx.logger.inference?.trace('<think>\n');

			for await (chunk of stream) {
				const deltaThoughts = chunk.choices[0] ? this.getDeltaThoughts(chunk.choices[0].delta) : '';
				thoughts += deltaThoughts;

				const deltaContent = chunk.choices[0]?.delta.content ?? '';
				content += deltaContent;

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

				finishReason = chunk.choices[0]?.finish_reason ?? finishReason;
				ctx.logger.inference?.trace(deltaThoughts);
				if (thinking && (deltaContent || deltaToolCalls.length)) {
					thinking = false;
					ctx.logger.inference?.trace('\n</think>\n');
				}
				ctx.logger.inference?.debug(deltaContent);

				usage = newUsage;
			}
			assert(
				finishReason && ['stop', 'tool_calls'].includes(finishReason),
				new TransientError('Invalid finish reason', { cause: finishReason }),
			);
			ctx.logger.inference?.debug('\n');
			assert(usage);
			assert(
				usage.completion_tokens <= (this.tokenLimit || Number.POSITIVE_INFINITY),
				new TransientError('Token limit exceeded.', { cause: content }),
			);
			if (toolCalls.length) ctx.logger.message?.debug(toolCalls);
			ctx.logger.message?.debug(usage);
			ctx.logger.cost?.(cost);

			const fcs = toolCalls.map(apifc => this.convertToFunctionCallFromDelta(apifc));
			this.validateFunctionCallByToolChoice(fcs);

			const text = this.extractContent(content);
			return RoleMessage.Ai.create(
				text
					? [RoleMessage.Part.Text.create(text), ...fcs]
					: fcs,
			);
		} catch (e) {
			if (ctx.signal?.aborted) throw e;
			else if (signalTimeout?.aborted) {} 		// 推理超时
			else if (e instanceof TransientError) {}	// 模型抽风
			else if (e instanceof TypeError) {}			// 网络故障
			else throw e;
			ctx.logger.message?.warn(e);
			if (retry < 3) return this.stream(ctx, session, retry+1);
			else throw e;
		}
	}

}
