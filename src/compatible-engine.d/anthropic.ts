import { CompatibleEngine } from '#@/compatible/engine.ts';
import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import { type InferenceContext } from '#@/inference-context.ts';
import { AnthropicToolCodec } from '#@/api-types/anthropic/tool-codec.ts';
import { AnthropicBilling } from '#@/api-types/anthropic/billing.ts';
import { ToolCallValidator } from '#@/compatible/tool-call-validator.ts';
import { AnthropicCompatibleMessageCodec } from '#@/compatible.d/anthropic/message-codec.ts';
import { AnthropicCompatibleTransport } from '#@/compatible.d/anthropic/transport.ts';


export class AnthropicCompatibleEngine<in out fdm extends Function.Declaration.Map> extends CompatibleEngine<fdm> {
    protected toolCodec: AnthropicToolCodec<fdm>;
    protected messageCodec: AnthropicCompatibleMessageCodec<fdm>;
    protected billing: AnthropicBilling;
    protected toolCallValidator: ToolCallValidator<fdm>;
    protected transport: AnthropicCompatibleTransport<fdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: AnthropicCompatibleEngine.Options<fdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? false;
        this.toolCodec = new AnthropicToolCodec({ fdm: this.fdm });
        this.messageCodec = new AnthropicCompatibleMessageCodec({ toolCodec: this.toolCodec });
        this.billing = new AnthropicBilling({ pricing: this.pricing });
        this.toolCallValidator = new ToolCallValidator({ toolChoice: this.toolChoice });
        this.transport = new AnthropicCompatibleTransport({
            providerSpec: this.providerSpec,
            inferenceSpec: this.inferenceParams,
            fdm: this.fdm,
            throttle: this.throttle,
            toolChoice: this.toolChoice,
            parallelToolCall: this.parallelToolCall,
            messageCodec: this.messageCodec,
            toolCodec: this.toolCodec,
            billing: this.billing,
            toolCallValidator: this.toolCallValidator,
        });
    }

    public override infer(
        wfctx: InferenceContext,
        session: Session<fdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<fdm>> {
        return this.transport.fetch(wfctx, session, signal);
    }
}

export namespace AnthropicCompatibleEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Options<fdm>
    {}
}
