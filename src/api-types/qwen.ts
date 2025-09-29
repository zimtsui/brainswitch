import type OpenAI from 'openai';
import { Engine } from '../engine.ts';
import { Function } from '../function.ts';
import { OpenAIChatCompletionsStreamAPIBase } from './openai-chatcompletions-stream-base.ts';


export interface QwenChatCompletionChunkChoiceDelta extends OpenAI.ChatCompletionChunk.Choice.Delta {
	reasoning_content?: string;
}


export class QwenAPI<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsStreamAPIBase<fdm> {
	public static create<fdm extends Function.Declaration.Map = never>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		const api = new QwenAPI(options);
		return api.stream.bind(api);
	}

	protected override getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
		return (delta as QwenChatCompletionChunkChoiceDelta).reasoning_content ?? '';
	}
}
