import type OpenAI from 'openai';
import { Engine } from '../engine.ts';
import { Function } from '../function.ts';
import { OpenAIChatCompletionsStreamAPIBase } from './openai-chatcompletions-stream-base.ts';


export interface QwenChatCompletionChunkChoiceDelta extends OpenAI.ChatCompletionChunk.Choice.Delta {
	reasoning_content?: string;
}


export class QwenAPI<in out fd extends Function.Declaration = never> extends OpenAIChatCompletionsStreamAPIBase<fd> {
	public static create<fd extends Function.Declaration = never>(options: Engine.Options<fd>): Engine<fd> {
		const api = new QwenAPI(options);
		return api.stream.bind(api);
	}

	protected override getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
		return (delta as QwenChatCompletionChunkChoiceDelta).reasoning_content ?? '';
	}
}
