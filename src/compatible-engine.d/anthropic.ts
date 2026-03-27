import { CompatibleEngine } from '../compatible-engine.ts';
import { Function } from '../function.ts';
import { ToolCodec } from '../api-types/anthropic/tool-codec.ts';
import { Billing } from '../api-types/anthropic/billing.ts';
import { Validator } from '../compatible-engine/validation.ts';
import * as MessageCodecModule from './anthropic/message-codec.ts';
import * as TransportModule from './anthropic/transport.ts';
import * as ChoiceCodecModule from './anthropic/choice-codec.ts';
import type { Verbatim } from '../verbatim.ts';


export class AnthropicCompatibleEngine<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> extends CompatibleEngine<fdm, vdm> {
    protected toolCodec: ToolCodec<fdm>;
    protected messageCodec: AnthropicCompatibleEngine.MessageCodec<fdm, vdm>;
    protected billing: Billing;
    protected validator: Validator.From<fdm, vdm>;
    protected transport: AnthropicCompatibleEngine.Transport<fdm, vdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: AnthropicCompatibleEngine.Options<fdm, vdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? false;
        this.toolCodec = new ToolCodec({ fdm: this.fdm });
        this.messageCodec = new AnthropicCompatibleEngine.MessageCodec({
            toolCodec: this.toolCodec,
            vdm: this.vdm,
        });
        this.billing = new Billing({ pricing: this.pricing });
        this.validator = new Validator({ choice: this.choice });
        this.transport = new AnthropicCompatibleEngine.Transport({
            providerSpec: this.providerSpec,
            inferenceSpec: this.inferenceParams,
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

export namespace AnthropicCompatibleEngine {
    export interface Options<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends CompatibleEngine.Options<fdm, vdm> {}

    export import MessageCodec = MessageCodecModule.MessageCodec;
    export import Transport = TransportModule.Transport;
    export import ChoiceCodec = ChoiceCodecModule;
}
