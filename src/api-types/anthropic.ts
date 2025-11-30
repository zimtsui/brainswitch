import { EngineBase } from './base.ts';
import { Function } from '../function.ts';
import { RoleMessage, type ChatMessage, type Session } from '../session.ts';
import { type Engine } from '../engine.ts';
import { type InferenceContext } from '../inference-context.ts';
import Anthropic from '@anthropic-ai/sdk';
import assert from 'node:assert';
import { TransientError } from './base.ts';
import Ajv from 'ajv';
import { type TObject } from '@sinclair/typebox';

const ajv = new Ajv();


export namespace AnthropicEngine {
	export function create<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		return new Constructor<fdm>(options);
	}

	export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends EngineBase<fdm> {
		protected anthropic = new Anthropic({
			baseURL: this.baseUrl,
			apiKey: this.apiKey,
			fetchOptions: { dispatcher: this.proxyAgent },
		});

		protected parallel: boolean;

		public constructor(options: Engine.Options<fdm>) {
			super(options);
			this.parallel = options.parallelFunctionCall ?? false;
		}

		protected convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Anthropic.ToolUseBlock {
			assert(fc.id);
			return {
				type: 'tool_use',
				id: fc.id,
				name: fc.name,
				input: fc.args,
			};
		}
		protected convertToFunctionCall(apifc: Anthropic.ToolUseBlock): Function.Call.Distributive<Function.Declaration.From<fdm>> {
			const fditem = this.fdm[apifc.name] as Function.Declaration.Item.From<fdm> | undefined;
			assert(fditem, new TransientError('Invalid function call', { cause: apifc }));
			assert(
				ajv.validate(fditem.paraschema, apifc.input),
				new TransientError('Invalid function call', { cause: apifc }),
			);
			return Function.Call.create({
				id: apifc.id,
				name: apifc.name,
				args: apifc.input,
			} as Function.Call.create.Options<Function.Declaration.From<fdm>>);
		}

		protected convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): Anthropic.ToolResultBlockParam {
			assert(fr.id);
			return {
				type: 'tool_result',
				tool_use_id: fr.id,
				content: fr.text,
			};
		}

		protected convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Anthropic.ContentBlockParam[] {
			return userMessage.parts.map(part => {
				if (part instanceof RoleMessage.Part.Text.Constructor)
					return {
						type: 'text',
						text: part.text,
					} satisfies Anthropic.TextBlockParam;
				else if (part instanceof Function.Response)
					return this.convertFromFunctionResponse(part);
				else throw new Error();
			});
		}

		protected convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Anthropic.ContentBlockParam[] {
			if (aiMessage instanceof AnthropicAiMessage.Constructor)
				return aiMessage.raw;
			else {
				return aiMessage.parts.map(part => {
					if (part instanceof RoleMessage.Part.Text.Constructor)
						return {
							type: 'text',
							text: part.text,
						} satisfies Anthropic.TextBlockParam;
					else if (part instanceof Function.Call)
						return this.convertFromFunctionCall(part);
					else throw new Error();
				});
			}
		}

		protected convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): Anthropic.MessageParam {
			if (chatMessage instanceof RoleMessage.User.Constructor)
				return { role: 'user', content: this.convertFromUserMessage(chatMessage) };
			else if (chatMessage instanceof RoleMessage.Ai.Constructor)
				return { role: 'assistant', content: this.convertFromAiMessage(chatMessage) };
			else throw new Error();
		}

		protected convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Anthropic.Tool {
			return {
				name: fdentry[0],
				description: fdentry[1].description,
				input_schema: fdentry[1].paraschema as TObject,
			};
		}

		protected convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>, parallel: boolean): Anthropic.ToolChoice {
			if (toolChoice === Function.ToolChoice.NONE) return { type: 'none' };
			else if (toolChoice === Function.ToolChoice.REQUIRED) return { type: 'any', disable_parallel_tool_use: !parallel };
			else if (toolChoice === Function.ToolChoice.AUTO) return { type: 'auto', disable_parallel_tool_use: !parallel };
			else {
				assert(toolChoice.length === 1);
				return { type: 'tool', name: toolChoice[0]!, disable_parallel_tool_use: !parallel };
			}
		}

		protected makeParams(session: Session<Function.Declaration.From<fdm>>): Anthropic.MessageCreateParamsStreaming {
			return {
				model: this.model,
				stream: true,
				messages: session.chatMessages.map(chatMessage => this.convertFromChatMessage(chatMessage)),
				system: session.developerMessage?.parts.map(part => ({ type: 'text', text: part.text})),
				tools: Object.keys(this.fdm).length
					? Object.entries(this.fdm).map(
						fdentry => this.convertFromFunctionDeclarationEntry(fdentry as Function.Declaration.Entry.From<fdm>),
					) : undefined,
				max_tokens: this.tokenLimit ? this.tokenLimit+1 : 32768,
				...this.additionalOptions,
			};
		}


		protected logApiAiMessage(ctx: InferenceContext, raw: Anthropic.ContentBlock[]): void {
			for (const item of raw)
				if (item.type === 'text') ctx.logger.inference?.debug(item.text);
				else if (item.type === 'tool_use') ctx.logger.message?.debug(item);
		}

		protected convertToAiMessage(raw: Anthropic.ContentBlock[]): AnthropicAiMessage<Function.Declaration.From<fdm>> {
			const parts = raw.flatMap((item): RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] => {
				if (item.type === 'text') {
					return [RoleMessage.Part.Text.create(item.text)];
				} else if (item.type === 'tool_use')
					return [this.convertToFunctionCall(item)];
				else if (item.type === 'thinking')
					return [];
				else throw new Error();
			});
			return AnthropicAiMessage.create(parts, raw);
		}


		protected validateFunctionCallByToolChoice(functionCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void {
			if (this.toolChoice === Function.ToolChoice.REQUIRED)
				assert(functionCalls.length, new TransientError());
			else if (this.toolChoice instanceof Array)
				for (const fc of functionCalls) assert(this.toolChoice.includes(fc.name), new TransientError());
			else if (this.toolChoice === Function.ToolChoice.NONE)
				assert(!functionCalls.length, new TransientError());
		}

		protected calcCost(usage: Anthropic.Usage): number {
			const cacheHitTokenCount = usage.cache_read_input_tokens || 0;
			const cacheMissTokenCount = usage.input_tokens - cacheHitTokenCount;
			return	this.inputPrice * cacheMissTokenCount / 1e6 +
					this.cachedPrice * cacheHitTokenCount / 1e6 +
					this.outputPrice * usage.output_tokens / 1e6;
		}

		public async stateless(
			ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, retry = 0,
		): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
			const signalTimeout = this.timeout ? AbortSignal.timeout(this.timeout) : undefined;
			const signal = ctx.signal && signalTimeout ? AbortSignal.any([
				ctx.signal,
				signalTimeout,
			]) : ctx.signal || signalTimeout;
			try {

				const params = this.makeParams(session);
				ctx.logger.message?.trace(params);

				await this.throttle.requests(ctx);
				const stream = this.anthropic.messages.stream(params, { signal });

				let response: Anthropic.Message | null = null;
				for await (const event of stream) {
					if (event.type === 'message_start') {
						ctx.logger.message?.trace(event);
						response = event.message;
					} else {
						assert(response);
						if (event.type === 'message_delta') {
							ctx.logger.message?.trace(event);
							response.stop_sequence = event.delta.stop_sequence ?? response.stop_sequence;
							response.stop_reason = event.delta.stop_reason ?? response.stop_reason;
						} else if (event.type === 'message_stop') {
							ctx.logger.message?.trace(event);
						} else if (event.type === 'content_block_start') {
							ctx.logger.message?.trace(event);
							const contentBlock = event.content_block;
							response.content.push(contentBlock);
							if (contentBlock.type === 'tool_use') contentBlock.input = '';
						} else if (event.type === 'content_block_delta') {
							const contentBlock = response.content[event.index];
							if (event.delta.type === 'text_delta'){
								ctx.logger.inference?.debug(event.delta.text);
								assert(contentBlock?.type === 'text', new Error('Mismatched content block type', { cause: contentBlock }));
								contentBlock.text += event.delta.text;
							} else if (event.delta.type === 'thinking_delta') {
								ctx.logger.inference?.debug(event.delta.thinking);
								assert(contentBlock?.type === 'thinking', new Error('Mismatched content block type', { cause: contentBlock }));
								contentBlock.thinking += event.delta.thinking;
							} else if (event.delta.type === 'signature_delta') {
								assert(contentBlock?.type === 'thinking', new Error('Mismatched content block type', { cause: contentBlock }));
								contentBlock.signature += event.delta.signature;
							} else if (event.delta.type === 'input_json_delta') {
								ctx.logger.inference?.debug(event.delta.partial_json);
								assert(contentBlock?.type === 'tool_use', new Error('Mismatched content block type', { cause: contentBlock }));
								assert(typeof contentBlock.input === 'string', new Error('Incomplete tool use input is not string', { cause: contentBlock }));
								contentBlock.input += event.delta.partial_json;
							} else throw new Error('Unknown type of content block delta', { cause: event.delta });
						} else if (event.type === 'content_block_stop') {
							const contentBlock = response.content[event.index];
							if (contentBlock?.type === 'text') ctx.logger.inference?.debug('\n');
							else if (contentBlock?.type === 'thinking') ctx.logger.inference?.trace('\n');
							else if (contentBlock?.type === 'tool_use') ctx.logger.inference?.debug('\n');
							ctx.logger.message?.trace(event);
							if (contentBlock?.type === 'tool_use') {
								assert(typeof contentBlock.input === 'string', new Error('Incomplete tool use input is not string', { cause: contentBlock }));
								contentBlock.input = JSON.parse(contentBlock.input);
							}
						} else throw new Error('Unknown stream event', { cause: event });
					}
				}
				assert(response);
				ctx.logger.message?.trace(response);
				assert(
					response.stop_reason === 'end_turn' || response.stop_reason === 'tool_use',
					new TransientError('Abnormal stop reason', { cause: response }),
				);

				this.logApiAiMessage(ctx, response.content);
				assert(
					response.usage.output_tokens <= (this.tokenLimit || Number.POSITIVE_INFINITY),
					new TransientError('Token limit exceeded.', { cause: response }),
				);
				const cost = this.calcCost(response.usage);
				ctx.logger.cost?.(cost);
				ctx.logger.message?.debug(response.usage);

				const aiMessage = this.convertToAiMessage(response.content);
				this.validateFunctionCallByToolChoice(aiMessage.getFunctionCalls());

				return aiMessage;
			} catch (e) {
				if (ctx.signal?.aborted) throw e;
				else if (signalTimeout?.aborted) {}			// 推理超时
				else if (e instanceof TransientError) {}	// 模型抽风
				else if (e instanceof TypeError) {}			// 网络故障
				else throw e;
				ctx.logger.message?.warn(e);
				if (retry < 3) return await this.stateless(ctx, session, retry+1);
				else throw e;
			}
		}

	}
}


export type AnthropicAiMessage<fdu extends Function.Declaration> = AnthropicAiMessage.Constructor<fdu>;
export namespace AnthropicAiMessage {
	export function create<fdu extends Function.Declaration>(parts: RoleMessage.Ai.Part<fdu>[], raw: Anthropic.ContentBlock[]): AnthropicAiMessage<fdu> {
		return new Constructor(parts, raw);
	}
	export const NOMINAL = Symbol();
	export class Constructor<out fdu extends Function.Declaration> extends RoleMessage.Ai.Constructor<fdu> {
		public declare readonly [NOMINAL]: void;
		public constructor(
			parts: RoleMessage.Ai.Part<fdu>[],
			public raw: Anthropic.ContentBlock[],
		) {
			super(parts);
		}
	}
	export interface Snapshot<in out fdu extends Function.Declaration = never> {
		parts: RoleMessage.Ai.Part.Snapshot<fdu>[];
		raw: Anthropic.ContentBlock[];
	}
	export function restore<fdu extends Function.Declaration>(snapshot: Snapshot<fdu>): AnthropicAiMessage<fdu> {
		return new Constructor(RoleMessage.Ai.restore<fdu>(snapshot.parts).parts, snapshot.raw);
	}
	export function capture<fdu extends Function.Declaration>(message: AnthropicAiMessage<fdu>): Snapshot<fdu> {
		return {
			parts: RoleMessage.Ai.capture(message),
			raw: message.raw,
		};
	}
}
