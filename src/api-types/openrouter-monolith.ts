import { Engine } from '../engine.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import { type Session } from '../session.ts';
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

export namespace OpenRouterMonolithAPI {
	export function makeEngine<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		const api = new Constructor(options);
		return api.monolith.bind(api);
	}

	export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsMonolithAPIBase<fdm> {
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
		/*
			OpenRouter 官方 bug：可能出现错误，疑似由返回的 JSON 不规范导致。
			SyntaxError: Unexpected end of JSON input
				at JSON.parse (<anonymous>)
				at parseJSONFromBytes (node:internal/deps/undici/undici:5738:19)
				at successSteps (node:internal/deps/undici/undici:5719:27)
				at fullyReadBody (node:internal/deps/undici/undici:4609:9)
				at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
				at async consumeBody (node:internal/deps/undici/undici:5728:7)
		*/
	}
}
