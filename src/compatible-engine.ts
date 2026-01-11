import { RoleMessage, type Session } from './session.ts';
import { Function } from './function.ts';
import { type InferenceContext } from './inference-context.ts';
import { type Engine } from './engine.ts';


export interface CompatibleEngine<in out fdu extends Function.Declaration = never> extends Engine {
    stateless(ctx: InferenceContext, session: Session<fdu>): Promise<RoleMessage.Ai<fdu>>;
    stateful(ctx: InferenceContext, session: Session<fdu>): Promise<RoleMessage.Ai<fdu>>;
    appendUserMessage(session: Session<fdu>, message: RoleMessage.User<fdu>): Session<fdu>;
    pushUserMessage(session: Session<fdu>, message: RoleMessage.User<fdu>): Session<fdu>;
    name: string;
}

export namespace CompatibleEngine {
    export namespace Options {
        export interface Tools<in out fdm extends Function.Declaration.Map = {}> extends Engine.Options.Tools<fdm> {
            toolChoice?: Function.ToolChoice<fdm>;
        }
    }

    export interface Options<in out fdm extends Function.Declaration.Map = {}> extends
        Engine.Options<fdm>,
        CompatibleEngine.Options.Tools<fdm>
    {}
}
