import { Function } from '#@/function.ts';
import { RoleMessage, type Session } from '#@/native-engines.d/google/session.ts';
import { Engine } from '#@/engine.ts';
import { type InferenceContext } from '#@/inference-context.ts';
import { GoogleToolCodec } from '#@/api-types/google/tool-codec.ts';
import { GoogleBilling } from '#@/api-types/google/billing.ts';
import { ToolCallValidator } from '#@/compatible/tool-call-validator.ts';
import { GoogleCompatibleMessageCodec } from '#@/compatible.d/google/message-codec.ts';
import { GoogleNativeMessageCodec } from '#@/native-engines.d/google/message-codec.ts';
import { GoogleNativeTransport } from '#@/native-engines.d/google/transport.ts';


export class GoogleNativeEngine<in out fdm extends Function.Declaration.Map> extends
    Engine<
        fdm,
        RoleMessage.User<Function.Declaration.From<fdm>>,
        RoleMessage.Ai<Function.Declaration.From<fdm>>,
        RoleMessage.Developer
    >
{
    protected toolChoice: Function.ToolChoice<fdm>;
    protected codeExecution: boolean;
    protected urlContext: boolean;
    protected googleSearch: boolean;

    protected toolCodec: GoogleToolCodec<fdm>;
    protected compatibleMessageCodec: GoogleCompatibleMessageCodec<fdm>;
    protected messageCodec: GoogleNativeMessageCodec<fdm>;
    protected billing: GoogleBilling;
    protected toolCallValidator: ToolCallValidator<fdm>;
    protected transport: GoogleNativeTransport<fdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: GoogleNativeEngine.Options<fdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? true;
        if (this.parallelToolCall) {} else throw new Error('Parallel tool calling is required by Google engine.');
        this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;
        this.codeExecution = options.codeExecution ?? false;
        this.urlContext = options.urlContext ?? false;
        this.googleSearch = options.googleSearch ?? false;

        this.toolCodec = new GoogleToolCodec({
            fdm: this.fdm,
            parallelToolCall: this.parallelToolCall,
        });
        this.compatibleMessageCodec = new GoogleCompatibleMessageCodec({ toolCodec: this.toolCodec });
        this.messageCodec = new GoogleNativeMessageCodec({
            toolCodec: this.toolCodec,
            compatibleMessageCodec: this.compatibleMessageCodec,
            codeExecution: this.codeExecution,
        });
        this.billing = new GoogleBilling({ pricing: this.pricing });
        this.toolCallValidator = new ToolCallValidator({ toolChoice: this.toolChoice });
        this.transport = new GoogleNativeTransport({
            inferenceParams: this.inferenceParams,
            providerSpec: this.providerSpec,
            fdm: this.fdm,
            throttle: this.throttle,
            toolChoice: this.toolChoice,
            codeExecution: this.codeExecution,
            urlContext: this.urlContext,
            googleSearch: this.googleSearch,
            messageCodec: this.messageCodec,
            toolCodec: this.toolCodec,
            billing: this.billing,
            toolCallValidator: this.toolCallValidator,
        });
    }

    protected override infer(
        wfctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        return this.transport.fetch(wfctx, session, signal);
    }

}

export namespace GoogleNativeEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends Engine.Options<fdm> {
        toolChoice?: Function.ToolChoice<fdm>;
        codeExecution?: boolean;
        urlContext?: boolean;
        googleSearch?: boolean;
    }
}
