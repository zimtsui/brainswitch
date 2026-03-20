import { CompatibleEngine } from '../compatible/engine.ts';
import { RoleMessage, type Session } from '../compatible/session.ts';
import { Function } from '../function.ts';
import { type InferenceContext } from '../inference-context.ts';
import { GoogleCompatibleMessageCodec } from '../compatible.d/google/message-codec.ts';
import { GoogleToolCodec } from '../api-types/google/tool-codec.ts';
import { GoogleBilling } from '../api-types/google/billing.ts';
import { ToolCallValidator } from '../compatible/tool-call-validator.ts';
import { GoogleCompatibleTransport } from '../compatible.d/google/transport.ts';



export class GoogleCompatibleEngine<in out fdm extends Function.Declaration.Map> extends CompatibleEngine<fdm> {
    protected toolCodec: GoogleToolCodec<fdm>;
    protected messageCodec: GoogleCompatibleMessageCodec<fdm>;
    protected billing: GoogleBilling;
    protected toolCallValidator: ToolCallValidator<fdm>;
    protected transport: GoogleCompatibleTransport<fdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: GoogleCompatibleEngine.Options<fdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? true;
        if (this.parallelToolCall) {} else throw new Error('Parallel tool calling is required by Google engine.');
        this.toolCodec = new GoogleToolCodec({
            fdm: this.fdm,
            parallelToolCall: this.parallelToolCall,
        });
        this.messageCodec = new GoogleCompatibleMessageCodec({ toolCodec: this.toolCodec });
        this.billing = new GoogleBilling({ pricing: this.pricing });
        this.toolCallValidator = new ToolCallValidator({ toolChoice: this.toolChoice });
        this.transport = new GoogleCompatibleTransport({
            pricing: this.pricing,
            inferenceParams: this.inferenceParams,
            providerSpec: this.providerSpec,
            fdm: this.fdm,
            throttle: this.throttle,
            toolChoice: this.toolChoice,
            messageCodec: this.messageCodec,
            toolCodec: this.toolCodec,
            billing: this.billing,
            toolCallValidator: this.toolCallValidator,
        });
    }

    public override infer(
        wfctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        return this.transport.fetch(wfctx, session, signal);
    }
}

export namespace GoogleCompatibleEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Options<fdm>
    {}
}
