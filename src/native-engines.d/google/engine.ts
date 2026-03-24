import { Function } from '#@/function.ts';
import { RoleMessage, type Session } from '#@/native-engines.d/google/session.ts';
import { Engine } from '#@/engine.ts';
import { type InferenceContext } from '#@/inference-context.ts';
import { GoogleToolCodec } from '#@/api-types/google/tool-codec.ts';
import { GoogleBilling } from '#@/api-types/google/billing.ts';
import { Validator } from '#@/compatible/validation.ts';
import { GoogleCompatibleMessageCodec } from '#@/compatible.d/google/message-codec.ts';
import { GoogleNativeMessageCodec } from '#@/native-engines.d/google/message-codec.ts';
import { GoogleNativeTransport } from '#@/native-engines.d/google/transport.ts';
import type { Verbatim } from '#@/verbatim.ts';
import { Structuring } from '#@/compatible/structuring.ts';


export class GoogleNativeEngine<
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
    protected choice: Structuring.Choice.From<fdm, vdm>;
    protected codeExecution: boolean;
    protected urlContext: boolean;
    protected googleSearch: boolean;

    protected toolCodec: GoogleToolCodec<fdm>;
    protected compatibleMessageCodec: GoogleCompatibleMessageCodec<fdm, vdm>;
    protected messageCodec: GoogleNativeMessageCodec<fdm, vdm>;
    protected billing: GoogleBilling;
    protected validator: Validator.From<fdm, vdm>;
    protected transport: GoogleNativeTransport<fdm, vdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: GoogleNativeEngine.Options<fdm, vdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? true;
        if (this.parallelToolCall) {} else throw new Error('Parallel tool calling is required by Google engine.');
        this.choice = options.choice ?? Structuring.Choice.AUTO;
        this.codeExecution = options.codeExecution ?? false;
        this.urlContext = options.urlContext ?? false;
        this.googleSearch = options.googleSearch ?? false;

        this.toolCodec = new GoogleToolCodec({
            fdm: this.fdm,
        });
        this.compatibleMessageCodec = new GoogleCompatibleMessageCodec({
            toolCodec: this.toolCodec,
            vdm: this.vdm,
        });
        this.messageCodec = new GoogleNativeMessageCodec({
            toolCodec: this.toolCodec,
            compatibleMessageCodec: this.compatibleMessageCodec,
            codeExecution: this.codeExecution,
            vdm: this.vdm,
        });
        this.billing = new GoogleBilling({ pricing: this.pricing });
        this.validator = new Validator({ choice: this.choice });
        this.transport = new GoogleNativeTransport({
            inferenceParams: this.inferenceParams,
            providerSpec: this.providerSpec,
            fdm: this.fdm,
            throttle: this.throttle,
            choice: this.choice,
            codeExecution: this.codeExecution,
            urlContext: this.urlContext,
            googleSearch: this.googleSearch,
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

export namespace GoogleNativeEngine {
    export interface Options<
        in out fdm extends Function.Declaration.Map.Prototype,
        in out vdm extends Verbatim.Declaration.Map.Prototype,
    > extends Engine.Options<fdm, vdm> {
        choice?: Structuring.Choice.From<fdm, vdm>;
        codeExecution?: boolean;
        urlContext?: boolean;
        googleSearch?: boolean;
    }
}
