import { Structuring as CompatibleStructuring } from '#@/compatible/structuring.ts';
import type { Function } from '#@/function.ts';
import type { Verbatim } from '#@/verbatim.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';


export namespace Structuring {
    export type Choice<
        fdu extends Function.Decl.Proto,
        vdu extends Verbatim.Decl.Proto,
    > =
        |   Structuring.Choice.TCall.FCall.Of<fdu>
        |   typeof Structuring.Choice.TCall.APPLY_PATCH
        |   typeof Structuring.Choice.TCall.REQUIRED
        |   typeof Structuring.Choice.TCall.ANYONE

        |   Structuring.Choice.VRequest.Of<vdu>
        |   typeof Structuring.Choice.VRequest.REQUIRED
        |   typeof Structuring.Choice.VRequest.ANYONE

        |   typeof Structuring.Choice.NONE
        |   typeof Structuring.Choice.AUTO
        |   typeof Structuring.Choice.REQUIRED
        |   typeof Structuring.Choice.ANYONE
    ;

    export namespace Choice {
        export type From<
            fdm extends Function.Decl.Map.Proto,
            vdm extends Verbatim.Decl.Map.Proto,
        > = Structuring.Choice<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>;

        export import REQUIRED = CompatibleStructuring.Choice.REQUIRED;
        export import ANYONE = CompatibleStructuring.Choice.ANYONE;

        export namespace TCall {
            export const REQUIRED = Symbol();
            export const ANYONE = Symbol();

            export import FCall = CompatibleStructuring.Choice.FCall;
            export const APPLY_PATCH = Tool.APPLY_PATCH;
        }

        export import VRequest = CompatibleStructuring.Choice.VRequest;
        export import NONE = CompatibleStructuring.Choice.NONE;
        export import AUTO = CompatibleStructuring.Choice.AUTO;
    }
}
