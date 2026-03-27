import { Structuring } from '#@/compatible/structuring.ts';
import { Function } from '#@/function.ts';
import { Verbatim } from '#@/verbatim.ts';
import { RoleMessage } from '#@/native-engines.d/google/session.ts';
import { Validator as CompatibleValidator } from '#@/compatible/validation.ts';
import { ResponseInvalid } from '#@/engine.ts';
import type { Validator as GenericValidator } from '#@/validation.ts';



export class Validator<
    in out fdu extends Function.Decl.Proto,
    in out vdu extends Verbatim.Decl.Proto,
> implements GenericValidator<fdu, vdu, RoleMessage.Ai<fdu, vdu>> {
    protected compatibleValidator: CompatibleValidator<fdu, vdu>;
    public constructor(protected ctx: Validator.Context<fdu, vdu>) {
        this.compatibleValidator = new CompatibleValidator({ choice: ctx.choice });
    }

    public validateParts(
        message: RoleMessage.Ai<fdu, vdu>,
    ): void {
        const parts = message.getParts();
        if (parts.length) {} else throw new ResponseInvalid('Empty message.');
        if (!parts.some(part => part instanceof Function.Call))
            if (parts.at(-1) instanceof RoleMessage.Part.Text) {} else
                throw new ResponseInvalid('The last message part must be text.');
    }

    public validateChoice(
        message: RoleMessage.Ai<fdu, vdu>,
    ): void {
        this.compatibleValidator.validateStructuring(message.getFunctionCalls(), message.getVerbatimRequests());
    }
}

export namespace Validator {
    export type From<
        fdm extends Function.Decl.Map.Proto,
        vdm extends Verbatim.Decl.Map.Proto,
    > = Validator<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>;

    export interface Context<
        in out fdu extends Function.Decl.Proto,
        in out vdu extends Verbatim.Decl.Proto,
    > {
        choice: Structuring.Choice<fdu, vdu>;
    }
    export namespace Context {
        export type From<
            fdm extends Function.Decl.Map.Proto,
            vdm extends Verbatim.Decl.Map.Proto,
        > = Context<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>;
    }
}
