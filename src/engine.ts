import { Function } from '#@/function.ts';
import { EndpointSpec } from '#@/endpoint-spec.ts';
import { Throttle } from '#@/throttle.ts';
import { ProxyAgent } from 'undici';
import { env } from 'node:process';
import { type InferenceContext } from '#@/inference-context.ts';
import { logger } from '#@/telemetry.ts';
import { type GenericSession } from '#@/session.ts';


export interface Pricing {
    inputPrice: number;
    cachePrice: number;
    outputPrice: number;
}
export interface ProviderSpec {
    baseUrl: string;
    apiKey: string;
    proxyAgent?: ProxyAgent;
}
export interface InferenceParams {
    model: string;
    additionalOptions?: Record<string, unknown>;
    maxTokens?: number;
    timeout?: number;
}

export abstract class Engine<
    in out fdm extends Function.Declaration.Map.Prototype,
    userm, aim, devm,
    session extends GenericSession<userm, aim, devm>,
> {
    protected providerSpec: ProviderSpec;
    protected inferenceParams: InferenceParams;
    public name: string;
    public pricing: Pricing;
    public fdm: fdm;
    protected throttle: Throttle;
    protected abstract parallelToolCall: boolean;

    public constructor(options: Engine.Options<fdm>) {
        const proxyUrl = env.https_proxy || env.HTTPS_PROXY;

        this.providerSpec = {
            baseUrl: options.baseUrl,
            apiKey: options.apiKey,
            proxyAgent: proxyUrl ? new ProxyAgent(proxyUrl) : undefined,
        };

        this.name = options.name;
        this.inferenceParams = {
            model: options.model,
            additionalOptions: options.additionalOptions,
            timeout: options.timeout,
            maxTokens: options.maxTokens,
        };

        const inputPrice = options.inputPrice ?? 0;
        this.pricing = {
            inputPrice,
            outputPrice: options.outputPrice ?? 0,
            cachePrice: options.cachePrice ?? inputPrice,
        };
        this.fdm = options.functionDeclarationMap;
        this.throttle = options.throttle;
    }

    protected abstract infer(
        wfctx: InferenceContext,
        session: session,
        signal?: AbortSignal,
    ): Promise<aim>;

    /**
     * @throws {@link UserAbortion} 用户中止
     * @throws {@link InferenceTimeout} 推理超时
     * @throws {@link ResponseInvalid} 模型抽风
     * @throws {TypeError} 网络故障
     */
    public async stateless(
        wfctx: InferenceContext,
        session: session,
    ): Promise<aim> {
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
        session: session,
    ): Promise<aim> {
        const response = await this.stateless(wfctx, session);
        session.chatMessages.push(response);
        return response;
    }

    public abstract appendUserMessage(
        session: session,
        message: userm,
    ): session;

    /**
     * @param session mutable
     */
    public abstract pushUserMessage(
        session: session,
        message: userm,
    ): session;
}

export namespace Engine {
    export interface Options<in out fdm extends Function.Declaration.Map.Prototype> extends EndpointSpec, Options.Tools<fdm> {
        throttle: Throttle;
    }
    export namespace Options {
        export interface Tools<in out fdm extends Function.Declaration.Map.Prototype> {
            functionDeclarationMap: fdm;
            parallelToolCall?: boolean;
        }
    }
}

export class ResponseInvalid extends Error {}
export class UserAbortion {}
export class InferenceTimeout extends Error {}


declare global {
    export namespace NodeJS {
        export interface ProcessEnv {
            https_proxy?: string;
        }
    }
}
