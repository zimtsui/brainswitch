import type OpenAI from 'openai';
import { type Engine } from '../engine.ts';
import { Function } from '../function.ts';
import { OpenAIChatCompletionsMonolithEngineBase } from './openai-chatcompletions-monolith-base.ts';
import { type InferenceContext } from '../inference-context.ts';
import { type Session, RoleMessage } from '../session.ts';



export namespace MinimaxEngine {
	export interface ChatCompletionMessage extends OpenAI.ChatCompletionMessage {
		reasoning_details?: unknown;
	}
	export interface ChatCompletionAssistantMessageParam extends OpenAI.ChatCompletionAssistantMessageParam {
		reasoning_details?: unknown;
	}

	export function create<fdm extends Function.Declaration.Map = never>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		return new Constructor<fdm>(options);
	}

	export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsMonolithEngineBase<fdm> {
		public override stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
			return this.monolith(ctx, session);
		}

		protected override convertToAiMessage(message: MinimaxEngine.ChatCompletionMessage): RoleMessage.Ai<Function.Declaration.From<fdm>> {
			return MinimaxAiMessage.create(super.convertToAiMessage(message).parts, message);
		}

		protected override convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionAssistantMessageParam {
			return aiMessage instanceof MinimaxAiMessage.Constructor ? aiMessage.raw : super.convertFromAiMessage(aiMessage);
		}
	}
}

export type MinimaxAiMessage<fdu extends Function.Declaration> = MinimaxAiMessage.Constructor<fdu>;
export namespace MinimaxAiMessage {
	export function create<fdu extends Function.Declaration>(parts: RoleMessage.Ai.Part<fdu>[], raw: MinimaxEngine.ChatCompletionMessage): MinimaxAiMessage<fdu> {
		return new Constructor(parts, raw);
	}
	export const NOMINAL = Symbol();
	export class Constructor<out fdu extends Function.Declaration> extends RoleMessage.Ai.Constructor<fdu> {
		public declare readonly [NOMINAL]: void;
		public constructor(
			parts: RoleMessage.Ai.Part<fdu>[],
			public raw: MinimaxEngine.ChatCompletionMessage,
		) {
			super(parts);
		}
	}
	export interface Snapshot<in out fdu extends Function.Declaration = never> {
		parts: RoleMessage.Ai.Part.Snapshot<fdu>[];
		raw: MinimaxEngine.ChatCompletionMessage;
	}
	export function restore<fdu extends Function.Declaration>(snapshot: Snapshot<fdu>): MinimaxAiMessage<fdu> {
		return new Constructor(RoleMessage.Ai.restore<fdu>(snapshot.parts).parts, snapshot.raw);
	}
	export function capture<fdu extends Function.Declaration>(message: MinimaxAiMessage<fdu>): Snapshot<fdu> {
		return {
			parts: RoleMessage.Ai.capture(message),
			raw: message.raw,
		};
	}
}
