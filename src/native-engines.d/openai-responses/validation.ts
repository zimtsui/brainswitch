import { Structuring } from '#@/native-engines.d/openai-responses/structuring.ts';
import { Function } from '#@/function.ts';
import { Verbatim } from '#@/verbatim.ts';
import { RoleMessage } from '#@/native-engines.d/openai-responses/session.ts';
import { ResponseInvalid } from '#@/engine.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';



export class Validator<
    in out fdu extends Function.Decl.Proto,
    in out vdu extends Verbatim.Decl.Proto,
> {
    public constructor(protected ctx: Validator.Context<fdu, vdu>) {}

    public validateChoice(
        tcs: Tool.Call.Of<fdu>[],
        vrs: Verbatim.Request.Of<vdu>[],
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

        } else if (this.ctx.choice === Structuring.Choice.VRequest.REQUIRED) {
            if (vrs.length) {} else throw new ResponseInvalid('Verbatim message required.');

        } else if (this.ctx.choice === Structuring.Choice.VRequest.ANYONE) {
            if (vrs.length) {} else throw new ResponseInvalid('Verbatim message required.');
            if (vrs.length > 1) throw new ResponseInvalid('Only one verbatim message allowed.');

        } else if (this.ctx.choice instanceof Structuring.Choice.VRequest) {
            if (vrs.length) {} else throw new ResponseInvalid(`Verbatim message through channel ${this.ctx.choice.name} required.`);
            if (vrs.length > 1) throw new ResponseInvalid('Only one verbatim message allowed.');
            if (vrs[0]!.name === this.ctx.choice.name) {} else
                throw new ResponseInvalid(`Only verbatim message through channel ${this.ctx.choice.name} allowed.`);

        } else if (this.ctx.choice === Structuring.Choice.REQUIRED) {
            if (tcs.length + vrs.length) {} else
                throw new ResponseInvalid('Either tool call or verbatim message required.');

        } else if (this.ctx.choice === Structuring.Choice.ANYONE) {
            if (tcs.length + vrs.length) {} else
                throw new ResponseInvalid('Either tool call or verbatim message required.');
            if (tcs.length + vrs.length > 1)
                throw new ResponseInvalid('Only one tool call or verbatim message allowed.');

        } else if (this.ctx.choice === Structuring.Choice.NONE) {
            if (tcs.length + vrs.length)
                throw new ResponseInvalid('Neither tool call nor verbatim message allowed.');

        }
    }

    public validateParts(
        message: RoleMessage.Ai<fdu, vdu>,
    ): void {
        const parts = message.getParts();
        if (parts.length) {} else throw new ResponseInvalid('Empty message.');
    }

    public validate(
        message: RoleMessage.Ai<fdu, vdu>,
    ): void {
        this.validateParts(message);
        const fcs = message.getFunctionCalls();
        const vrs = message.getVerbatimRequests();
        this.validateChoice(fcs, vrs);
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
