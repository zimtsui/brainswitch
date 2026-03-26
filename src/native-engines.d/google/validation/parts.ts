import { Function } from '#@/function.ts';
import { Verbatim } from '#@/verbatim.ts';
import { ResponseInvalid } from '#@/engine.ts';
import { RoleMessage } from '#@/native-engines.d/google/session.ts';


export class Validator<
    in out fdu extends Function.Decl.Proto,
    in out vdu extends Verbatim.Decl.Proto,
> {
    public constructor() {}

    public validate(
        message: RoleMessage.Ai<fdu, vdu>,
    ): void {
        const parts = message.getParts();
        if (parts.length) {} else throw new ResponseInvalid('Empty message.');
        if (!parts.some(part => part instanceof Function.Call))
            if (parts.at(-1) instanceof RoleMessage.Part.Text) {} else
                throw new ResponseInvalid('The last message part must be text.');
    }
}
