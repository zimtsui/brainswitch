import { Structuring } from '#@/compatible/structuring.ts';
import type { Function } from '#@/function.ts';
import type { Verbatim } from '#@/verbatim.ts';
import * as Google from '@google/genai';


export function encode<
    fdu extends Function.Declaration.Prototype,
    vdu extends Verbatim.Declaration.Prototype,
>(
    choice: Structuring.Choice<fdu, vdu>,
): Google.FunctionCallingConfig {

    if (choice === Structuring.Choice.NONE) return { mode: Google.FunctionCallingConfigMode.NONE };
    else if (choice === Structuring.Choice.REQUIRED) return { mode: Google.FunctionCallingConfigMode.AUTO };
    else if (choice === Structuring.Choice.ANYONE) return { mode: Google.FunctionCallingConfigMode.AUTO };
    else if (choice === Structuring.Choice.AUTO) return { mode: Google.FunctionCallingConfigMode.AUTO };

    else if (choice === Structuring.Choice.FCall.REQUIRED) return { mode: Google.FunctionCallingConfigMode.ANY };
    else if (choice === Structuring.Choice.FCall.ANYONE) return { mode: Google.FunctionCallingConfigMode.ANY };
    else if (choice instanceof Structuring.Choice.FCall)
        return { mode: Google.FunctionCallingConfigMode.ANY, allowedFunctionNames: [choice.name] };

    else if (choice === Structuring.Choice.VMessage.REQUIRED) return { mode: Google.FunctionCallingConfigMode.NONE };
    else if (choice === Structuring.Choice.VMessage.ANYONE) return { mode: Google.FunctionCallingConfigMode.NONE };
    else if (choice instanceof Structuring.Choice.VMessage) return { mode: Google.FunctionCallingConfigMode.NONE };

    else throw new Error('Invalid structuring choice');
}
