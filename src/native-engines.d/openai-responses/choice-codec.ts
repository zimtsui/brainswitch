import { Structuring } from '#@/native-engines.d/openai-responses/structuring.ts';
import type { Function } from '#@/function.ts';
import type { Verbatim } from '#@/verbatim.ts';
import type { OpenAI } from 'openai';



export function encode<
    fdu extends Function.Decl.Proto,
    vdu extends Verbatim.Decl.Proto,
>(
    choice: Structuring.Choice<fdu, vdu>,
): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
    if (choice === Structuring.Choice.NONE) return 'none';
    else if (choice === Structuring.Choice.REQUIRED) return 'auto';
    else if (choice === Structuring.Choice.ANYONE) return 'auto';
    else if (choice === Structuring.Choice.AUTO) return 'auto';

    else if (choice === Structuring.Choice.TCall.REQUIRED) return 'required';
    else if (choice === Structuring.Choice.TCall.ANYONE) return 'required';
    else if (choice instanceof Structuring.Choice.TCall.FCall)
        return {
            type: 'allowed_tools',
            mode: 'required',
            tools: [{ type: 'function', name: choice.name }] satisfies OpenAI.Responses.ToolChoiceFunction[],
        };

    else if (choice === Structuring.Choice.VMessage.REQUIRED) return 'none';
    else if (choice === Structuring.Choice.VMessage.ANYONE) return 'none';
    else if (choice instanceof Structuring.Choice.VMessage) return 'none';

    else throw new Error();
}
