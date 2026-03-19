import { Function } from '../../function.ts';
import { ResponseInvalid } from '../../engine.ts';
import { Tool } from './tool.ts';



export class OpenAIResponsesNativeToolCallValidator<fdm extends Function.Declaration.Map> {
    public constructor(protected ctx: OpenAIResponsesNativeToolCallValidator.Context<fdm>) {}

    public validate(
        toolCalls: Tool.Call<Function.Declaration.From<fdm>>[],
    ): void {
        if (this.ctx.toolChoice === Function.ToolChoice.REQUIRED)
            if (toolCalls.length) {} else throw new ResponseInvalid('Invalid function call', { cause: toolCalls });
        else if (this.ctx.toolChoice instanceof Array) for (const tc of toolCalls) {
            if (tc instanceof Function.Call)
                if (this.ctx.toolChoice.includes(tc.name)) {} else throw new ResponseInvalid('Invalid function call', { cause: toolCalls });
            else if (tc instanceof Tool.ApplyPatch.Call)
                if (this.ctx.toolChoice.includes(Tool.Choice.APPLY_PATCH)) {} else throw new ResponseInvalid('Invalid function call', { cause: toolCalls });
            else throw new Error();
        } else if (this.ctx.toolChoice === Function.ToolChoice.NONE)
            if (!toolCalls.length) {} else throw new ResponseInvalid('Invalid function call', { cause: toolCalls });
    }
}

export namespace OpenAIResponsesNativeToolCallValidator {
    export interface Context<fdm extends Function.Declaration.Map> {
        toolChoice: Tool.Choice<fdm>;
    }
}
