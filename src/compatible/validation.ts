import { Structuring } from '#@/structuring.ts';
import { Function } from '#@/function.ts';
import { Verbatim } from '#@/verbatim.ts';
import { ResponseInvalid } from '#@/engine.ts';
import { RoleMessage } from '#@/compatible/session.ts';


export class Validator<
    in out fdu extends Function.Declaration.Prototype,
    in out vdu extends Verbatim.Declaration.Prototype,
> {
    public constructor(protected ctx: Validator.Context<fdu, vdu>) {}


    public validate(
        message: RoleMessage.Ai<fdu, vdu>,
        choice: Structuring.Choice<fdu, vdu>,
    ): void {
        if (choice === Structuring.Choice.FCall.REQUIRED) {
            const fcs = message.getFunctionCalls();
            if (fcs.length) {} else throw new ResponseInvalid('Function call required.', { cause: message });
        } else if (choice instanceof Structuring.Choice.FCall) {
            const fcs = message.getFunctionCalls();
            for (const fc of fcs)
                if (fc.name === choice.name) {}
                else throw new ResponseInvalid(`Function call ${choice.name} required.`, { cause: message });
        } else if (choice === Structuring.Choice.VMessage.REQUIRED) {
            const vms = message.getVerbatimMessages();
            if (vms.length === 0) throw new ResponseInvalid('Verbatim message required.', { cause: message });
            if (vms.length > 1) throw new ResponseInvalid('Only one verbatim message allowed.', { cause: message });
        } else if (choice instanceof Structuring.Choice.VMessage) {
            const vms = message.getVerbatimMessages();
            if (vms.length === 0) throw new ResponseInvalid('Verbatim message required.', { cause: message });
            if (vms.length > 1) throw new ResponseInvalid('Only one verbatim message allowed.', { cause: message });
            if (vms[0]!.name === choice.name) {}
            else throw new ResponseInvalid(`Verbatim channel ${choice.name} required.`, { cause: message });
        } else if (choice === Structuring.Choice.REQUIRED) {
            const fcs = message.getFunctionCalls();
            const vms = message.getVerbatimMessages();
            if (vms.length > 1) throw new ResponseInvalid('Only one verbatim message allowed.', { cause: message });
            if (fcs.length + vms.length) {}
            else throw new ResponseInvalid('Either function call or verbatim message required.', { cause: message });
        } else if (choice === Structuring.Choice.NONE) {
            const fcs = message.getFunctionCalls();
            const vms = message.getVerbatimMessages();
            if (fcs.length + vms.length) throw new ResponseInvalid('No function call or verbatim message allowed.', { cause: message });
        } else if (choice === Structuring.Choice.AUTO) {
            const vms = message.getVerbatimMessages();
            if (vms.length > 1) throw new ResponseInvalid('Only one verbatim message allowed.', { cause: message });
        }
    }
}

export namespace Validator {
    export type From<
        fdm extends Function.Declaration.Map.Prototype,
        vdm extends Verbatim.Declaration.Map.Prototype,
    > = Validator<Function.Declaration.From<fdm>, Verbatim.Declaration.From<vdm>>;

    export interface Context<
        in out fdu extends Function.Declaration.Prototype,
        in out vdu extends Verbatim.Declaration.Prototype,
    > {
        choice: Structuring.Choice<fdu, vdu>;
    }
    export namespace Context {
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
            vdm extends Verbatim.Declaration.Map.Prototype,
        > = Context<Function.Declaration.From<fdm>, Verbatim.Declaration.From<vdm>>;
    }
}
