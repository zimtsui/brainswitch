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

export class GoogleRESTfulAPI<in out fd extends Function.Declaration = never> extends GoogleAPIBase<fd> {
	private proxyAgent?: ProxyAgent;
	private apiURL: URL;
	private tokenizerURL: URL;

	protected constructor(options: Engine.Options<fd>) {
		super(options);
		this.proxyAgent = options.proxy ? new ProxyAgent(options.proxy) : undefined;
		this.apiURL = new URL(`${this.baseUrl}/v1beta/models/${this.model}:generateContent`);
		this.tokenizerURL = new URL(`${this.baseUrl}/v1beta/models/${this.model}:countTokens`);
	}

	public static create<fd extends Function.Declaration = never>(options: Engine.Options<fd>): Engine<fd> {
		const api = new GoogleRESTfulAPI(options);
		return api.monolith.bind(api);
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
		});
		assert(res.ok, new Error(undefined, { cause: res }));
		const response = await res.json() as Google.CountTokensResponse;
		assert(response.totalTokens, new Error(undefined, { cause: response }));
		return response.totalTokens;
	}

	private async monolith(ctx: InferenceContext, session: Session<fd>, retry = 0): Promise<GoogleAIMessage<fd>> {
		try {
			const systemInstruction = session.developerMessage && this.convertFromDeveloperMessage(session.developerMessage);
			const contents = this.convertFromChatMessages(session.chatMessages);

			await this.throttle.requests(ctx);
			await this.throttle.inputTokens(await this.tokenize(contents, ctx), ctx);

			const reqbody: GoogleRESTfulRequest = {
				contents,
				tools: this.functionDeclarations.length ? [{
					functionDeclarations: this.functionDeclarations.map(f => this.convertFromFunctionDeclaration(f)),
				}] : undefined,
				toolConfig: this.functionDeclarations.length && this.toolChoice ? {
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
			});
			ctx.logger.message?.trace(res);
			assert(res.ok, new Error(undefined, { cause: res }));
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
			if (e instanceof TransientError) {}	// 模型抽风
			else throw e;
			ctx.logger.message?.warn(e);
			if (retry < 3) return this.monolith(ctx, session, retry+1);
			else throw e;
		}
	}
}
