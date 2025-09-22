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

export class OpenRouterMonolithAPI<in out fd extends Function.Declaration = never> extends OpenAIChatCompletionsMonolithAPIBase<fd> {
	public static create<fd extends Function.Declaration = never>(options: Engine.Options<fd>): Engine<fd> {
		const api = new OpenRouterMonolithAPI(options);
		return api.monolith.bind(api);
	}

	protected override calcCost(usage: OpenAI.CompletionUsage): number {
		return (usage as OpenRouterUsage).cost * EXCHANGE_RATE_USD_CNY;
	}

	protected override makeMonolithParams(session: Session<fd>): OpenAI.ChatCompletionCreateParamsNonStreaming {
		const params: OpenRouterMonolithParams = {
			model: this.model,
			messages: [
				...(session.developerMessage ? this.convertFromRoleMessage(session.developerMessage) : []),
				...session.chatMessages.flatMap(chatMessage => this.convertFromRoleMessage(chatMessage)),
			],
			tools: this.functionDeclarations.length
				? this.functionDeclarations.map(f => this.convertFromFunctionDeclaration(f))
				: undefined,
			tool_choice: this.functionDeclarations.length && this.toolChoice ? this.convertFromFunctionCallMode(this.toolChoice) : undefined,
			stream: false,
			usage: {
				include: true,
			},
			...this.customOptions,
		};
		return params;
	}

	protected override convertToFunctionCall(apifc: OpenAI.ChatCompletionMessageFunctionToolCall): Function.Call.Union<fd> {
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

	public override async monolith(ctx: InferenceContext, session: Session<fd>, retry = 0): Promise<RoleMessage.AI<fd>> {
		try {
			return await super.monolith(ctx, session, retry);
		} catch (e) {
			if (e instanceof TypeError && e.message === 'terminated')
				return await this.monolith(ctx, session, retry+1);
			else throw e;
		}
	}
}
