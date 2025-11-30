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
			max_completion_tokens: this.tokenLimit ?? undefined,
			...this.additionalOptions,
		};
	}

	protected convertToFunctionCallFromDelta(apifc: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
		assert(apifc.id);
		assert(apifc.function?.name);
		assert(apifc.function?.arguments);
		return this.convertToFunctionCall(apifc as OpenAI.ChatCompletionMessageFunctionToolCall);
	}

	protected abstract getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string | null;

	protected convertCompletionStockToCompletion(stock: OpenAI.ChatCompletionChunk): OpenAI.ChatCompletion {
		const stockChoice = stock?.choices[0];
		assert(stockChoice?.finish_reason);
		assert(stockChoice.delta.content !== undefined);
		assert(stockChoice.delta.refusal !== undefined);
		assert(stockChoice.logprobs);

		const completion: OpenAI.ChatCompletion = {
			id: stock.id,
			object: 'chat.completion',
			created: stock.created,
			model: stock.model,
			choices: [{
				index: 0,
				finish_reason: stockChoice.finish_reason,
				message: {
					role: 'assistant',
					content: stockChoice.delta.content,
					tool_calls: stockChoice.delta.tool_calls?.map(
						apifc => {
							assert(apifc.id !== undefined);
							assert(apifc.function?.name !== undefined);
							assert(apifc.function?.arguments !== undefined);
							return {
								id: apifc.id,
								function: {
									name: apifc.function.name,
									arguments: apifc.function.arguments,
								},
								type: 'function',
							};
						},
					),
					refusal: stockChoice.delta.refusal,
				},
				logprobs: stockChoice.logprobs,
			}]
		};
		return completion;
	}

	public async stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, retry = 0): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
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

			let stock: OpenAI.ChatCompletionChunk | null = null;
			let thoughts: string | null = null, thinking = false;

			for await (const chunk of stream) {
				stock ??= {
					id: chunk.id,
					created: chunk.created,
					model: chunk.model,
					choices: [],
					object: 'chat.completion.chunk',
				};

				// choice
				const deltaChoice = chunk.choices[0];
				if (deltaChoice) {
					if (!stock.choices.length)
						stock.choices.push({
							index: 0,
							finish_reason: null,
							delta: {},
						});

					// thoughts
					const deltaThoughts = this.getDeltaThoughts(deltaChoice.delta);
					if (deltaThoughts) {
						if (!thinking) {
							thinking = true;
							ctx.logger.inference?.trace('<think>\n');
						}
						ctx.logger.inference?.trace(deltaThoughts);
						thoughts ??= '';
						thoughts += deltaThoughts;
					}

					// content
					if (deltaChoice.delta.content) {
						if (thinking) {
							thinking = false;
							ctx.logger.inference?.trace('\n</think>\n');
						}
						ctx.logger.inference?.debug(deltaChoice.delta.content);
						stock.choices[0]!.delta.content ??= '';
						stock.choices[0]!.delta.content! += deltaChoice.delta.content;
					}

					// function calls
					if (deltaChoice.delta.tool_calls) {
						if (thinking) {
							thinking = false;
							ctx.logger.inference?.trace('\n</think>\n');
						}
						stock.choices[0]!.delta.tool_calls ??= [];
						for (const deltaToolCall of deltaChoice.delta.tool_calls) {
							const toolCalls = stock.choices[0]!.delta.tool_calls!;
							toolCalls[deltaToolCall.index] ??= { index: deltaToolCall.index };
							toolCalls[deltaToolCall.index]!.id ??= deltaToolCall.id;
							if (deltaToolCall.function) {
								toolCalls[deltaToolCall.index]!.function ??= {};
								toolCalls[deltaToolCall.index]!.function!.name ??= deltaToolCall.function.name;
								if (deltaToolCall.function.arguments) {
									toolCalls[deltaToolCall.index]!.function!.arguments ??= '';
									toolCalls[deltaToolCall.index]!.function!.arguments! += deltaToolCall.function?.arguments || '';
								}
							}
						}
					}

					// finish reason
					stock.choices[0]!.finish_reason ??= deltaChoice.finish_reason;
				}

				// usage
				stock.usage ??= chunk.usage;
			}

			assert(stock);
			const completion = this.convertCompletionStockToCompletion(stock);

			const choice = completion.choices[0];
			assert(choice, new TransientError('No choices', { cause: completion }));

			this.handleFinishReason(completion, choice.finish_reason);

			assert(completion.usage);
			const cost = this.calcCost(completion.usage);
			ctx.logger.cost?.(cost);

			const aiMessage = this.convertToAiMessage(choice.message);

			// logging
			if (choice.message.content) ctx.logger.inference?.debug('\n');
			const apifcs = choice.message.tool_calls;
			if (apifcs?.length) ctx.logger.message?.debug(apifcs);
			ctx.logger.message?.debug(completion.usage);

			this.validateFunctionCallByToolChoice(aiMessage.getFunctionCalls());

			return aiMessage;
		} catch (e) {
			if (ctx.signal?.aborted) throw e;
			else if (signalTimeout?.aborted) {} 		// 推理超时
			else if (e instanceof TransientError) {}	// 模型抽风
			else if (e instanceof TypeError) {}			// 网络故障
			else throw e;
			ctx.logger.message?.warn(e);
			if (retry < 3) return this.stateless(ctx, session, retry+1);
			else throw e;
		}
	}

}
