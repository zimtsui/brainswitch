import type OpenAI from 'openai';
import { type Engine } from '../engine.ts';
import { Function } from '../function.ts';
import { OpenAIChatCompletionsStreamEngineBase } from './openai-chatcompletions-stream-base.ts';
import { type InferenceContext } from '../inference-context.ts';
import { type Session, type RoleMessage } from '../session.ts';



export namespace AliyunStreamEngine {
	export interface ChatCompletionChunkChoiceDelta extends OpenAI.ChatCompletionChunk.Choice.Delta {
		reasoning_content?: string;
	}

	export function create<fdm extends Function.Declaration.Map = never>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		return new Constructor<fdm>(options);
	}

	export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsStreamEngineBase<fdm> {
		public override stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.AI<Function.Declaration.From<fdm>>> {
			return this.stream(ctx, session);
		}
		protected override getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
			return (delta as AliyunStreamEngine.ChatCompletionChunkChoiceDelta).reasoning_content ?? '';
		}
	}
}
