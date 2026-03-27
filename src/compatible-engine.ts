import { RoleMessage, type Session } from './compatible-engine/session.ts';
import { Function } from './function.ts';
import { Engine } from './engine.ts';
import type { Verbatim } from './verbatim.ts';
import { Structuring } from './compatible-engine/structuring.ts';



export abstract class CompatibleEngine<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> extends
    Engine<
        fdm, vdm,
        RoleMessage.User.From<fdm>,
        RoleMessage.Ai.From<fdm, vdm>,
        RoleMessage.Developer,
        Session.From<fdm, vdm>
    >
{
    protected choice: Structuring.Choice.From<fdm, vdm>;

    public constructor(options: CompatibleEngine.Options<fdm, vdm>) {
        super(options);
        this.choice = options.structuringChoice ?? Structuring.Choice.AUTO;
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
    export interface Options<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends Engine.Options<fdm, vdm> {
        structuringChoice?: Structuring.Choice.From<fdm, vdm>;
    }
}
