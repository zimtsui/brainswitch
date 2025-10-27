import { Engine } from '../engine.ts';
import { type Session } from '../session.ts';
import { Function } from '../function.ts';
import * as Google from '@google/genai';
import assert from 'node:assert';
import { GoogleAIMessage, GoogleAPIBase } from './google-base.ts';
import { ProxyAgent, fetch } from 'undici';
import { type InferenceContext } from '../inference-context.ts';
import { TransientError } from './base.ts';


export interface GoogleRESTfulRequest {
	contents: Google.Content[];
	tools?: Google.Tool[];
	toolConfig?: Google.ToolConfig;
	systemInstruction?: Google.Content;
	generationConfig?: Google.GenerationConfig;
}


export namespace GoogleRESTfulAPI {
	export function makeEngine<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		const api = new Constructor(options);
		return api.monolith.bind(api);
	}

	export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends GoogleAPIBase<fdm> {
		private proxyAgent?: ProxyAgent;
		private apiURL: URL;
		private tokenizerURL: URL;

		public constructor(options: Engine.Options<fdm>) {
			super(options);
			this.proxyAgent = options.proxy ? new ProxyAgent(options.proxy) : undefined;
			this.apiURL = new URL(`${this.baseUrl}/v1beta/models/${this.model}:generateContent`);
			this.tokenizerURL = new URL(`${this.baseUrl}/v1beta/models/${this.model}:countTokens`);
		}


		private async tokenize(contents: Google.ContentListUnion, ctx: InferenceContext): Promise<number> {
			const reqbody = { contents };
			const res = await fetch(this.tokenizerURL, {
				method: 'POST',
				headers: new Headers({
					'Content-Type': 'application/json',
					'x-goog-api-key': this.apiKey,
				}),
				body: JSON.stringify(reqbody),
				dispatcher: this.proxyAgent,
				signal: ctx.signal,
			}).catch(e => Promise.reject(new TransientError(undefined, { cause: e })));
			assert(res.ok, new Error(undefined, { cause: res }));
			const response = await res.json() as Google.CountTokensResponse;
			assert(response.totalTokens, new Error(undefined, { cause: response }));
			return response.totalTokens;
		}

		public async monolith(
			ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, retry = 0,
		): Promise<GoogleAIMessage<Function.Declaration.From<fdm>>> {
			try {
				const systemInstruction = session.developerMessage && this.convertFromDeveloperMessage(session.developerMessage);
				const contents = this.convertFromChatMessages(session.chatMessages);

				await this.throttle.requests(ctx);
				await this.throttle.inputTokens(await this.tokenize(contents, ctx), ctx);

				const reqbody: GoogleRESTfulRequest = {
					contents,
					tools: Object.keys(this.functionDeclarationMap).length ? [{
						functionDeclarations: Object.entries(this.functionDeclarationMap).map(
							fdentry => this.convertFromFunctionDeclarationEntry(fdentry as Function.Declaration.Entry.From<fdm>),
						),
					}] : undefined,
					toolConfig: Object.keys(this.functionDeclarationMap).length && this.toolChoice ? {
						functionCallingConfig: this.convertFromFunctionCallMode(this.toolChoice),
					} : undefined,
					systemInstruction,
					generationConfig: this.customOptions ?? undefined,
				};

				ctx.logger.message?.trace(reqbody);

				const signal = this.timeout && ctx.signal ? AbortSignal.any([
					ctx.signal,
					AbortSignal.timeout(this.timeout),
				]) : this.timeout ? AbortSignal.timeout(this.timeout) : ctx.signal;
				const res = await fetch(this.apiURL, {
					method: 'POST',
					headers: new Headers({
						'Content-Type': 'application/json',
						'x-goog-api-key': this.apiKey,
					}),
					body: JSON.stringify(reqbody),
					dispatcher: this.proxyAgent,
					signal,
				}).catch(e => {
					if (e instanceof TypeError)
						throw new TransientError('Connection error', { cause: e });
					else throw e;
				});;
				ctx.logger.message?.trace(res);
				assert(res.ok, new TransientError(undefined, { cause: res }));
				const response = await res.json() as Google.GenerateContentResponse;

				assert(response.candidates?.[0]?.content?.parts, new TransientError('No content parts', { cause: response }));
				assert(response.candidates[0].finishReason === Google.FinishReason.STOP, new TransientError('Abnormal finish reason', { cause: response }));


				const text = response.candidates[0].content.parts.filter(part => part.text).map(part => part.text).join('');
				if (text) ctx.logger.inference?.debug(text+'\n');
				const apiFunctionCalls = response.candidates[0].content.parts.filter(part => part.functionCall);
				if (apiFunctionCalls.length) ctx.logger.message?.debug(apiFunctionCalls);
				ctx.logger.message?.debug(response.usageMetadata);


				assert(response.usageMetadata?.promptTokenCount, new Error('Prompt token count absent', { cause: response }));
				const candidatesTokenCount = response.usageMetadata.candidatesTokenCount ?? 0;
				const cacheHitTokenCount = response.usageMetadata.cachedContentTokenCount ?? 0;
				const cacheMissTokenCount = response.usageMetadata.promptTokenCount - cacheHitTokenCount;
				const thinkingTokenCount = response.usageMetadata.thoughtsTokenCount ?? 0;
				this.throttle.outputTokens(candidatesTokenCount);
				this.throttle.outputTokens(thinkingTokenCount);
				const cost =
					this.inputPrice * cacheMissTokenCount / 1e6 +
					this.cachedPrice * cacheHitTokenCount / 1e6 +
					this.outputPrice * candidatesTokenCount / 1e6 +
					this.outputPrice * thinkingTokenCount / 1e6;
				ctx.logger.cost?.(cost);


				const aiMessage = this.convertToAIMessage(response.candidates[0].content);
				this.validateFunctionCallByToolChoice(aiMessage);

				return aiMessage;

			} catch (e) {
				if (ctx.signal?.aborted) throw new DOMException(undefined, 'AbortError');
				else if (e instanceof TransientError) {}	// 模型抽风
				else throw e;
				ctx.logger.message?.warn(e);
				if (retry < 3) return this.monolith(ctx, session, retry+1);
				else throw e;
			}
		}
	}
}
