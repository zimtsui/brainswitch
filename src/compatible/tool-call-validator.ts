import { Function } from '#@/function.ts';
import { ResponseInvalid } from '#@/engine.ts';


export class ToolCallValidator<in out fdu extends Function.Declaration.Prototype> {
    public constructor(protected ctx: ToolCallValidator.Context<fdu>) {}


    public validate(
        toolCalls: Function.Call.Of<fdu>[],
    ): void {
        Function.Call.validate<fdu>(
            toolCalls,
            this.ctx.toolChoice,
            new ResponseInvalid('Invalid function call', { cause: toolCalls }),
        );
    }
}

export namespace ToolCallValidator {
    export type From<
        fdm extends Function.Declaration.Map.Prototype,
    > = ToolCallValidator<Function.Declaration.From<fdm>>;

    export interface Context<in out fdu extends Function.Declaration.Prototype> {
        toolChoice: Function.ToolChoice<fdu>;
    }
    export namespace Context {
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Context<Function.Declaration.From<fdm>>;
    }
}
