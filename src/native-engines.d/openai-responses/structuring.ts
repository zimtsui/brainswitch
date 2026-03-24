import { Structuring as CompatibleStructuring } from '#@/compatible/structuring.ts';
import type { Function } from '#@/function.ts';
import type { Verbatim } from '#@/verbatim.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';


export namespace Structuring {
    export type Choice<
        fdu extends Function.Declaration.Prototype,
        vdu extends Verbatim.Declaration.Prototype,
    > =
        |   Structuring.Choice.TCall.FCall.Of<fdu>
        |   typeof Structuring.Choice.TCall.APPLY_PATCH
        |   typeof Structuring.Choice.TCall.REQUIRED
        |   typeof Structuring.Choice.TCall.ANYONE

        |   Structuring.Choice.VMessage.Of<vdu>
        |   typeof Structuring.Choice.VMessage.REQUIRED
        |   typeof Structuring.Choice.VMessage.ANYONE

        |   typeof Structuring.Choice.NONE
        |   typeof Structuring.Choice.AUTO
        |   typeof Structuring.Choice.REQUIRED
        |   typeof Structuring.Choice.ANYONE
    ;

    export namespace Choice {
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
            vdm extends Verbatim.Declaration.Map.Prototype,
        > = Structuring.Choice<Function.Declaration.From<fdm>, Verbatim.Declaration.From<vdm>>;

        export import REQUIRED = CompatibleStructuring.Choice.REQUIRED;
        export import ANYONE = CompatibleStructuring.Choice.ANYONE;

        export namespace TCall {
            export const REQUIRED = Symbol();
            export const ANYONE = Symbol();

            export import FCall = CompatibleStructuring.Choice.FCall;
            export const APPLY_PATCH = Tool.APPLY_PATCH;
        }

        export import VMessage = CompatibleStructuring.Choice.VMessage;
        export import NONE = CompatibleStructuring.Choice.NONE;
        export import AUTO = CompatibleStructuring.Choice.AUTO;
    }
}
