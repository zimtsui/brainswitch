import { Function } from '../../function.ts';
import { RoleMessage, type Session } from './session.ts';
import { Tool } from './tool.ts';
import { ResponseInvalid, Engine, InferenceTimeout, UserAbortion } from '../../engine.ts';
import { type InferenceContext } from '../../inference-context.ts';
import { logger } from '../../telemetry.ts';
import { OpenAIResponsesToolCodec } from '../../api-types/openai-responses/tool-codec.ts';
import { OpenAIResponsesBilling } from '../../api-types/openai-responses/billing.ts';
import { OpenAIResponsesCompatibleMessageCodec } from '../../compatible.d/openai-responses/message-codec.ts';
import { OpenAIResponsesNativeMessageCodec } from './message-codec.ts';
import { OpenAIResponsesNativeToolCallValidator } from './tool-call-validator.ts';
import { OpenAIResponsesNativeTransport } from './transport.ts';


export class OpenAIResponsesNativeEngine<in out fdm extends Function.Declaration.Map> extends Engine<fdm> {
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

export namespace OpenAIResponsesNativeEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends Engine.Options<fdm> {
        applyPatch?: boolean;
        toolChoice?: Tool.Choice<fdm>;
    }
}
