import { Function } from '#@/function.ts';
import { Verbatim } from '#@/verbatim.ts';

const NOMINAL = Symbol();

export namespace Structuring {

    export type Choice<
        fdu extends Function.Decl.Proto,
        vdu extends Verbatim.Decl.Proto,
    > =
        |   Structuring.Choice.FCall.Of<fdu>
        |   typeof Structuring.Choice.FCall.REQUIRED
        |   typeof Structuring.Choice.FCall.ANYONE

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


        export const REQUIRED = Symbol();
        export const ANYONE = Symbol();

        export class FCall<fd extends Function.Decl.Proto> {
            protected declare [NOMINAL]: never;
            public constructor(public name: fd['name']) {}
        }
        export namespace FCall {
            export type Of<
                fdu extends Function.Decl.Proto,
            > = fdu extends infer fd extends Function.Decl.Proto ? Structuring.Choice.FCall<fd> : never;

            export type From<
                fdm extends Function.Decl.Map.Proto,
            > = Structuring.Choice.FCall.Of<Function.Decl.From<fdm>>;

            export const REQUIRED = Symbol();
            export const ANYONE = Symbol();
        }
        export class VRequest<vd extends Verbatim.Decl.Proto> {
            protected declare [NOMINAL]: never;
            public constructor(public name: vd['name']) {}
        }
        export namespace VRequest {
            export type Of<
                vdu extends Verbatim.Decl.Proto,
            > = vdu extends infer vd extends Verbatim.Decl.Proto ? Structuring.Choice.VRequest<vd> : never;
            export type From<
                vdm extends Verbatim.Decl.Map.Proto,
            > = Structuring.Choice.VRequest.Of<Verbatim.Decl.From<vdm>>;
            export const REQUIRED = Symbol();
            export const ANYONE = Symbol();
        }

        export const NONE = Symbol();
        export const AUTO = Symbol();
    }
}
