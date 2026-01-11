import { Function } from '../function.ts';
import { type Engine, UserAbortion, InferenceTimeout, ResponseInvalid } from '../engine.ts';
import { Throttle } from '../throttle.ts';
import { ProxyAgent } from 'undici';
import { type InferenceContext } from '../inference-context.ts';
import { type Session, type RoleMessage } from '../session.ts';
import assert from 'node:assert';
import { env } from 'node:process';


export abstract class EngineBase<in out fdm extends Function.Declaration.Map = {}>
    implements Engine<Function.Declaration.From<fdm>>
{
    protected baseUrl: string;
    protected apiKey: string;
    protected model: string;
    public name: string;
    protected inputPrice: number;
    protected outputPrice: number;
    protected cachedPrice: number;
    protected fdm: fdm;
    protected abstract parallel: boolean;
    protected additionalOptions?: Record<string, unknown>;
    protected throttle: Throttle;
    protected timeout?: number;
    protected maxTokens?: number;

    protected proxyAgent?: ProxyAgent;

    /**
     * @throws {@link ResponseInvalid} 模型抽风
     * @throws {@link TypeError} 网络故障
     */
    protected abstract fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    /**
     * @throws {@link UserAbortion} 用户中止
     * @throws {@link InferenceTimeout} 推理超时
     * @throws {@link ResponseInvalid} 模型抽风
     * @throws {@link TypeError} 网络故障
     */
    public async stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
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

    public constructor(options: Engine.Options<fdm>) {
        this.baseUrl = options.baseUrl;
        this.apiKey = options.apiKey;
        this.model = options.model;
        this.name = options.name;
        this.inputPrice = options.inputPrice ?? 0;
        this.outputPrice = options.outputPrice ?? 0;
        this.cachedPrice = options.cachePrice ?? this.inputPrice;
        this.fdm = options.functionDeclarationMap;
        // this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;
        this.additionalOptions = options.additionalOptions;
        this.throttle = options.throttle;
        this.timeout = options.timeout;
        this.maxTokens = options.maxTokens;
        const proxyUrl = env.https_proxy || env.HTTPS_PROXY;
        this.proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
    }

    protected abstract validateToolCallsByToolChoice(
        toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[],
    ): void;

    protected static validateToolCallsByToolChoice<fdm extends Function.Declaration.Map = {}>(
        toolChoice: Function.ToolChoice<fdm>,
        toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[],
    ): void {
        if (toolChoice === Function.ToolChoice.REQUIRED)
            assert(toolCalls.length, new ResponseInvalid('Function call required but missing'));
        else if (toolChoice instanceof Array) for (const fc of toolCalls)
            assert(toolChoice.includes(fc.name), new ResponseInvalid('Function call not in allowed tools'));
        else if (toolChoice === Function.ToolChoice.NONE)
            assert(!toolCalls.length, new ResponseInvalid('Function call not allowed but made'));
    }
}

declare global {
    export namespace NodeJS {
        export interface ProcessEnv {
            https_proxy?: string;
        }
    }
}
