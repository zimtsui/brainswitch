import { Function } from '../function.ts';
import { CompatibleEngine } from '../compatible-engine.ts';
import * as MessageCodecModule from './openai-chatcompletions/message-codec.ts';
import * as TransportModule from './openai-chatcompletions/transport.ts';
import type { Verbatim } from '../verbatim.ts';
import * as ChoiceCodecModule from './openai-chatcompletions/choice-codec.ts';



export type OpenAIChatCompletionsCompatibleEngine<
    fdm extends Function.Decl.Map.Proto,
    vdm extends Verbatim.Decl.Map.Proto,
> = OpenAIChatCompletionsCompatibleEngine.Instance<fdm, vdm>;
export namespace OpenAIChatCompletionsCompatibleEngine {
    export abstract class Instance<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends CompatibleEngine.Instance<fdm, vdm> {
        protected abstract override transport: OpenAIChatCompletionsCompatibleEngine.Transport<fdm, vdm>;
    }

    export interface Options<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends CompatibleEngine.Options<fdm, vdm> {}

    export import Transport = TransportModule.Transport;
    export import MessageCodec = MessageCodecModule.MessageCodec;
    export import ChoiceCodec = ChoiceCodecModule;
}
