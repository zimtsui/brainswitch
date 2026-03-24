import { Structuring } from '#@/compatible/structuring.ts';
import type { Function } from '#@/function.ts';
import type { Verbatim } from '#@/verbatim.ts';
import Anthropic from '@anthropic-ai/sdk';


export function encode<
    fdu extends Function.Declaration.Prototype,
    vdu extends Verbatim.Declaration.Prototype,
>(
    choice: Structuring.Choice<fdu, vdu>,
    parallelToolCall: boolean,
): Anthropic.ToolChoice {

    if (choice === Structuring.Choice.NONE) return { type: 'none' };
    else if (choice === Structuring.Choice.REQUIRED) return { type: 'auto', disable_parallel_tool_use: !parallelToolCall };
    else if (choice === Structuring.Choice.ANYONE) return { type: 'auto', disable_parallel_tool_use: !parallelToolCall };
    else if (choice === Structuring.Choice.AUTO) return { type: 'auto', disable_parallel_tool_use: !parallelToolCall };

    else if (choice === Structuring.Choice.FCall.REQUIRED) return { type: 'any', disable_parallel_tool_use: !parallelToolCall };
    else if (choice === Structuring.Choice.FCall.ANYONE) return { type: 'any', disable_parallel_tool_use: !parallelToolCall };
    else if (choice instanceof Structuring.Choice.FCall)
        return { type: 'tool', name: choice.name, disable_parallel_tool_use: !parallelToolCall };

    else if (choice === Structuring.Choice.VMessage.REQUIRED) return { type: 'none' };
    else if (choice === Structuring.Choice.VMessage.ANYONE) return { type: 'none' };
    else if (choice instanceof Structuring.Choice.VMessage) return { type: 'none' };

    else throw new Error('Invalid structuring choice');
}
