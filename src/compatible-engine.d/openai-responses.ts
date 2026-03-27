import { CompatibleEngine } from '../compatible-engine.ts';
import { Function } from '../function.ts';
import { ToolCodec } from '../api-types/openai-responses/tool-codec.ts';
import { Billing } from '../api-types/openai-responses/billing.ts';
import { Validator } from '../compatible-engine/validation.ts';
import * as MessageCodecModule from './openai-responses/message-codec.ts';
import * as TransportModule from './openai-responses/transport.ts';
import type { Verbatim } from '../verbatim.ts';
import * as ChoiceCodecModule from './openai-responses/choice-codec.ts';


export class OpenAIResponsesCompatibleEngine<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> extends CompatibleEngine<fdm, vdm> {
    protected toolCodec: ToolCodec<fdm>;
    protected messageCodec: OpenAIResponsesCompatibleEngine.MessageCodec<fdm, vdm>;
    protected billing: Billing;
    protected override validator: Validator.From<fdm, vdm>;
    protected override transport: OpenAIResponsesCompatibleEngine.Transport<fdm, vdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: OpenAIResponsesCompatibleEngine.Options<fdm, vdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? false;
        this.toolCodec = new ToolCodec({ fdm: this.fdm });
        this.messageCodec = new OpenAIResponsesCompatibleEngine.MessageCodec({
            toolCodec: this.toolCodec,
            vdm: this.vdm,
        });
        this.billing = new Billing({ pricing: this.pricing });
        this.validator = new Validator({ choice: this.choice });
        this.transport = new OpenAIResponsesCompatibleEngine.Transport({
            inferenceSpec: this.inferenceParams,
            providerSpec: this.providerSpec,
            fdm: this.fdm,
            throttle: this.throttle,
            choice: this.choice,
            parallelToolCall: this.parallelToolCall,
            messageCodec: this.messageCodec,
            toolCodec: this.toolCodec,
            billing: this.billing,
            validator: this.validator,
        });
    }

}

export namespace OpenAIResponsesCompatibleEngine {
    export interface Options<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends CompatibleEngine.Options<fdm, vdm> {}

    export import MessageCodec = MessageCodecModule.MessageCodec;
    export import Transport = TransportModule.Transport;
    export import ChoiceCodec = ChoiceCodecModule;
}
