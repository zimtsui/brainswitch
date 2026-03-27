import { Function } from '../../function.ts';
import { RoleMessage, type Session } from './session.ts';
import { Engine } from '../../engine.ts';
import { type InferenceContext } from '../../inference-context.ts';
import { ToolCodec } from '../../api-types/openai-responses/tool-codec.ts';
import { Billing } from '../../api-types/openai-responses/billing.ts';
import { MessageCodec as CompatibleMessageCodec } from '../../compatible.d/openai-responses/message-codec.ts';
import { MessageCodec } from './message-codec.ts';
import { Validator } from './validation.ts';
import { Transport } from './transport.ts';
import type { Verbatim } from '../../verbatim.ts';
import { Structuring } from './structuring.ts';


export class OpenAIResponsesNativeEngine<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
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

    protected toolCodec: ToolCodec<fdm>;
    protected compatibleMessageCodec: CompatibleMessageCodec<fdm, vdm>;
    protected messageCodec: MessageCodec<fdm, vdm>;
    protected billing: Billing;
    protected override validator: Validator.From<fdm, vdm>;
    protected transport: Transport<fdm, vdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: OpenAIResponsesNativeEngine.Options<fdm, vdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? false;
        this.applyPatch = options.applyPatch ?? false;
        this.choice = options.structuringChoice ?? Structuring.Choice.AUTO;

        this.toolCodec = new ToolCodec({ fdm: this.fdm });
        this.compatibleMessageCodec = new CompatibleMessageCodec({
            toolCodec: this.toolCodec,
            vdm: this.vdm,
        });
        this.messageCodec = new MessageCodec({
            toolCodec: this.toolCodec,
            compatibleMessageCodec: this.compatibleMessageCodec,
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
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends Engine.Options<fdm, vdm> {
        applyPatch?: boolean;
        structuringChoice?: Structuring.Choice.From<fdm, vdm>;
    }
}
