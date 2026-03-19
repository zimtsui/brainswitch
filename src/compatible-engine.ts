import { RoleMessage, type Session } from './session.ts';
import { Function } from './function.ts';
import { type InferenceContext } from './inference-context.ts';
import { UserAbortion, InferenceTimeout, ResponseInvalid, Engine } from './engine.ts';
import { logger } from './telemetry.ts';



export abstract class CompatibleEngine<in out fdm extends Function.Declaration.Map> extends Engine<fdm> {
    protected toolChoice: Function.ToolChoice<fdm>;

    public constructor(options: CompatibleEngine.Options<fdm>) {
        super(options);
        this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;
    }

    protected abstract infer(
        wfctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;

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
                return await this.infer(wfctx, session, signal);
            } catch (e) {
                if (wfctx.signal?.aborted) throw new UserAbortion();                                // 用户中止
                else if (signalTimeout?.aborted) e = new InferenceTimeout(undefined, { cause: e }); // 推理超时
                else if (e instanceof ResponseInvalid) {}			                                // 模型抽风
                else if (e instanceof TypeError) {}         		                                // 网络故障
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

export namespace CompatibleEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends
        Engine.Options<fdm>,
        CompatibleEngine.Options.Tools<fdm>
    {}

    export namespace Options {
        export interface Tools<in out fdm extends Function.Declaration.Map> extends Engine.Options.Tools<fdm> {
            toolChoice?: Function.ToolChoice<fdm>;
        }
    }
}
