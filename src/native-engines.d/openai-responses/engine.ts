import { Function } from '#@/function.ts';
import { RoleMessage, type Session } from '#@/native-engines.d/openai-responses/session.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';
import { Engine } from '#@/engine.ts';
import { type InferenceContext } from '#@/inference-context.ts';
import { OpenAIResponsesToolCodec } from '#@/api-types/openai-responses/tool-codec.ts';
import { OpenAIResponsesBilling } from '#@/api-types/openai-responses/billing.ts';
import { OpenAIResponsesCompatibleMessageCodec } from '#@/compatible.d/openai-responses/message-codec.ts';
import { OpenAIResponsesNativeMessageCodec } from '#@/native-engines.d/openai-responses/message-codec.ts';
import { OpenAIResponsesNativeToolCallValidator } from '#@/native-engines.d/openai-responses/tool-call-validator.ts';
import { OpenAIResponsesNativeTransport } from '#@/native-engines.d/openai-responses/transport.ts';


export class OpenAIResponsesNativeEngine<in out fdm extends Function.Declaration.Map> extends
    Engine<
        fdm,
        RoleMessage.User<fdm>,
        RoleMessage.Ai<fdm>,
        RoleMessage.Developer,
        Session<fdm>
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
        session: Session<fdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<fdm>> {
        return this.transport.fetch(wfctx, session, signal);
    }

    public override appendUserMessage(
        session: Session<fdm>,
        message: RoleMessage.User<fdm>,
    ): Session<fdm> {
        return {
            developerMessage: session.developerMessage,
            chatMessages: [...session.chatMessages, message],
        };
    }

    public override pushUserMessage(
        session: Session<fdm>,
        message: RoleMessage.User<fdm>,
    ): Session<fdm> {
        session.chatMessages.push(message);
        return session;
    }
}

export namespace OpenAIResponsesNativeEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends Engine.Options<fdm> {
        applyPatch?: boolean;
        toolChoice?: Tool.Choice<fdm>;
    }
}
