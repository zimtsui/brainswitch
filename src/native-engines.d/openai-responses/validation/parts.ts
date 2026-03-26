import { Function } from '#@/function.ts';
import { Verbatim } from '#@/verbatim.ts';
import { ResponseInvalid } from '#@/engine.ts';
import { RoleMessage } from '#@/native-engines.d/openai-responses/session.ts';


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
    }
}
