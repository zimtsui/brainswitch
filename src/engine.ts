import { Function } from './function.ts';
import { EndpointSpec } from './endpoint-spec.ts';
import { type InferenceContext } from './inference-context.ts';
import { Throttle } from './throttle.ts';


export interface Engine {
    stateless(ctx: InferenceContext, session: never): Promise<unknown>;
    /**
     * @param session mutable
     */
    stateful(ctx: InferenceContext, session: never): Promise<unknown>;
    appendUserMessage(session: never, message: never): unknown;
    /**
     * @param session mutable
     */
    pushUserMessage(session: never, message: never): unknown;
    name: string;
}

export namespace Engine {
    export namespace Options {
        export interface Tools<in out fdm extends Function.Declaration.Map = {}> {
            functionDeclarationMap: fdm;
            parallelToolCall?: boolean;
        }
    }

    export interface Options<in out fdm extends Function.Declaration.Map = {}> extends EndpointSpec, Options.Tools<fdm> {
        throttle: Throttle;
    }
}

export class ResponseInvalid extends Error {}
export class UserAbortion extends Error {}
export class InferenceTimeout extends Error {}
