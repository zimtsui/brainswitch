import { Function } from '#@/function.ts';
import OpenAI from 'openai';


export namespace Tool {
    export const APPLY_PATCH = Symbol();

    export namespace Name {
        export type From<
            fdm extends Function.Decl.Map.Proto,
        > = Function.Name.From<fdm> | typeof Tool.APPLY_PATCH;
    }

    export type Map<fdm extends Function.Decl.Map.Proto> = {
        [name in Tool.Name.From<fdm>]:
            name extends typeof Tool.APPLY_PATCH
                ? Tool.ApplyPatch
            : name extends Function.Name.From<fdm>
                ? Function.Extract<fdm, name>
            : never;
    };


    export namespace Call {
        export type Of<fdu extends Function.Decl.Proto> =
            |   Function.Call.Of<fdu>
            |   ApplyPatch.Call
        ;
        export type From<
            fdm extends Function.Decl.Map.Proto,
        > = Call.Of<Function.Decl.From<fdm>>;
    }

    export namespace Response {
        export type Of<fdu extends Function.Decl.Proto> =
            |   Function.Response.Of<fdu>
            |   ApplyPatch.Response
        ;
        export type From<
            fdm extends Function.Decl.Map.Proto,
        > = Response.Of<Function.Decl.From<fdm>>;
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
