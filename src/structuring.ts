import { Function } from '#@/function.ts';
import { Verbatim } from '#@/verbatim.ts';

const NOMINAL = Symbol();

export namespace Structuring {

    export type Choice<
        fdu extends Function.Declaration.Prototype,
        vdu extends Verbatim.Declaration.Prototype,
    > =
        |   Structuring.Choice.FCall.Of<fdu>
        |   typeof Structuring.Choice.FCall.REQUIRED
        |   Structuring.Choice.VMessage.Of<vdu>
        |   typeof Structuring.Choice.VMessage.REQUIRED
        |   typeof Structuring.Choice.NONE
        |   typeof Structuring.Choice.AUTO
        |   typeof Structuring.Choice.REQUIRED
    ;

    export namespace Choice {
        export const REQUIRED = Symbol();

        export class FCall<fd extends Function.Declaration.Prototype> {
            protected declare [NOMINAL]: void;
            public constructor(public name: fd['name']) {}
        }
        export namespace FCall {
            export type Of<
                fdu extends Function.Declaration.Prototype,
            > = fdu extends infer fd extends Function.Declaration.Prototype ? FCall<fd> : never;
            export type From<
                fdm extends Function.Declaration.Map.Prototype,
            > = Structuring.Choice.FCall.Of<Function.Declaration.From<fdm>>;
            export const REQUIRED = Symbol();
        }
        export class VMessage<vd extends Verbatim.Declaration.Prototype> {
            protected declare [NOMINAL]: void;
            public constructor(public name: vd['name']) {}
        }
        export namespace VMessage {
            export type Of<
                vdu extends Verbatim.Declaration.Prototype,
            > = vdu extends infer vd extends Verbatim.Declaration.Prototype ? VMessage<vd> : never;
            export type From<
                vdm extends Verbatim.Declaration.Map.Prototype,
            > = Structuring.Choice.VMessage.Of<Verbatim.Declaration.From<vdm>>;
            export const REQUIRED = Symbol();
        }
        export const NONE = Symbol();
        export const AUTO = Symbol();
    }
}
