import { CompatibleEngine } from '../compatible-engine.ts';
import { RoleMessage, type Session } from '../session.ts';
import { Function } from '../function.ts';
import { type InferenceContext } from '../inference-context.ts';
import { OpenAIResponsesToolCodec } from '../api-types/openai-responses/tool-codec.ts';
import { OpenAIResponsesBilling } from '../api-types/openai-responses/billing.ts';
import { ToolCallValidator } from '../compatible/tool-call-validator.ts';
import { OpenAIResponsesCompatibleMessageCodec } from '../compatible.d/openai-responses/message-codec.ts';
import { OpenAIResponsesCompatibleTransport } from '../compatible.d/openai-responses/transport.ts';


export class OpenAIResponsesCompatibleEngine<in out fdm extends Function.Declaration.Map> extends CompatibleEngine<fdm> {
    protected toolCodec: OpenAIResponsesToolCodec<fdm>;
    protected messageCodec: OpenAIResponsesCompatibleMessageCodec<fdm>;
    protected billing: OpenAIResponsesBilling;
    protected toolCallValidator: ToolCallValidator<fdm>;
    protected transport: OpenAIResponsesCompatibleTransport<fdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: OpenAIResponsesCompatibleEngine.Options<fdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? false;
        this.toolCodec = new OpenAIResponsesToolCodec({ fdm: this.fdm });
        this.messageCodec = new OpenAIResponsesCompatibleMessageCodec({ toolCodec: this.toolCodec });
        this.billing = new OpenAIResponsesBilling({ pricing: this.pricing });
        this.toolCallValidator = new ToolCallValidator({ toolChoice: this.toolChoice });
        this.transport = new OpenAIResponsesCompatibleTransport({
            inferenceSpec: this.inferenceParams,
            providerSpec: this.providerSpec,
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
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        return this.transport.fetch(wfctx, session, signal);
    }
}

export namespace OpenAIResponsesCompatibleEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Options<fdm>
    {}
}
