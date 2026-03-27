import { CompatibleEngine } from '../engine.ts';
import { Function } from '../../function.ts';
import { MessageCodec } from '../../compatible.d/google/message-codec.ts';
import { ToolCodec } from '../../api-types/google/tool-codec.ts';
import { Billing } from '../../api-types/google/billing.ts';
import { Validator } from '../validation.ts';
import { Transport } from '../../compatible.d/google/transport.ts';
import type { Verbatim } from '../../verbatim.ts';



export class GoogleCompatibleEngine<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> extends CompatibleEngine<fdm, vdm> {
    protected toolCodec: ToolCodec<fdm>;
    protected messageCodec: MessageCodec<fdm, vdm>;
    protected billing: Billing;
    protected override validator: Validator.From<fdm, vdm>;
    protected override transport: Transport<fdm, vdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: GoogleCompatibleEngine.Options<fdm, vdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? true;
        if (this.parallelToolCall) {} else throw new Error('Parallel tool calling is required by Google engine.');
        this.toolCodec = new ToolCodec({
            fdm: this.fdm,
        });
        this.messageCodec = new MessageCodec({
            toolCodec: this.toolCodec,
            vdm: this.vdm,
        });
        this.billing = new Billing({ pricing: this.pricing });
        this.validator = new Validator({ choice: this.choice });
        this.transport = new Transport({
            inferenceParams: this.inferenceParams,
            providerSpec: this.providerSpec,
            fdm: this.fdm,
            throttle: this.throttle,
            choice: this.choice,
            messageCodec: this.messageCodec,
            toolCodec: this.toolCodec,
            billing: this.billing,
            validator: this.validator,
        });
    }

}

export namespace GoogleCompatibleEngine {
    export interface Options<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends CompatibleEngine.Options<fdm, vdm> {}
}
