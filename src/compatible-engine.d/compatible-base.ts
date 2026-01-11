import { Function } from '../function.ts';
import { type CompatibleEngine } from '../compatible-engine.ts';
import { UserAbortion, InferenceTimeout, ResponseInvalid } from '../engine.ts';
import { type InferenceContext } from '../inference-context.ts';
import { type Session, type RoleMessage } from '../session.ts';
import { EngineBase } from '../engine-base.ts';


export abstract class CommonEngineBase<in out fdm extends Function.Declaration.Map = {}> extends EngineBase<fdm> {
    protected override toolChoice: Function.ToolChoice<fdm>;

    protected abstract override fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    public override async stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        for (let retry = 0;; retry++) {
            const signalTimeout = this.timeout ? AbortSignal.timeout(this.timeout) : undefined;
            const signal = ctx.signal && signalTimeout ? AbortSignal.any([
                ctx.signal,
                signalTimeout,
            ]) : ctx.signal || signalTimeout;
            try {
                return await this.fetch(ctx, session, signal);
            } catch (e) {
                if (ctx.signal?.aborted) throw new UserAbortion();                                  // 用户中止
                else if (signalTimeout?.aborted) e = new InferenceTimeout(undefined, { cause: e }); // 推理超时
                else if (e instanceof ResponseInvalid) {}			                                // 模型抽风
                else if (e instanceof TypeError) {}         		                                // 网络故障
                else throw e;
                if (retry < 3) ctx.logger.message?.warn(e); else throw e;
            }
        }
    }
    public async stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        const response = await this.stateless(ctx, session);
        session.chatMessages.push(response);
        return response;
    }
    public appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>> {
        return {
            ...session,
            chatMessages: [...session.chatMessages, message],
        };
    }
    public pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>> {
        session.chatMessages.push(message);
        return session;
    }

    public constructor(options: CompatibleEngine.Options<fdm>) {
        super(options);
        this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;
    }

    protected validateToolCallsByToolChoice(
        toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[],
    ): void {
        Function.Call.validate<fdm>(
            toolCalls,
            this.toolChoice,
            new ResponseInvalid('Invalid function call', { cause: toolCalls }),
        );
    }
}
