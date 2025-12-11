import { type Engine } from '../engine.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import { type Session } from '../session.ts';
import { OpenAIChatCompletionsMonolithEngineBase } from './openai-chatcompletions-monolith-base.ts';
import assert from 'node:assert';

const EXCHANGE_RATE_USD_CNY = 8;

export interface OpenRouterUsage extends OpenAI.CompletionUsage {
	cost: number;
}
export interface OpenRouterMonolithParams extends OpenAI.ChatCompletionCreateParamsNonStreaming {
	usage?: {
		include: boolean;
	};
	reasoning?: {};
}
export interface OpenRouterChatCompletionChoice extends OpenAI.ChatCompletion.Choice {
	reasoning?: string;
}

export namespace OpenRouterMonolithEngine {
	export function create<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		return new Constructor<fdm>(options);
	}

	export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsMonolithEngineBase<fdm> {
		public constructor(options: Engine.Options<fdm>) {
			super(options);
			assert(
				options.inputPrice === undefined,
				new Error('OpenRouter does not support `inputPrice` option')
			);
            assert(
				options.outputPrice === undefined,
				new Error('OpenRouter does not support `outputPrice` option')
			);
            assert(
				options.cachePrice === undefined,
				new Error('OpenRouter does not support `cachePrice` option')
			);
		}

		protected override calcCost(usage: OpenRouterUsage): number {
			return usage.cost * EXCHANGE_RATE_USD_CNY;
		}

		protected override makeParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsNonStreaming {
			const params: OpenRouterMonolithParams = {
				...super.makeParams(session),
				usage: {
					include: true,
				},
				...this.additionalOptions,
			};
			return params;
		}

		protected override convertToFunctionCall(apifc: OpenAI.ChatCompletionMessageFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
			return apifc.function.arguments
				? super.convertToFunctionCall(apifc)
				: super.convertToFunctionCall({
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
