import { Function } from '#@/function.ts';
import { ResponseInvalid } from '#@/engine.ts';


export class ToolCallValidator<in out fdm extends Function.Declaration.Map> {
    public constructor(protected ctx: ToolCallValidator.Context<fdm>) {}


    public validate(
        toolCalls: Function.Call.From<fdm>[],
    ): void {
        Function.Call.validate<fdm>(
            toolCalls,
            this.ctx.toolChoice,
            new ResponseInvalid('Invalid function call', { cause: toolCalls }),
        );
    }
}

export namespace ToolCallValidator {
    export interface Context<in out fdm extends Function.Declaration.Map> {
        toolChoice: Function.ToolChoice<fdm>;
    }
}
