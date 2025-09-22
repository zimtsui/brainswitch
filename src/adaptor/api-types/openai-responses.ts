import { APIBase } from './base.ts';
import { Function } from '../function.ts';
import { RoleMessage, type ChatMessage, type Session } from '../session.ts';
import { Engine } from '../engine.ts';
import { type InferenceContext } from '../inference-context.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { TransientError, RetryLimitError } from './base.ts';
import { ProxyAgent } from 'undici';
import Ajv from 'ajv';

const ajv = new Ajv();


export class OpenAIResponsesAPI<in out fd extends Function.Declaration = never> extends APIBase<fd> {
	protected client: OpenAI;
	protected proxyAgent?: ProxyAgent;

	public static create<fd extends Function.Declaration = never>(options: Engine.Options<fd>): Engine<fd> {
		const api = new OpenAIResponsesAPI<fd>(options);
		return api.monolith.bind(api);
	}

	public constructor(options: Engine.Options<fd>) {
		super(options);
		this.proxyAgent = options.proxy ? new ProxyAgent(options.proxy) : undefined;
		this.client = new OpenAI({
			baseURL: this.baseUrl,
			apiKey: this.apiKey,
			fetchOptions: {
				dispatcher: this.proxyAgent,
			},
		});
	}

	protected convertFromFunctionCall(fc: Function.Call.Union<fd>): OpenAI.Responses.ResponseFunctionToolCall {
		assert(fc.id);
		return {
			type: 'function_call',
			call_id: fc.id,
			name: fc.name,
			arguments: JSON.stringify(fc.args),
		};
	}
	protected convertToFunctionCall(apifc: OpenAI.Responses.ResponseFunctionToolCall): Function.Call.Union<fd> {
		const fd = this.functionDeclarations.find(fd => fd.name === apifc.name);
		assert(fd, new TransientError('Invalid function call', { cause: apifc }));
		const args = (() => {
			try {
				return JSON.parse(apifc.arguments);
			} catch (e) {
				return new TransientError('Invalid function call', { cause: apifc });
			}
		})();
		assert(
			ajv.validate(fd.paraschema, args),
			new TransientError('Invalid function call', { cause: apifc }),
		);
		return new Function.Call<Function.Declaration>({
			id: apifc.call_id,
			name: apifc.name,
			args,
		}) as Function.Call.Union<fd>;
	}

	protected convertFromFunctionResponse(fr: Function.Response.Union<fd>): OpenAI.Responses.ResponseInputItem.FunctionCallOutput {
		assert(fr.id);
		return {
			type: 'function_call_output',
			call_id: fr.id,
			output: fr.text,
		};
	}

	protected convertFromUserMessage(userMessage: RoleMessage.User<fd>): OpenAI.Responses.ResponseInput {
		return userMessage.parts.map(part => {
			if (part instanceof RoleMessage.Text)
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

	protected convertFromAIMessage(aiMessage: RoleMessage.AI<fd>): OpenAI.Responses.ResponseInput {
		if (aiMessage instanceof OpenAIResponsesAIMessage)
			return aiMessage.raw;
		else {
			return aiMessage.parts.map(part => {
				if (part instanceof RoleMessage.Text)
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

	protected convertFromChatMessage(chatMessage: ChatMessage<fd>): OpenAI.Responses.ResponseInput {
		if (chatMessage instanceof RoleMessage.User)
			return this.convertFromUserMessage(chatMessage);
		else if (chatMessage instanceof RoleMessage.AI)
			return this.convertFromAIMessage(chatMessage);
		else throw new Error();
	}

	protected convertFromFunctionDeclaration(fd: fd): OpenAI.Responses.FunctionTool {
		return {
			name: fd.name,
			description: fd.description,
			parameters: fd.paraschema,
			strict: true,
			type: 'function',
		};
	}

	protected makeMonolithParams(session: Session<fd>): OpenAI.Responses.ResponseCreateParamsNonStreaming {
		return {
			model: this.model,
			include: ['reasoning.encrypted_content'],
			store: false,
			input: session.chatMessages.flatMap(chatMessage => this.convertFromChatMessage(chatMessage)),
			instructions: session.developerMessage?.getOnlyText(),
			tools: this.functionDeclarations.length
				? this.functionDeclarations.map(fd => this.convertFromFunctionDeclaration(fd))
				: undefined,
			tool_choice: this.functionDeclarations.length ? 'required' : undefined,
			parallel_tool_calls: this.functionDeclarations.length ? false : undefined,
			...this.customOptions,
		};
	}


	protected convertToAIMessage(output: OpenAI.Responses.ResponseOutputItem[]): OpenAIResponsesAIMessage<fd> {
		const parts = output.flatMap((item): RoleMessage.AI.Part<fd>[] => {
			if (item.type === 'message') {
				assert(item.content.every(part => part.type === 'output_text'));
				return [new RoleMessage.Text(item.content.map(part => part.text).join(''))];
			} else if (item.type === 'function_call')
				return [this.convertToFunctionCall(item)];
			else if (item.type === 'reasoning')
				return [];
			else throw new Error();
		});
		return new OpenAIResponsesAIMessage(parts, output);
	}


	protected validateFunctionCallByToolChoice(functionCalls: Function.Call.Union<fd>[]): void {
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

	protected tokenize(params: OpenAI.Responses.ResponseCreateParams): number {
		return JSON.stringify(params).length;
	}

	protected async monolith(ctx: InferenceContext, session: Session<fd>, retry = 0): Promise<RoleMessage.AI<fd>> {
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
			const response: OpenAI.Responses.Response = await this.client.responses.create(params, { signal });
			ctx.logger.message?.trace(response);
			const aiMessage = this.convertToAIMessage(response.output);


			const text = aiMessage.getText();
			if (text) ctx.logger.inference?.debug(text + '\n');
			const apifcs = response.output.filter(item => item.type === 'function_call');
			for (const apifc of apifcs) ctx.logger.message?.debug(apifc);
			assert(response.usage);
			const cost = this.calcCost(response.usage);
			ctx.logger.cost?.(cost);
			ctx.logger.message?.debug(response.usage);

			this.throttle.outputTokens(response.usage.output_tokens);

			const functionCalls = aiMessage.getFunctionCalls();
			this.validateFunctionCallByToolChoice(functionCalls);

			return aiMessage;
		} catch (e) {
			if (ctx.signal?.aborted) throw new DOMException(undefined, 'AbortError');
			if (e instanceof TransientError) {}	// 模型抽风
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

export class OpenAIResponsesAIMessage<out fd extends Function.Declaration> extends RoleMessage.AI<fd> {
	public constructor(
		parts: RoleMessage.AI.Part<fd>[],
		public raw: OpenAI.Responses.ResponseOutputItem[],
	) {
		super(parts);
	}
}
