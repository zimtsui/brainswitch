import { Function } from './function.ts';
import { EndpointSpec } from './endpoint-spec.ts';
import { Throttle } from './throttle.ts';
import { ProxyAgent } from 'undici';
import { env } from 'node:process';
import { type Logger } from './telemetry.ts';


export interface Engine {
    name: string;
}

export namespace Engine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends EndpointSpec, Options.Tools<fdm> {
        throttle: Throttle;
        logger: Logger;
    }
    export namespace Options {
        export interface Tools<in out fdm extends Function.Declaration.Map> {
            functionDeclarationMap: fdm;
            parallelToolCall?: boolean;
        }
    }

    export interface OwnProps<in out fdm extends Function.Declaration.Map> {
        baseUrl: string;
        apiKey: string;
        model: string;
        name: string;
        inputPrice: number;
        outputPrice: number;
        cachePrice: number;
        fdm: fdm;
        additionalOptions?: Record<string, unknown>;
        throttle: Throttle;
        timeout?: number;
        maxTokens?: number;
        proxyAgent?: ProxyAgent;
        logger: Logger;
    }
    export namespace OwnProps {
        export function init<fdm extends Function.Declaration.Map>(options: Options<fdm>): OwnProps<fdm> {
            const proxyUrl = env.https_proxy || env.HTTPS_PROXY;
            const inputPrice = options.inputPrice ?? 0;
            return {
                baseUrl: options.baseUrl,
                apiKey: options.apiKey,
                model: options.model,
                name: options.name,
                inputPrice,
                outputPrice: options.outputPrice ?? 0,
                cachePrice: options.cachePrice ?? inputPrice,
                fdm: options.functionDeclarationMap,
                additionalOptions: options.additionalOptions,
                throttle: options.throttle,
                timeout: options.timeout,
                maxTokens: options.maxTokens,
                proxyAgent: proxyUrl ? new ProxyAgent(proxyUrl) : undefined,
                logger: options.logger
            };
        }
    }

    export interface Underhood<in out fdm extends Function.Declaration.Map> extends
        Engine,
        OwnProps<fdm>
    {
        parallelToolCall: boolean;
    }
}

export class ResponseInvalid extends Error {}
export const USER_ABORTION = Symbol();
export class InferenceTimeout extends Error {}


declare global {
    export namespace NodeJS {
        export interface ProcessEnv {
            https_proxy?: string;
        }
    }
}
