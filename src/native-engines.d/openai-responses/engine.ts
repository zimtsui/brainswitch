import { Function } from '#@/function.ts';
import { RoleMessage, type Session } from '#@/native-engines.d/openai-responses/session.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';
import { Engine } from '#@/engine.ts';
import { type InferenceContext } from '#@/inference-context.ts';
import { OpenAIResponsesToolCodec } from '#@/api-types/openai-responses/tool-codec.ts';
import { OpenAIResponsesBilling } from '#@/api-types/openai-responses/billing.ts';
import { OpenAIResponsesCompatibleMessageCodec } from '#@/compatible.d/openai-responses/message-codec.ts';
import { OpenAIResponsesNativeMessageCodec } from '#@/native-engines.d/openai-responses/message-codec.ts';
import { Validator } from '#@/native-engines.d/openai-responses/validation.ts';
import { OpenAIResponsesNativeTransport } from '#@/native-engines.d/openai-responses/transport.ts';
import type { Verbatim } from '#@/verbatim.ts';
import { Structuring } from '#@/native-engines.d/openai-responses/structuring.ts';


export class OpenAIResponsesNativeEngine<
    in out fdm extends Function.Declaration.Map.Prototype,
    in out vdm extends Verbatim.Declaration.Map.Prototype,
> extends
    Engine<
        fdm, vdm,
        RoleMessage.User.From<fdm>,
        RoleMessage.Ai.From<fdm, vdm>,
        RoleMessage.Developer,
        Session.From<fdm, vdm>
    >
{
    protected applyPatch: boolean;
    protected choice: Structuring.Choice.From<fdm, vdm>;

    protected toolCodec: OpenAIResponsesToolCodec<fdm>;
    protected compatibleMessageCodec: OpenAIResponsesCompatibleMessageCodec<fdm, vdm>;
    protected messageCodec: OpenAIResponsesNativeMessageCodec<fdm, vdm>;
    protected billing: OpenAIResponsesBilling;
    protected validator: Validator.From<fdm, vdm>;
    protected transport: OpenAIResponsesNativeTransport<fdm, vdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: OpenAIResponsesNativeEngine.Options<fdm, vdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? false;
        this.applyPatch = options.applyPatch ?? false;
        this.choice = options.choice ?? Structuring.Choice.AUTO;

        this.toolCodec = new OpenAIResponsesToolCodec({ fdm: this.fdm });
        this.compatibleMessageCodec = new OpenAIResponsesCompatibleMessageCodec({
            toolCodec: this.toolCodec,
            vdm: this.vdm,
        });
        this.messageCodec = new OpenAIResponsesNativeMessageCodec({
            toolCodec: this.toolCodec,
            compatibleMessageCodec: this.compatibleMessageCodec,
            vdm: this.vdm,
        });
        this.billing = new OpenAIResponsesBilling({ pricing: this.pricing });
        this.validator = new Validator({ choice: this.choice });
        this.transport = new OpenAIResponsesNativeTransport({
            inferenceParams: this.inferenceParams,
            providerSpec: this.providerSpec,
            fdm: this.fdm,
            throttle: this.throttle,
            choice: this.choice,
            parallelToolCall: this.parallelToolCall,
            applyPatch: this.applyPatch,
            messageCodec: this.messageCodec,
            toolCodec: this.toolCodec,
            billing: this.billing,
            validator: this.validator,
        });
    }

    protected override infer(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>> {
        return this.transport.fetch(wfctx, session, signal);
    }

    public override appendUserMessage(
        session: Session.From<fdm, vdm>,
        message: RoleMessage.User.From<fdm>,
    ): Session.From<fdm, vdm> {
        return {
            developerMessage: session.developerMessage,
            chatMessages: [...session.chatMessages, message],
        };
    }

    public override pushUserMessage(
        session: Session.From<fdm, vdm>,
        message: RoleMessage.User.From<fdm>,
    ): Session.From<fdm, vdm> {
        session.chatMessages.push(message);
        return session;
    }
}

export namespace OpenAIResponsesNativeEngine {
    export interface Options<
        in out fdm extends Function.Declaration.Map.Prototype,
        in out vdm extends Verbatim.Declaration.Map.Prototype,
    > extends Engine.Options<fdm, vdm> {
        applyPatch?: boolean;
        choice?: Structuring.Choice.From<fdm, vdm>;
    }
}
