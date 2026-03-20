import { RoleMessage } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import { Engine } from '#@/engine.ts';



export abstract class CompatibleEngine<in out fdm extends Function.Declaration.Map> extends
    Engine<
        fdm,
        RoleMessage.User<Function.Declaration.From<fdm>>,
        RoleMessage.Ai<Function.Declaration.From<fdm>>,
        RoleMessage.Developer
    >
{
    protected toolChoice: Function.ToolChoice<fdm>;

    public constructor(options: CompatibleEngine.Options<fdm>) {
        super(options);
        this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;
    }

}

export namespace CompatibleEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends
        Engine.Options<fdm>,
        CompatibleEngine.Options.Tools<fdm>
    {}

    export namespace Options {
        export interface Tools<in out fdm extends Function.Declaration.Map> extends Engine.Options.Tools<fdm> {
            toolChoice?: Function.ToolChoice<fdm>;
        }
    }
}
