import { Function } from '#@/function.ts';
import { ResponseInvalid } from '#@/engine.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';



export class OpenAIResponsesNativeToolCallValidator<in out fdu extends Function.Declaration.Prototype> {
    public constructor(protected ctx: OpenAIResponsesNativeToolCallValidator.Context<fdu>) {}

    public validate(
        toolCalls: Tool.Call.Of<fdu>[],
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
    export type From<
        fdm extends Function.Declaration.Map.Prototype,
    > = OpenAIResponsesNativeToolCallValidator<Function.Declaration.From<fdm>>;
    export interface Context<fdu extends Function.Declaration.Prototype> {
        toolChoice: Tool.Choice<fdu>;
    }
}
