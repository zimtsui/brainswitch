import { RoleMessage, type Session } from './session.ts';
import { Function } from './function.ts';
import { type InferenceContext } from './inference-context.ts';
import { UserAbortion, InferenceTimeout, ResponseInvalid, type Engine } from './engine.ts';



export interface CompatibleEngine<in out fdm extends Function.Declaration.Map> extends Engine {
    /**
     * @throws {@link UserAbortion} 用户中止
     * @throws {@link InferenceTimeout} 推理超时
     * @throws {@link ResponseInvalid} 模型抽风
     * @throws {@link TypeError} 网络故障
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
        CompatibleEngine.Options.Tools<fdm>
    {}
    export namespace Options {
        export interface Tools<in out fdm extends Function.Declaration.Map> extends Engine.Options.Tools<fdm> {
            toolChoice?: Function.ToolChoice<fdm>;
        }
    }


    export interface Base<in out fdm extends Function.Declaration.Map> {
        toolChoice: Function.ToolChoice<fdm>;
        stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>>;
        pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>>;
        validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void;
    }
    export interface Instance<in out fdm extends Function.Declaration.Map> extends
        Engine.Instance<fdm>,
        CompatibleEngine.Base<fdm>,
        CompatibleEngine<fdm>
    {
        parallel: boolean;
        fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    }


    export namespace Base {
        export class Instance<in out fdm extends Function.Declaration.Map> implements CompatibleEngine.Base<fdm> {

            public toolChoice: Function.ToolChoice<fdm>;

            public constructor(
                protected instance: CompatibleEngine.Instance<fdm>,
                options: CompatibleEngine.Options<fdm>,
            ) {
                this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;
            }

            public async stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
                for (let retry = 0;; retry++) {
                    const signalTimeout = this.instance.timeout ? AbortSignal.timeout(this.instance.timeout) : undefined;
                    const signal = ctx.signal && signalTimeout ? AbortSignal.any([
                        ctx.signal,
                        signalTimeout,
                    ]) : ctx.signal || signalTimeout;
                    try {
                        return await this.instance.fetch(ctx, session, signal);
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

            public validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void {
                Function.Call.validate<fdm>(
                    toolCalls,
                    this.toolChoice,
                    new ResponseInvalid('Invalid function call', { cause: toolCalls }),
                );
            }
        }
    }
}
