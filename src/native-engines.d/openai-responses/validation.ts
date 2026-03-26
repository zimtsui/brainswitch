import { Structuring } from '#@/native-engines.d/openai-responses/structuring.ts';
import { Function } from '#@/function.ts';
import { Verbatim } from '#@/verbatim.ts';
import { RoleMessage } from '#@/native-engines.d/openai-responses/session.ts';
import { Validator as ChoiceValidator } from '#@/native-engines.d/openai-responses/validation/choice.ts';
import { Validator as PartsValidator } from '#@/native-engines.d/openai-responses/validation/parts.ts';


export class Validator<
    in out fdu extends Function.Decl.Proto,
    in out vdu extends Verbatim.Decl.Proto,
> {
    protected choiceValidator: ChoiceValidator<fdu, vdu>;
    protected partsValidator: PartsValidator<fdu, vdu>;

    public constructor(protected ctx: Validator.Context<fdu, vdu>) {
        this.choiceValidator = new ChoiceValidator({
            choice: ctx.choice,
        });
        this.partsValidator = new PartsValidator();
    }

    public validate(
        message: RoleMessage.Ai<fdu, vdu>,
    ): void {
        this.partsValidator.validate(message);
        const fcs = message.getFunctionCalls();
        const vrs = message.getVerbatimRequests();
        this.choiceValidator.validate(fcs, vrs);
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
