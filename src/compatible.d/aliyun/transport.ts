import { Function } from '#@/function.ts';
import { OpenAIChatCompletionsCompatibleStream } from '#@/compatible.d/openai-chatcompletions.d/stream.ts';
import OpenAI from 'openai';
import type { Verbatim } from '#@/verbatim.ts';



export class AliyunTransport<
    in out fdm extends Function.Declaration.Map.Prototype,
    in out vdm extends Verbatim.Declaration.Map.Prototype,
> extends
    OpenAIChatCompletionsCompatibleStream<fdm, vdm>
{
    protected override getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
        return (delta as AliyunTransport.ChatCompletionChunkChoiceDelta).reasoning_content ?? '';
    }

}

export namespace AliyunTransport {
    export interface ChatCompletionChunkChoiceDelta extends OpenAI.ChatCompletionChunk.Choice.Delta {
        reasoning_content?: string;
    }
}
