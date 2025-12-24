import { RoleMessage, type Session } from './session.ts';
import { Function } from './function.ts';
import { EndpointSpec } from './endpoint-spec.ts';
import { type InferenceContext } from './inference-context.ts';
import { Throttle } from './throttle.ts';


export interface Engine<in out fdu extends Function.Declaration = never, session extends unknown = Session<fdu>> {
    stateless(ctx: InferenceContext, session: session): Promise<RoleMessage.Ai<fdu>>;
    /**
     * @param session mutable
     */
    stateful(ctx: InferenceContext, session: session): Promise<RoleMessage.Ai<fdu>>;
    appendUserMessage(session: session, message: RoleMessage.User<fdu>): session;
    /**
     * @param session mutable
     */
    pushUserMessage(session: session, message: RoleMessage.User<fdu>): session;
    name: string;
}

export namespace Engine {
    export namespace Options {
        export interface Functions<in out fdm extends Function.Declaration.Map = {}> {
            functionDeclarationMap: fdm;
            toolChoice?: Function.ToolChoice<fdm>;
            parallelFunctionCall?: boolean;
        }
    }

    export interface Options<in out fdm extends Function.Declaration.Map = {}> extends EndpointSpec, Options.Functions<fdm> {
        throttle: Throttle;
    }
}

export class ResponseInvalid extends Error {}
export class UserAbortion extends Error {}
export class InferenceTimeout extends Error {}
