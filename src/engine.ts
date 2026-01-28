import { Function } from './function.ts';
import { EndpointSpec } from './endpoint-spec.ts';
import { Throttle } from './throttle.ts';
import { ProxyAgent } from 'undici';
import { env } from 'node:process';



export interface Engine {
    name: string;
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

    export interface Base<in out fdm extends Function.Declaration.Map> {
        baseUrl: string;
        apiKey: string;
        model: string;
        name: string;
        inputPrice: number;
        outputPrice: number;
        cachedPrice: number;
        fdm: fdm;
        additionalOptions?: Record<string, unknown>;
        throttle: Throttle;
        timeout?: number;
        maxTokens?: number;
        proxyAgent?: ProxyAgent;
    }

    export interface Instance<in out fdm extends Function.Declaration.Map> extends
        Engine.Base<fdm>,
        Engine
    {
        parallel: boolean;
    }

    export namespace Base {
        export class Constructor<in out fdm extends Function.Declaration.Map> implements Engine.Base<fdm> {
            public baseUrl: string;
            public apiKey: string;
            public model: string;
            public name: string;
            public inputPrice: number;
            public outputPrice: number;
            public cachedPrice: number;
            public fdm: fdm;
            public additionalOptions?: Record<string, unknown>;
            public throttle: Throttle;
            public timeout?: number;
            public maxTokens?: number;

            public proxyAgent?: ProxyAgent;

            public constructor(
                public instance: Engine.Instance<fdm>,
                options: Engine.Options<fdm>,
            ) {
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
        }
    }
}

export class ResponseInvalid extends Error {}
export class UserAbortion extends Error {}
export class InferenceTimeout extends Error {}


declare global {
    export namespace NodeJS {
        export interface ProcessEnv {
            https_proxy?: string;
        }
    }
}
