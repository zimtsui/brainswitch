import { CompatibleEngine } from '../engine.ts';
import { RoleMessage, type Session } from '../session.ts';
import { Function } from '../../function.ts';
import { type InferenceContext } from '../../inference-context.ts';
import { ToolCodec } from '../../api-types/openai-responses/tool-codec.ts';
import { Billing } from '../../api-types/openai-responses/billing.ts';
import { Validator } from '../validation.ts';
import { MessageCodec } from '../../compatible.d/openai-responses/message-codec.ts';
import { Transport } from '../../compatible.d/openai-responses/transport.ts';
import type { Verbatim } from '../../verbatim.ts';


export class OpenAIResponsesCompatibleEngine<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> extends CompatibleEngine<fdm, vdm> {
    protected toolCodec: ToolCodec<fdm>;
    protected messageCodec: MessageCodec<fdm, vdm>;
    protected billing: Billing;
    protected override validator: Validator.From<fdm, vdm>;
    protected override transport: Transport<fdm, vdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: OpenAIResponsesCompatibleEngine.Options<fdm, vdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? false;
        this.toolCodec = new ToolCodec({ fdm: this.fdm });
        this.messageCodec = new MessageCodec({
            toolCodec: this.toolCodec,
            vdm: this.vdm,
        });
        this.billing = new Billing({ pricing: this.pricing });
        this.validator = new Validator({ choice: this.choice });
        this.transport = new Transport({
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
}
