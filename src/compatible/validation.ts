import { Structuring } from '#@/compatible/structuring.ts';
import { Function } from '#@/function.ts';
import { Verbatim } from '#@/verbatim.ts';
import { ResponseInvalid } from '#@/engine.ts';
import { RoleMessage } from '#@/compatible/session.ts';


export class Validator<
    in out fdu extends Function.Decl.Proto,
    in out vdu extends Verbatim.Decl.Proto,
> {
    public constructor(protected ctx: Validator.Context<fdu, vdu>) {}


    public validate(
        fcs: Function.Call.Of<fdu>[],
        vms: Verbatim.Request.Of<vdu>[],
    ): void {
        if (this.ctx.choice === Structuring.Choice.FCall.REQUIRED) {
            if (fcs.length) {} else throw new ResponseInvalid('Function call required.');

        } else if (this.ctx.choice === Structuring.Choice.FCall.ANYONE) {
            if (fcs.length) {} else throw new ResponseInvalid('Function call required.');
            if (fcs.length > 1) throw new ResponseInvalid('Only one function call allowed.');

        } else if (this.ctx.choice instanceof Structuring.Choice.FCall) {
            if (fcs.length) {} else throw new ResponseInvalid(`Function call of ${this.ctx.choice.name} required.`);
            if (fcs.length > 1) throw new ResponseInvalid('Only one function call allowed.');
            if (fcs[0]!.name === this.ctx.choice.name) {} else
                throw new ResponseInvalid(`Only function call of ${this.ctx.choice.name} allowed.`);

        } else if (this.ctx.choice === Structuring.Choice.VMessage.REQUIRED) {
            if (vms.length) {} else throw new ResponseInvalid('Verbatim message required.');

        } else if (this.ctx.choice === Structuring.Choice.VMessage.ANYONE) {
            if (vms.length) {} else throw new ResponseInvalid('Verbatim message required.');
            if (vms.length > 1) throw new ResponseInvalid('Only one verbatim message allowed.');

        } else if (this.ctx.choice instanceof Structuring.Choice.VMessage) {
            if (vms.length) {} else throw new ResponseInvalid(`Verbatim message through channel ${this.ctx.choice.name} required.`);
            if (vms.length > 1) throw new ResponseInvalid('Only one verbatim message allowed.');
            if (vms[0]!.name === this.ctx.choice.name) {} else
                throw new ResponseInvalid(`Only verbatim message through channel ${this.ctx.choice.name} allowed.`);

        } else if (this.ctx.choice === Structuring.Choice.REQUIRED) {
            if (fcs.length + vms.length) {} else
                throw new ResponseInvalid('Either function call or verbatim message required.');

        } else if (this.ctx.choice === Structuring.Choice.ANYONE) {
            if (fcs.length + vms.length) {} else
                throw new ResponseInvalid('Either function call or verbatim message required.');
            if (fcs.length + vms.length > 1)
                throw new ResponseInvalid('Only one function call or verbatim message allowed.');

        } else if (this.ctx.choice === Structuring.Choice.NONE) {
            if (fcs.length + vms.length)
                throw new ResponseInvalid('Neither function call nor verbatim message allowed.');

        }
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
