import { RoleMessage, type Session } from './session.ts';
import { Function } from './function.ts';
import { type InferenceContext } from './inference-context.ts';
import { USER_ABORTION, InferenceTimeout, ResponseInvalid, type Engine } from './engine.ts';



export interface CompatibleEngine<in out fdm extends Function.Declaration.Map> extends Engine {
    /**
     * @throws {@link USER_ABORTION} 用户中止
     * @throws {@link InferenceTimeout} 推理超时
     * @throws {@link ResponseInvalid} 模型抽风
     * @throws {TypeError} 网络故障
     */
    stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    /**
     * @param session mutable
     */
    stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>>;
    /**
     * @param session mutable
     */
    pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>>;
}

export namespace CompatibleEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends
        Engine.Options<fdm>,
        Options.Tools<fdm>
    {}
    export namespace Options {
        export interface Tools<in out fdm extends Function.Declaration.Map> extends Engine.Options.Tools<fdm> {
            toolChoice?: Function.ToolChoice<fdm>;
        }
    }

    export interface OwnProps<in out fdm extends Function.Declaration.Map> {
        toolChoice: Function.ToolChoice<fdm>;
    }
    export namespace OwnProps {
        export function init<fdm extends Function.Declaration.Map>(options: CompatibleEngine.Options<fdm>): OwnProps<fdm> {
            return {
                toolChoice: options.toolChoice ?? Function.ToolChoice.AUTO,
            };
        }
    }

    export interface Underhood<in out fdm extends Function.Declaration.Map> extends
        Engine.Underhood<fdm>,
        CompatibleEngine<fdm>,
        OwnProps<fdm>
    {
        parallelToolCall: boolean;
        fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>>;
        pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>>;
        validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void;
    }


    export async function stateless<fdm extends Function.Declaration.Map>(
        this: CompatibleEngine.Underhood<fdm>,
        ctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        for (let retry = 0;; retry++) {
            const signalTimeout = this.timeout ? AbortSignal.timeout(this.timeout) : undefined;
            const signal = ctx.signal && signalTimeout ? AbortSignal.any([
                ctx.signal,
                signalTimeout,
            ]) : ctx.signal || signalTimeout;
            try {
                return await this.fetch(ctx, session, signal);
            } catch (e) {
                if (ctx.signal?.aborted) throw USER_ABORTION;                                       // 用户中止
                else if (signalTimeout?.aborted) e = new InferenceTimeout(undefined, { cause: e }); // 推理超时
                else if (e instanceof ResponseInvalid) {}			                                // 模型抽风
                else if (e instanceof TypeError) {}         		                                // 网络故障
                else throw e;
                if (retry < 3) ctx.logger.message?.warn(e); else throw e;
            }
        }
    }
    export async function stateful<fdm extends Function.Declaration.Map>(
        this: CompatibleEngine.Underhood<fdm>,
        ctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        const response = await this.stateless(ctx, session);
        session.chatMessages.push(response);
        return response;
    }
    export function appendUserMessage<fdm extends Function.Declaration.Map>(
        this: CompatibleEngine.Underhood<fdm>,
        session: Session<Function.Declaration.From<fdm>>,
        message: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): Session<Function.Declaration.From<fdm>> {
        return {
            ...session,
            chatMessages: [...session.chatMessages, message],
        };
    }
    export function pushUserMessage<fdm extends Function.Declaration.Map>(this: CompatibleEngine.Underhood<fdm>, session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>> {
        session.chatMessages.push(message);
        return session;
    }

    export function validateToolCallsByToolChoice<fdm extends Function.Declaration.Map>(
        this: CompatibleEngine.Underhood<fdm>,
        toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[],
    ): void {
        Function.Call.validate<fdm>(
            toolCalls,
            this.toolChoice,
            new ResponseInvalid('Invalid function call', { cause: toolCalls }),
        );
    }
}
