import { Function } from '../../function.ts';
import { RoleMessage, type Session } from './session.ts';
import { Tool } from './tool.ts';
import { Engine } from '../../engine.ts';
import { type InferenceContext } from '../../inference-context.ts';
import { OpenAIResponsesToolCodec } from '../../api-types/openai-responses/tool-codec.ts';
import { OpenAIResponsesBilling } from '../../api-types/openai-responses/billing.ts';
import { OpenAIResponsesCompatibleMessageCodec } from '../../compatible.d/openai-responses/message-codec.ts';
import { OpenAIResponsesNativeMessageCodec } from './message-codec.ts';
import { OpenAIResponsesNativeToolCallValidator } from './tool-call-validator.ts';
import { OpenAIResponsesNativeTransport } from './transport.ts';


export class OpenAIResponsesNativeEngine<in out fdm extends Function.Declaration.Map> extends
    Engine<
        fdm,
        RoleMessage.User<Function.Declaration.From<fdm>>,
        RoleMessage.Ai<Function.Declaration.From<fdm>>,
        RoleMessage.Developer
    >
{
    protected applyPatch: boolean;
    protected toolChoice: Tool.Choice<fdm>;

    protected toolCodec: OpenAIResponsesToolCodec<fdm>;
    protected compatibleMessageCodec: OpenAIResponsesCompatibleMessageCodec<fdm>;
    protected messageCodec: OpenAIResponsesNativeMessageCodec<fdm>;
    protected billing: OpenAIResponsesBilling;
    protected toolCallValidator: OpenAIResponsesNativeToolCallValidator<fdm>;
    protected transport: OpenAIResponsesNativeTransport<fdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: OpenAIResponsesNativeEngine.Options<fdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? false;
        this.applyPatch = options.applyPatch ?? false;
        this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;

        this.toolCodec = new OpenAIResponsesToolCodec({ fdm: this.fdm });
        this.compatibleMessageCodec = new OpenAIResponsesCompatibleMessageCodec({ toolCodec: this.toolCodec });
        this.messageCodec = new OpenAIResponsesNativeMessageCodec({
            toolCodec: this.toolCodec,
            compatibleMessageCodec: this.compatibleMessageCodec,
        });
        this.billing = new OpenAIResponsesBilling({ pricing: this.pricing });
        this.toolCallValidator = new OpenAIResponsesNativeToolCallValidator({ toolChoice: this.toolChoice });
        this.transport = new OpenAIResponsesNativeTransport({
            inferenceParams: this.inferenceParams,
            providerSpec: this.providerSpec,
            fdm: this.fdm,
            throttle: this.throttle,
            toolChoice: this.toolChoice,
            parallelToolCall: this.parallelToolCall,
            applyPatch: this.applyPatch,
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

export namespace OpenAIResponsesNativeEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends Engine.Options<fdm> {
        applyPatch?: boolean;
        toolChoice?: Tool.Choice<fdm>;
    }
}
