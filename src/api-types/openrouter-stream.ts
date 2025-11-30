import { type Engine } from '../engine.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import { type Session, type RoleMessage } from '../session.ts';
import assert from 'node:assert';
import { OpenAIChatCompletionsStreamEngineBase } from './openai-chatcompletions-stream-base.ts';
import { type InferenceContext } from '../inference-context.ts';

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


export namespace OpenRouterStreamEngine {
	export function create<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		return new Constructor<fdm>(options);
	}

	export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsStreamEngineBase<fdm> {
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

		public override stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
			return this.stream(ctx, session);
		}

		protected override calcCost(usage: OpenRouterUsage): number {
			return usage.cost * EXCHANGE_RATE_USD_CNY;
		}

		protected override getDeltaThoughts(delta: OpenRouterChatCompletionChunkChoiceDelta): string {
			return delta.reasoning ?? '';
		}

		protected override makeParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsStreaming {
			const params: OpenRouterStreamParams = {
				...super.makeParams(session),
				usage: {
					include: true,
				},
				...this.additionalOptions,
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
	}
}
