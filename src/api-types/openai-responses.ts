import { EngineBase } from './base.ts';
import { Function } from '../function.ts';
import { RoleMessage, type ChatMessage, type Session } from '../session.ts';
import { type Engine } from '../engine.ts';
import { type InferenceContext } from '../inference-context.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { TransientError } from './base.ts';
import { fetch } from 'undici';
import Ajv from 'ajv';

const ajv = new Ajv();


export namespace OpenAIResponsesEngine {
	export function create<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		return new Constructor<fdm>(options);
	}

	export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends EngineBase<fdm> {
		private apiURL: URL;

		public constructor(options: Engine.Options<fdm>) {
			super(options);
			this.apiURL = new URL(`${this.baseUrl}/responses`);
		}

		public override stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.AI<Function.Declaration.From<fdm>>> {
			return this.monolith(ctx, session);
		}

		protected convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseFunctionToolCall {
			assert(fc.id);
			return {
				type: 'function_call',
				call_id: fc.id,
				name: fc.name,
				arguments: JSON.stringify(fc.args),
			};
		}
		protected convertToFunctionCall(apifc: OpenAI.Responses.ResponseFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
			const fditem = this.functionDeclarationMap[apifc.name] as Function.Declaration.Item.From<fdm> | undefined;
			assert(fditem, new TransientError('Invalid function call', { cause: apifc }));
			const args = (() => {
				try {
					return JSON.parse(apifc.arguments);
				} catch (e) {
					return new TransientError('Invalid function call', { cause: apifc });
				}
			})();
			assert(
				ajv.validate(fditem.paraschema, args),
				new TransientError('Invalid function call', { cause: apifc }),
			);
			return Function.Call.create({
				id: apifc.call_id,
				name: apifc.name,
				args,
			} as Function.Call.create.Options<Function.Declaration.From<fdm>>);
		}

		protected convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInputItem.FunctionCallOutput {
			assert(fr.id);
			return {
				type: 'function_call_output',
				call_id: fr.id,
				output: fr.text,
			};
		}

		protected convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
			return userMessage.parts.map(part => {
				if (part instanceof RoleMessage.Part.Text.Constructor)
					return {
						type: 'message',
						role: 'user',
						content: part.text,
					} satisfies OpenAI.Responses.EasyInputMessage;
				else if (part instanceof Function.Response)
					return this.convertFromFunctionResponse(part);
				else throw new Error();
			});
		}

		protected convertFromAIMessage(aiMessage: RoleMessage.AI<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
			if (aiMessage instanceof OpenAIResponsesAIMessage.Constructor)
				return aiMessage.raw;
			else {
				return aiMessage.parts.map(part => {
					if (part instanceof RoleMessage.Part.Text.Constructor)
						return {
							role: 'assistant',
							content: part.text,
						} satisfies OpenAI.Responses.EasyInputMessage;
					else if (part instanceof Function.Call)
						return this.convertFromFunctionCall(part);
					else throw new Error();
				});
			}
		}

		protected convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
			if (chatMessage instanceof RoleMessage.User.Constructor)
				return this.convertFromUserMessage(chatMessage);
			else if (chatMessage instanceof RoleMessage.AI.Constructor)
				return this.convertFromAIMessage(chatMessage);
			else throw new Error();
		}

		protected convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.Responses.FunctionTool {
			return {
				name: fdentry[0],
				description: fdentry[1].description,
				parameters: fdentry[1].paraschema,
				strict: true,
				type: 'function',
			};
		}

		protected makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseCreateParamsNonStreaming {
			return {
				model: this.model,
				include: ['reasoning.encrypted_content'],
				store: false,
				input: session.chatMessages.flatMap(chatMessage => this.convertFromChatMessage(chatMessage)),
				instructions: session.developerMessage?.getOnlyText(),
				tools: Object.keys(this.functionDeclarationMap).length
					? Object.entries(this.functionDeclarationMap).map(
						fdentry => this.convertFromFunctionDeclarationEntry(fdentry as Function.Declaration.Entry.From<fdm>),
					) : undefined,
				tool_choice: Object.keys(this.functionDeclarationMap).length ? 'required' : undefined,
				parallel_tool_calls: Object.keys(this.functionDeclarationMap).length ? false : undefined,
				max_output_tokens: this.tokenLimit ? this.tokenLimit+1 : undefined,
				...this.customOptions,
			};
		}


		protected convertToAIMessage(output: OpenAI.Responses.ResponseOutputItem[]): OpenAIResponsesAIMessage<Function.Declaration.From<fdm>> {
			const parts = output.flatMap((item): RoleMessage.AI.Part<Function.Declaration.From<fdm>>[] => {
				if (item.type === 'message') {
					assert(item.content.every(part => part.type === 'output_text'));
					return [RoleMessage.Part.Text.create(item.content.map(part => part.text).join(''))];
				} else if (item.type === 'function_call')
					return [this.convertToFunctionCall(item)];
				else if (item.type === 'reasoning')
					return [];
				else throw new Error();
			});
			return OpenAIResponsesAIMessage.create(parts, output);
		}


		protected validateFunctionCallByToolChoice(functionCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void {
			// https://community.openai.com/t/function-call-with-finish-reason-of-stop/437226/7
			if (this.toolChoice === Function.ToolChoice.REQUIRED)
				assert(functionCalls.length, new TransientError());
			else if (this.toolChoice instanceof Array)
				for (const fc of functionCalls) assert(this.toolChoice.includes(fc.name), new TransientError());
			else if (this.toolChoice === Function.ToolChoice.NONE)
				assert(!functionCalls.length, new TransientError());
		}

		protected calcCost(usage: OpenAI.Responses.ResponseUsage): number {
			const cacheHitTokenCount = usage.input_tokens_details.cached_tokens;
			const cacheMissTokenCount = usage.input_tokens - cacheHitTokenCount;
			return	this.inputPrice * cacheMissTokenCount / 1e6 +
					this.cachedPrice * cacheHitTokenCount / 1e6 +
					this.outputPrice * usage.output_tokens / 1e6;
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
				const response = await res.json() as OpenAI.Responses.Response;
				ctx.logger.message?.trace(response);
				const aiMessage = this.convertToAIMessage(response.output);


				const text = aiMessage.getText();
				if (text) ctx.logger.inference?.debug(text + '\n');
				const apifcs = response.output.filter(item => item.type === 'function_call');
				for (const apifc of apifcs) ctx.logger.message?.debug(apifc);
				assert(response.usage);
				assert(
					response.usage.output_tokens <= (this.tokenLimit || Number.POSITIVE_INFINITY),
					new TransientError('Token limit exceeded.', { cause: response }),
				);
				const cost = this.calcCost(response.usage);
				ctx.logger.cost?.(cost);
				ctx.logger.message?.debug(response.usage);

				const functionCalls = aiMessage.getFunctionCalls();
				this.validateFunctionCallByToolChoice(functionCalls);

				return aiMessage;
			} catch (e) {
				if (ctx.signal?.aborted) throw new DOMException(undefined, 'AbortError');
				else if (signalTimeout?.aborted) {}	// 推理超时
				else if (e instanceof TransientError) {}	// 模型抽风
				else throw e;
				ctx.logger.message?.warn(e);
				if (retry < 3) return await this.monolith(ctx, session, retry+1);
				else throw e;
			}
		}

	}
}


export type OpenAIResponsesAIMessage<fdu extends Function.Declaration> = OpenAIResponsesAIMessage.Constructor<fdu>;
export namespace OpenAIResponsesAIMessage {
	export function create<fdu extends Function.Declaration>(parts: RoleMessage.AI.Part<fdu>[], raw: OpenAI.Responses.ResponseOutputItem[]): OpenAIResponsesAIMessage<fdu> {
		return new Constructor(parts, raw);
	}
	export const NOMINAL = Symbol();
	export class Constructor<out fdu extends Function.Declaration> extends RoleMessage.AI.Constructor<fdu> {
		public declare readonly [NOMINAL]: void;
		public constructor(
			parts: RoleMessage.AI.Part<fdu>[],
			public raw: OpenAI.Responses.ResponseOutputItem[],
		) {
			super(parts);
		}
	}
	export interface Snapshot<in out fdu extends Function.Declaration = never> {
		parts: RoleMessage.AI.Part.Snapshot<fdu>[];
		raw: OpenAI.Responses.ResponseOutputItem[];
	}
	export function restore<fdu extends Function.Declaration>(snapshot: Snapshot<fdu>): OpenAIResponsesAIMessage<fdu> {
		return new Constructor(RoleMessage.AI.restore<fdu>(snapshot.parts).parts, snapshot.raw);
	}
	export function capture<fdu extends Function.Declaration>(message: OpenAIResponsesAIMessage<fdu>): Snapshot<fdu> {
		return {
			parts: RoleMessage.AI.capture(message),
			raw: message.raw,
		};
	}
}
