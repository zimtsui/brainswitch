import { Function } from '#@/function.ts';
import { ResponseInvalid } from '#@/engine.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';
import { Structuring } from '#@/native-engines.d/openai-responses/structuring.ts';
import type { Verbatim } from '#@/verbatim.ts';



export class Validator<
    in out fdu extends Function.Decl.Proto,
    in out vdu extends Verbatim.Decl.Proto,
> {
    public constructor(protected ctx: Validator.Context<fdu, vdu>) {}

    public validate(
        tcs: Tool.Call.Of<fdu>[],
        vms: Verbatim.Request.Of<vdu>[],
    ): void {
        if (this.ctx.choice === Structuring.Choice.TCall.REQUIRED) {
            if (tcs.length) {} else throw new ResponseInvalid('Tool call required.');

        } else if (this.ctx.choice === Structuring.Choice.TCall.ANYONE) {
            if (tcs.length) {} else throw new ResponseInvalid('Tool call required.');
            if (tcs.length > 1) throw new ResponseInvalid('Only one tool call allowed.');

        } else if (this.ctx.choice instanceof Structuring.Choice.TCall.FCall) {
            if (tcs.length) {} else throw new ResponseInvalid(`Function call of ${this.ctx.choice.name} required.`);
            if (tcs.length > 1) throw new ResponseInvalid('Only one function call allowed.');
            if (tcs[0]! instanceof Function.Call &&  tcs[0]!.name === this.ctx.choice.name) {} else
                throw new ResponseInvalid(`Only function call of ${this.ctx.choice.name} allowed.`);

        } else if (this.ctx.choice === Tool.APPLY_PATCH) {
            if (tcs.length) {} else throw new ResponseInvalid('Tool call required.');
            if (tcs.length > 1) throw new ResponseInvalid('Only one tool call allowed.');
            if (tcs[0]! instanceof Tool.ApplyPatch.Call) {} else
                throw new ResponseInvalid('Only tool call of apply_patch allowed.');

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
            if (tcs.length + vms.length) {} else
                throw new ResponseInvalid('Either tool call or verbatim message required.');

        } else if (this.ctx.choice === Structuring.Choice.ANYONE) {
            if (tcs.length + vms.length) {} else
                throw new ResponseInvalid('Either tool call or verbatim message required.');
            if (tcs.length + vms.length > 1)
                throw new ResponseInvalid('Only one tool call or verbatim message allowed.');

        } else if (this.ctx.choice === Structuring.Choice.NONE) {
            if (tcs.length + vms.length)
                throw new ResponseInvalid('Neither tool call nor verbatim message allowed.');

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
}
