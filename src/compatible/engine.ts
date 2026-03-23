import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import { Engine } from '#@/engine.ts';
import type { Verbatim } from '#@/verbatim.ts';



export abstract class CompatibleEngine<
    in out fdm extends Function.Declaration.Map.Prototype,
    in out vdm extends Verbatim.Declaration.Map.Prototype,
> extends
    Engine<
        fdm,
        RoleMessage.User.From<fdm>,
        RoleMessage.Ai.From<fdm, vdm>,
        RoleMessage.Developer,
        Session.From<fdm, vdm>
    >
{
    protected toolChoice: Function.ToolChoice.From<fdm>;

    public constructor(options: CompatibleEngine.Options<fdm>) {
        super(options);
        this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;
    }

    public override appendUserMessage(
        session: Session.From<fdm, vdm>,
        message: RoleMessage.User.From<fdm>,
    ): Session.From<fdm, vdm> {
        return {
            developerMessage: session.developerMessage,
            chatMessages: [...session.chatMessages, message],
        };
    }

    public override pushUserMessage(
        session: Session.From<fdm, vdm>,
        message: RoleMessage.User.From<fdm>,
    ): Session.From<fdm, vdm> {
        session.chatMessages.push(message);
        return session;
    }
}

export namespace CompatibleEngine {
    export interface Options<in out fdm extends Function.Declaration.Map.Prototype> extends
        Engine.Options<fdm>,
        CompatibleEngine.Options.Tools<fdm>
    {}

    export namespace Options {
        export interface Tools<in out fdm extends Function.Declaration.Map.Prototype> extends Engine.Options.Tools<fdm> {
            toolChoice?: Function.ToolChoice.From<fdm>;
        }
    }
}
