import type { Function } from '../function.ts';
import type { Verbatim } from '../verbatim.ts';



export interface Validator<
    fdu extends Function.Decl.Proto,
    vdu extends Verbatim.Decl.Proto,
    aim,
> {
    validateChoice(message: aim): void;
    validateParts(message: aim): void;
}

export namespace Validator {
    export type From<
        fdm extends Function.Decl.Map.Proto,
        vdm extends Verbatim.Decl.Map.Proto,
        aim,
    > = Validator<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>, aim>;
}
