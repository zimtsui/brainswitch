import { Structuring } from '../../compatible-engine/structuring.ts';
import type { Function } from '../../function.ts';
import type { Verbatim } from '../../verbatim.ts';
import * as Google from '@google/genai';


export function encode<
    fdu extends Function.Decl.Proto,
    vdu extends Verbatim.Decl.Proto,
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

    else if (choice === Structuring.Choice.VRequest.REQUIRED) return { mode: Google.FunctionCallingConfigMode.NONE };
    else if (choice === Structuring.Choice.VRequest.ANYONE) return { mode: Google.FunctionCallingConfigMode.NONE };
    else if (choice instanceof Structuring.Choice.VRequest) return { mode: Google.FunctionCallingConfigMode.NONE };

    else throw new Error('Invalid structuring choice');
}
