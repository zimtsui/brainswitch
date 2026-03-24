import { CompatibleEngine } from '#@/compatible/engine.ts';
import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import { type InferenceContext } from '#@/inference-context.ts';
import { ToolCodec } from '#@/api-types/anthropic/tool-codec.ts';
import { Billing } from '#@/api-types/anthropic/billing.ts';
import { Validator } from '#@/compatible/validation.ts';
import { MessageCodec } from '#@/compatible.d/anthropic/message-codec.ts';
import { Transport } from '#@/compatible.d/anthropic/transport.ts';
import type { Verbatim } from '#@/verbatim.ts';


export class AnthropicCompatibleEngine<
    in out fdm extends Function.Declaration.Map.Prototype,
    in out vdm extends Verbatim.Declaration.Map.Prototype,
> extends CompatibleEngine<fdm, vdm> {
    protected toolCodec: ToolCodec<fdm>;
    protected messageCodec: MessageCodec<fdm, vdm>;
    protected billing: Billing;
    protected validator: Validator.From<fdm, vdm>;
    protected transport: Transport<fdm, vdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: AnthropicCompatibleEngine.Options<fdm, vdm>) {
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

    public override infer(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>> {
        return this.transport.fetch(wfctx, session, signal);
    }
}

export namespace AnthropicCompatibleEngine {
    export interface Options<
        in out fdm extends Function.Declaration.Map.Prototype,
        in out vdm extends Verbatim.Declaration.Map.Prototype,
    > extends CompatibleEngine.Options<fdm, vdm> {}
}
