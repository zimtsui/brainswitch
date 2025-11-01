import { RoleMessage, type Session } from './session.ts';
import { Function } from './function.ts';
import { EndpointSpec } from './endpoint-spec.ts';
import { type InferenceContext } from './inference-context.ts';
import { Throttle } from './throttle.ts';


export interface Engine<in out fdu extends Function.Declaration = never> {
    (ctx: InferenceContext, session: Session<fdu>): Promise<RoleMessage.AI<fdu>>;
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

    /**
     * @param session mutable
     */
    export async function apply<fdm extends Function.Declaration.Map = {}>(
        ctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
        cc: Engine<Function.Declaration.From<fdm>>,
    ): Promise<RoleMessage.AI<Function.Declaration.From<fdm>>> {
        const response = await cc(ctx, session);
        session.chatMessages.push(response);
        return response;
    }
}
