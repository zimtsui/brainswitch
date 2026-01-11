import type OpenAI from 'openai';
import { type CompatibleEngine } from '../compatible-engine.ts';
import { Function } from '../function.ts';
import { OpenAIChatCompletionsStreamEngineBase } from './openai-chatcompletions-stream-base.ts';



export namespace AliyunEngine {
    export interface ChatCompletionChunkChoiceDelta extends OpenAI.ChatCompletionChunk.Choice.Delta {
        reasoning_content?: string;
    }

    export function create<fdm extends Function.Declaration.Map = never>(options: CompatibleEngine.Options<fdm>): CompatibleEngine<Function.Declaration.From<fdm>> {
        return new Constructor<fdm>(options);
    }

    export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsStreamEngineBase<fdm> {
        protected getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
            return (delta as AliyunEngine.ChatCompletionChunkChoiceDelta).reasoning_content ?? '';
        }
    }
}
