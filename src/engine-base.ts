import { Function } from './function.ts';
import { Throttle } from './throttle.ts';
import { ProxyAgent } from 'undici';
import { type InferenceContext } from './inference-context.ts';
import { env } from 'node:process';
import { type Engine } from './engine.ts';


export abstract class EngineBase<in out fdm extends Function.Declaration.Map = {}> implements Engine {
    protected baseUrl: string;
    protected apiKey: string;
    protected model: string;
    public name: string;
    protected inputPrice: number;
    protected outputPrice: number;
    protected cachedPrice: number;
    protected abstract toolChoice: unknown;
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
    protected abstract fetch(ctx: InferenceContext, session: never, signal?: AbortSignal): Promise<unknown>;
    public abstract stateless(ctx: InferenceContext, session: never): Promise<unknown>;
    public abstract stateful(ctx: InferenceContext, session: never): Promise<unknown>;

    public constructor(options: Engine.Options<fdm>) {
        this.baseUrl = options.baseUrl;
        this.apiKey = options.apiKey;
        this.model = options.model;
        this.name = options.name;
        this.inputPrice = options.inputPrice ?? 0;
        this.outputPrice = options.outputPrice ?? 0;
        this.cachedPrice = options.cachePrice ?? this.inputPrice;
        this.fdm = options.functionDeclarationMap;
        this.additionalOptions = options.additionalOptions;
        this.throttle = options.throttle;
        this.timeout = options.timeout;
        this.maxTokens = options.maxTokens;
        const proxyUrl = env.https_proxy || env.HTTPS_PROXY;
        this.proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
    }

    public abstract appendUserMessage(session: never, message: never): unknown;
    public abstract pushUserMessage(session: never, message: never): unknown;
}

declare global {
    export namespace NodeJS {
        export interface ProcessEnv {
            https_proxy?: string;
        }
    }
}
