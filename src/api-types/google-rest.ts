import { type Engine } from '../engine.ts';
import { type Session } from '../session.ts';
import { Function } from '../function.ts';
import * as Google from '@google/genai';
import assert from 'node:assert';
import { GoogleAiMessage, GoogleEngineBase } from './google-base.ts';
import { fetch } from 'undici';
import { type InferenceContext } from '../inference-context.ts';
import { TransientError } from './base.ts';


export namespace GoogleRestfulEngine {
	export interface Request {
		contents: Google.Content[];
		tools?: Google.Tool[];
		toolConfig?: Google.ToolConfig;
		systemInstruction?: Google.Content;
		generationConfig?: Google.GenerationConfig;
	}

	export function create<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		return new Constructor(options);
	}

	export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends GoogleEngineBase<fdm> {
		protected apiURL: URL;

		public constructor(options: Engine.Options<fdm>) {
			super(options);

			this.apiURL = new URL(`${this.baseUrl}/v1beta/models/${this.model}:generateContent`);
		}

		public stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<GoogleAiMessage<Function.Declaration.From<fdm>>> {
			return this.monolith(ctx, session);
		}

		public async monolith(
			ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, retry = 0,
		): Promise<GoogleAiMessage<Function.Declaration.From<fdm>>> {
			const signalTimeout = this.timeout ? AbortSignal.timeout(this.timeout) : undefined;
			const signal = ctx.signal && signalTimeout ? AbortSignal.any([
				ctx.signal,
				signalTimeout,
			]) : ctx.signal || signalTimeout;

			try {
				const systemInstruction = session.developerMessage && this.convertFromDeveloperMessage(session.developerMessage);
				const contents = this.convertFromChatMessages(session.chatMessages);

				await this.throttle.requests(ctx);

				const reqbody: GoogleRestfulEngine.Request = {
					contents,
					tools: Object.keys(this.fdm).length ? [{
						functionDeclarations: Object.entries(this.fdm).map(
							fdentry => this.convertFromFunctionDeclarationEntry(fdentry as Function.Declaration.Entry.From<fdm>),
						),
					}] : undefined,
					toolConfig: Object.keys(this.fdm).length && this.toolChoice ? {
						functionCallingConfig: this.convertFromFunctionCallMode(this.toolChoice),
					} : undefined,
					systemInstruction,
					generationConfig: this.tokenLimit || this.additionalOptions ? {
						maxOutputTokens: this.tokenLimit ? this.tokenLimit+1 : undefined,
						...this.additionalOptions,
					} : undefined,
				};

				ctx.logger.message?.trace(reqbody);

				const res = await fetch(this.apiURL, {
					method: 'POST',
					headers: new Headers({
						'Content-Type': 'application/json',
						'x-goog-api-key': this.apiKey,
					}),
					body: JSON.stringify(reqbody),
					dispatcher: this.proxyAgent,
					signal,
				}).catch(e => Promise.reject(new TransientError(undefined, { cause: e })));
				ctx.logger.message?.trace(res);
				assert(res.ok, new Error(undefined, { cause: res }));
				const response = await res.json() as Google.GenerateContentResponse;

				assert(response.candidates?.[0]?.content?.parts?.length, new TransientError('No content parts', { cause: response }));
				assert(response.candidates[0].finishReason === Google.FinishReason.STOP, new TransientError('Abnormal finish reason', { cause: response }));


				for (const part of response.candidates[0].content.parts) {
					if (part.text) ctx.logger.inference?.debug(part.text+'\n');
					if (part.functionCall) ctx.logger.message?.debug(part.functionCall);
				}
				assert(response.usageMetadata?.promptTokenCount, new Error('Prompt token count absent', { cause: response }));
				ctx.logger.message?.debug(response.usageMetadata);

				const candidatesTokenCount = response.usageMetadata.candidatesTokenCount ?? 0;
				const cacheHitTokenCount = response.usageMetadata.cachedContentTokenCount ?? 0;
				const cacheMissTokenCount = response.usageMetadata.promptTokenCount - cacheHitTokenCount;
				const thinkingTokenCount = response.usageMetadata.thoughtsTokenCount ?? 0;
				const cost =
					this.inputPrice * cacheMissTokenCount / 1e6 +
					this.cachedPrice * cacheHitTokenCount / 1e6 +
					this.outputPrice * candidatesTokenCount / 1e6 +
					this.outputPrice * thinkingTokenCount / 1e6;
				ctx.logger.cost?.(cost);

				const aiMessage = this.convertToAiMessage(response.candidates[0].content);
				this.validateFunctionCallByToolChoice(aiMessage);
				return aiMessage;

			} catch (e) {
				if (ctx.signal?.aborted) throw e;
				else if (signalTimeout?.aborted) {}			// 推理超时
				else if (e instanceof TransientError) {}	// 模型抽风
				else if (e instanceof TypeError) {}			// 网络故障
				else throw e;
				ctx.logger.message?.warn(e);
				if (retry < 3) return this.monolith(ctx, session, retry+1);
				else throw e;
			}
		}
	}
}
