import { RoleMessage, type Session } from './session.ts';
import { Function } from './function.ts';
import { EndpointSpec } from './endpoint-spec.ts';
import { type InferenceContext } from './inference-context.ts';
import { Throttle } from './throttle.ts';


export interface Engine<in out fdu extends Function.Declaration = never, session extends unknown = Session<fdu>> {
    stateless(ctx: InferenceContext, session: session): Promise<RoleMessage.AI<fdu>>;
    /**
     * @param session mutable
     */
    stateful(ctx: InferenceContext, session: session): Promise<RoleMessage.AI<fdu>>;
    append(session: session, message: RoleMessage.User<fdu>): session;
}

export namespace Engine {
    export namespace Options {
        export interface Functions<in out fdm extends Function.Declaration.Map = {}> {
            functionDeclarationMap: fdm;
            functionCallMode?: Function.ToolChoice<fdm>;
        }
    }

    export interface Options<in out fdm extends Function.Declaration.Map = {}> extends EndpointSpec, Options.Functions<fdm> {
        throttle: Throttle;
    }
}
