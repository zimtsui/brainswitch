import { Engine } from '../engine.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import type { RoleMessage, Session } from '../session.ts';
import type { InferenceContext } from '../inference-context.ts';
import { OpenAIChatCompletionsMonolithAPIBase } from './openai-chatcompletions-monolith-base.ts';

const EXCHANGE_RATE_USD_CNY = 8;

export interface OpenRouterUsage extends OpenAI.CompletionUsage {
	cost: number;
}
export interface OpenRouterMonolithParams extends OpenAI.ChatCompletionCreateParamsNonStreaming {
	usage?: {
		include: boolean;
	};
}

export class OpenRouterMonolithAPI<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsMonolithAPIBase<fdm> {
	public static create<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		const api = new OpenRouterMonolithAPI(options);
		return api.monolith.bind(api);
	}

	protected override calcCost(usage: OpenAI.CompletionUsage): number {
		return (usage as OpenRouterUsage).cost * EXCHANGE_RATE_USD_CNY;
	}

	protected override makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsNonStreaming {
		const params: OpenRouterMonolithParams = {
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
			stream: false,
			usage: {
				include: true,
			},
			...this.customOptions,
		};
		return params;
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

	public override async monolith(
		ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, retry = 0,
	): Promise<RoleMessage.AI<Function.Declaration.From<fdm>>> {
		try {
			return await super.monolith(ctx, session, retry);
		} catch (e) {
			if (e instanceof TypeError && e.message === 'terminated')
				return await this.monolith(ctx, session, retry+1);
			else throw e;
		}
	}
}
