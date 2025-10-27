import type OpenAI from 'openai';
import { Engine } from '../engine.ts';
import { Function } from '../function.ts';
import { OpenAIChatCompletionsStreamAPIBase } from './openai-chatcompletions-stream-base.ts';


export interface QwenChatCompletionChunkChoiceDelta extends OpenAI.ChatCompletionChunk.Choice.Delta {
	reasoning_content?: string;
}


export namespace QwenAPI {
	export function makeEngine<fdm extends Function.Declaration.Map = never>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		const api = new Constructor(options);
		return api.stream.bind(api);
	}
	export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsStreamAPIBase<fdm> {
		protected override getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
			return (delta as QwenChatCompletionChunkChoiceDelta).reasoning_content ?? '';
		}
	}
}
