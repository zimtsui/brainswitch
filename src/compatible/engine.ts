import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import { Engine } from '#@/engine.ts';



export abstract class CompatibleEngine<in out fdm extends Function.Declaration.Map> extends
    Engine<
        fdm,
        RoleMessage.User<fdm>,
        RoleMessage.Ai<fdm>,
        RoleMessage.Developer,
        Session<fdm>
    >
{
    protected toolChoice: Function.ToolChoice<fdm>;

    public constructor(options: CompatibleEngine.Options<fdm>) {
        super(options);
        this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;
    }

    public override appendUserMessage(
        session: Session<fdm>,
        message: RoleMessage.User<fdm>,
    ): Session<fdm> {
        return {
            developerMessage: session.developerMessage,
            chatMessages: [...session.chatMessages, message],
        };
    }

    public override pushUserMessage(
        session: Session<fdm>,
        message: RoleMessage.User<fdm>,
    ): Session<fdm> {
        session.chatMessages.push(message);
        return session;
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
