import { Engine } from '../engine.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import { RoleMessage, type Session } from '../session.ts';
import assert from 'node:assert';
import { type InferenceContext } from '../inference-context.ts';
import { OpenAIChatCompletionsStreamAPIBase } from './openai-chatcompletions-stream-base.ts';

const EXCHANGE_RATE_USD_CNY = 8;

export interface OpenRouterUsage extends OpenAI.CompletionUsage {
	cost: number;
}
export interface OpenRouterStreamParams extends OpenAI.ChatCompletionCreateParamsStreaming {
	usage?: {
		include: boolean;
	};
	reasoning?: {};
}
export interface OpenRouterChatCompletionChunkChoiceDelta extends OpenAI.ChatCompletionChunk.Choice.Delta {
	reasoning?: string;
}

export class OpenRouterStreamAPI<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsStreamAPIBase<fdm> {
	public static create<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		const api = new OpenRouterStreamAPI(options);
		return api.stream.bind(api);
	}

	protected override calcCost(usage: OpenAI.CompletionUsage): number {
		return (usage as OpenRouterUsage).cost * EXCHANGE_RATE_USD_CNY;
	}

	protected override getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
		return (delta as OpenRouterChatCompletionChunkChoiceDelta).reasoning ?? '';
	}

	protected override makeStreamParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsStreaming {
		const params: OpenRouterStreamParams = {
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
			stream: true,
			usage: {
				include: true,
			},
			...this.customOptions,
		};
		return params;
	}

	protected override convertToFunctionCallFromDelta(apifc: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
		assert(apifc.id, new Error(undefined, { cause: apifc }));
		assert(apifc.function?.name, new Error(undefined, { cause: apifc }));
		assert(typeof apifc.function?.arguments === 'string', new Error(undefined, { cause: apifc }));
		assert(apifc.type === 'function', new Error(undefined, { cause: apifc }));
		return this.convertToFunctionCall(apifc as OpenAI.ChatCompletionMessageFunctionToolCall);
	}

	protected override convertToFunctionCall(apifc: OpenAI.ChatCompletionMessageFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
		if (apifc.function.arguments)
			return super.convertToFunctionCall(apifc);
		else
			return super.convertToFunctionCall({
				...apifc,
				function: {
					...apifc.function,
					arguments: '{}',
				},
			});
	}

	public override async stream(
		ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, retry = 0,
	): Promise<RoleMessage.AI<Function.Declaration.From<fdm>>> {
		try {
			return await super.stream(ctx, session, retry);
		} catch (e) {
			if (e instanceof TypeError && e.message === 'terminated')
				return await this.stream(ctx, session, retry+1);
			else throw e;
		}
	}
}
