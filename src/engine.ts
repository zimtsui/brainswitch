import { Function } from './function.ts';
import { EndpointSpec } from './endpoint-spec.ts';
import { Throttle } from './throttle.ts';
import { ProxyAgent } from 'undici';
import { env } from 'node:process';


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
export interface InferenceSpec {
    model: string;
    additionalOptions?: Record<string, unknown>;
    maxTokens?: number;
    timeout?: number;
}

export abstract class Engine<in out fdm extends Function.Declaration.Map> {
    protected providerSpec: ProviderSpec;
    protected inferenceSpec: InferenceSpec;
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
        this.inferenceSpec = {
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
}

export namespace Engine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends EndpointSpec, Options.Tools<fdm> {
        throttle: Throttle;
    }
    export namespace Options {
        export interface Tools<in out fdm extends Function.Declaration.Map> {
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
