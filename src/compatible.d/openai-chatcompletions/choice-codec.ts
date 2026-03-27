import type { Function } from '../../function.ts';
import type { Verbatim } from '../../verbatim.ts';
import OpenAI from 'openai';
import { Structuring } from '../../compatible/structuring.ts';


export function encode<
    fdu extends Function.Decl.Proto,
    vdu extends Verbatim.Decl.Proto,
>(
    choice: Structuring.Choice<fdu, vdu>,
): OpenAI.ChatCompletionToolChoiceOption {

    if (choice === Structuring.Choice.NONE) return 'none';
    else if (choice === Structuring.Choice.REQUIRED) return 'auto';
    else if (choice === Structuring.Choice.ANYONE) return 'auto';
    else if (choice === Structuring.Choice.AUTO) return 'auto';

    else if (choice === Structuring.Choice.FCall.REQUIRED) return 'required';
    else if (choice === Structuring.Choice.FCall.ANYONE) return 'required';
    else if (choice instanceof Structuring.Choice.FCall)
        return {
            type: 'function',
            function: {
                name: choice.name,
            },
        };

    else if (choice === Structuring.Choice.VRequest.REQUIRED) return 'none';
    else if (choice === Structuring.Choice.VRequest.ANYONE) return 'none';
    else if (choice instanceof Structuring.Choice.VRequest) return 'none';

    else throw new Error();
}
