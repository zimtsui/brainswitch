import { CompatibleEngine } from '#@/compatible/engine.ts';
import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import { type InferenceContext } from '#@/inference-context.ts';
import { MessageCodec } from '#@/compatible.d/google/message-codec.ts';
import { ToolCodec } from '#@/api-types/google/tool-codec.ts';
import { Billing } from '#@/api-types/google/billing.ts';
import { Validator } from '#@/compatible/validation.ts';
import { Transport } from '#@/compatible.d/google/transport.ts';
import type { Verbatim } from '#@/verbatim.ts';



export class GoogleCompatibleEngine<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> extends CompatibleEngine<fdm, vdm> {
    protected toolCodec: ToolCodec<fdm>;
    protected messageCodec: MessageCodec<fdm, vdm>;
    protected billing: Billing;
    protected validator: Validator.From<fdm, vdm>;
    protected transport: Transport<fdm, vdm>;
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

    public override infer(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>> {
        return this.transport.fetch(wfctx, session, signal);
    }
}

export namespace GoogleCompatibleEngine {
    export interface Options<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends CompatibleEngine.Options<fdm, vdm> {}
}
