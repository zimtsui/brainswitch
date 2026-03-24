import { Function } from '#@/function.ts';
import OpenAI from 'openai';


export namespace Tool {
    export const APPLY_PATCH = Symbol();

    export namespace Name {
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Function.Name.From<fdm> | typeof Tool.APPLY_PATCH;
    }

    export type Map<fdm extends Function.Declaration.Map.Prototype> = {
        [name in Tool.Name.From<fdm>]:
            name extends typeof Tool.APPLY_PATCH
                ? Tool.ApplyPatch
            : name extends Function.Name.From<fdm>
                ? Function.Extract<fdm, name>
            : never;
    };


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
        (operation: ApplyPatch.Operation): Promise<string>;
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
            public constructor(public raw: OpenAI.Responses.ResponseApplyPatchToolCall) {}
        }

        export class Response {
            public id: string;
            public failure: string;
            public constructor(apr: Omit<ApplyPatch.Response, never>) {
                this.id = apr.id;
                this.failure = apr.failure;
            }
        }

    }


}
