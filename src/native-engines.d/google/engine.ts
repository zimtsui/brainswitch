import { Function } from '../../function.ts';
import { RoleMessage, type Session } from './session.ts';
import { Engine } from '../../engine.ts';
import { type InferenceContext } from '../../inference-context.ts';
import { ToolCodec } from '../../api-types/google/tool-codec.ts';
import { Billing } from '../../api-types/google/billing.ts';
import { Validator } from './validation.ts';
import { MessageCodec as CompatibleMessageCodec } from '../../compatible-engine.d/google/message-codec.ts';
import { GoogleNativeMessageCodec } from './message-codec.ts';
import { GoogleNativeTransport } from './transport.ts';
import type { Verbatim } from '../../verbatim.ts';
import { Structuring } from '../../compatible-engine/structuring.ts';


export class GoogleNativeEngine<
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
    protected choice: Structuring.Choice.From<fdm, vdm>;
    protected codeExecution: boolean;
    protected urlContext: boolean;
    protected googleSearch: boolean;

    protected toolCodec: ToolCodec<fdm>;
    protected compatibleMessageCodec: CompatibleMessageCodec<fdm, vdm>;
    protected messageCodec: GoogleNativeMessageCodec<fdm, vdm>;
    protected billing: Billing;
    protected override validator: Validator.From<fdm, vdm>;
    protected override transport: GoogleNativeTransport<fdm, vdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: GoogleNativeEngine.Options<fdm, vdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? true;
        if (this.parallelToolCall) {} else throw new Error('Parallel tool calling is required by Google engine.');
        this.choice = options.structuringChoice ?? Structuring.Choice.AUTO;
        this.codeExecution = options.codeExecution ?? false;
        this.urlContext = options.urlContext ?? false;
        this.googleSearch = options.googleSearch ?? false;

        this.toolCodec = new ToolCodec({
            fdm: this.fdm,
        });
        this.compatibleMessageCodec = new CompatibleMessageCodec({
            toolCodec: this.toolCodec,
            vdm: this.vdm,
        });
        this.messageCodec = new GoogleNativeMessageCodec({
            toolCodec: this.toolCodec,
            compatibleMessageCodec: this.compatibleMessageCodec,
            codeExecution: this.codeExecution,
            vdm: this.vdm,
        });
        this.billing = new Billing({ pricing: this.pricing });
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
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends Engine.Options<fdm, vdm> {
        structuringChoice?: Structuring.Choice.From<fdm, vdm>;
        codeExecution?: boolean;
        urlContext?: boolean;
        googleSearch?: boolean;
    }
}
