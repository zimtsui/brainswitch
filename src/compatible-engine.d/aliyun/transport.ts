import { Function } from '../../function.ts';
import { StreamTransport } from '../openai-chatcompletions/transport.d/stream.ts';
import OpenAI from 'openai';
import type { Verbatim } from '../../verbatim.ts';



export class Transport<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> extends StreamTransport<fdm, vdm> {
    protected override getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
        return (delta as Transport.ChatCompletionChunkChoiceDelta).reasoning_content ?? '';
    }

}

export namespace Transport {
    export interface ChatCompletionChunkChoiceDelta extends OpenAI.ChatCompletionChunk.Choice.Delta {
        reasoning_content?: string;
    }
}
