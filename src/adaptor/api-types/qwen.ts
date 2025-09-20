import type OpenAI from 'openai';
import { ChatCompletion } from '../chat-completion.ts';
import { Function } from '../function.ts';
import { OpenAIChatCompletionsStreamAPIBase } from './openai-chatcompletions-stream-base.ts';


export interface QwenChatCompletionChunkChoiceDelta extends OpenAI.ChatCompletionChunk.Choice.Delta {
	reasoning_content?: string;
}


export class QwenAPI<in out fd extends Function.Declaration = never> extends OpenAIChatCompletionsStreamAPIBase<fd> {
	public static create<fd extends Function.Declaration = never>(options: ChatCompletion.Options<fd>): ChatCompletion<fd> {
		const api = new QwenAPI(options);
		return api.stream.bind(api);
	}

	protected override getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
		return (delta as QwenChatCompletionChunkChoiceDelta).reasoning_content ?? '';
	}
}
