import { Function } from '#@/function.ts';
import OpenAI from 'openai';


export namespace Tool {
    export type Map<fdm extends Function.Declaration.Map.Prototype> = {
        [name in Tool.Map.NameOf<fdm>]:
            name extends Function.Declaration.Map.NameOf<fdm>
                ? Function<Function.Declaration.Extract<fdm, name>>
            : name extends typeof Tool.Choice.APPLY_PATCH
                ? Tool.ApplyPatch
            : never;
    };
    export namespace Map {
        export type NameOf<
            fdm extends Function.Declaration.Map.Prototype,
        > = Function.Declaration.Map.NameOf<fdm> | typeof Tool.Choice.APPLY_PATCH;
    }

    export type Choice<fdu extends Function.Declaration.Prototype> =
        |   (fdu['name'] | typeof Tool.Choice.APPLY_PATCH)[]
        |   typeof Function.ToolChoice.NONE
        |   typeof Function.ToolChoice.REQUIRED
        |   typeof Function.ToolChoice.AUTO
    ;
    export namespace Choice {
        export const APPLY_PATCH = Symbol();
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Choice<Function.Declaration.From<fdm>>;
    }

    export namespace Call {
        export type Of<fdu extends Function.Declaration.Prototype> =
            |   Function.Call.Of<fdu>
            |   ApplyPatch.Call
        ;
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Call.Of<Function.Declaration.From<fdm>>;
    }

    export namespace Response {
        export type Of<fdu extends Function.Declaration.Prototype> =
            |   Function.Response.Of<fdu>
            |   ApplyPatch.Response
        ;
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Response.Of<Function.Declaration.From<fdm>>;
    }

    export interface ApplyPatch {
        /**
         * @returns empty string on success
         */
        (operation: ApplyPatch.Operation): string;
    }
    export namespace ApplyPatch {
        export type Operation = Operation.UpdateFile | Operation.CreateFile | Operation.DeleteFile;
        export namespace Operation {
            export interface UpdateFile {
                type: 'update_file';
                diff: string;
                path: string;
            }
            export interface CreateFile {
                type: 'create_file';
                diff: string;
                path: string;
            }
            export interface DeleteFile {
                type: 'delete_file';
                path: string;
            }
        }
    }
    export namespace ApplyPatch {

        export class Call {
            public static create(raw: OpenAI.Responses.ResponseApplyPatchToolCall): ApplyPatch.Call {
                return new ApplyPatch.Call(raw);
            }
            public constructor(public raw: OpenAI.Responses.ResponseApplyPatchToolCall) {}
        }

        export class Response {
            public id: string;
            public failure: string;
            public static create(apr: Omit<ApplyPatch.Response, never>): ApplyPatch.Response {
                return new ApplyPatch.Response(apr);
            }
            public constructor(apr: Omit<ApplyPatch.Response, never>) {
                this.id = apr.id;
                this.failure = apr.failure;
            }
        }

    }


}
