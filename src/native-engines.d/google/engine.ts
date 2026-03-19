import { Function } from '../../function.ts';
import { RoleMessage, type Session } from './session.ts';
import { ResponseInvalid, Engine, InferenceTimeout, UserAbortion } from '../../engine.ts';
import { type InferenceContext } from '../../inference-context.ts';
import { logger } from '../../telemetry.ts';
import { GoogleToolCodec } from '../../api-types/google/tool-codec.ts';
import { GoogleBilling } from '../../api-types/google/billing.ts';
import { ToolCallValidator } from '../../compatible/tool-call-validator.ts';
import { GoogleCompatibleMessageCodec } from '../../compatible.d/google/message-codec.ts';
import { GoogleNativeMessageCodec } from './message-codec.ts';
import { GoogleNativeTransport } from './transport.ts';


export class GoogleNativeEngine<in out fdm extends Function.Declaration.Map> extends Engine<fdm> {
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

    /**
     * @throws {@link UserAbortion} 用户中止
     * @throws {@link InferenceTimeout} 推理超时
     * @throws {@link ResponseInvalid} 模型抽风
     * @throws {TypeError} 网络故障
     */
    public async stateless(
        wfctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        for (let retry = 0;; retry++) {
            const signalTimeout = this.inferenceParams.timeout ? AbortSignal.timeout(this.inferenceParams.timeout) : undefined;
            const signal = wfctx.signal && signalTimeout ? AbortSignal.any([
                wfctx.signal,
                signalTimeout,
            ]) : wfctx.signal || signalTimeout;
            try {
                return await this.transport.fetch(wfctx, session, signal);
            } catch (e) {
                if (wfctx.signal?.aborted) throw new UserAbortion();
                else if (signalTimeout?.aborted) e = new InferenceTimeout(undefined, { cause: e });
                else if (e instanceof ResponseInvalid) {}
                else if (e instanceof TypeError) {}
                else throw e;
                if (retry < 3) logger.message.warn(e); else throw e;
            }
        }
    }

    /**
     * @param session mutable
     */
    public async stateful(
        wfctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        const response = await this.stateless(wfctx, session);
        session.chatMessages.push(response);
        return response;
    }

    public appendUserMessage(
        session: Session<Function.Declaration.From<fdm>>,
        message: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): Session<Function.Declaration.From<fdm>> {
        return {
            ...session,
            chatMessages: [...session.chatMessages, message],
        };
    }

    /**
     * @param session mutable
     */
    public pushUserMessage(
        session: Session<Function.Declaration.From<fdm>>,
        message: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): Session<Function.Declaration.From<fdm>> {
        session.chatMessages.push(message);
        return session;
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
