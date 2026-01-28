import { Function } from '../../function.ts';
import OpenAI from 'openai';


export namespace Tool {
    export type Name<fdm extends Function.Declaration.Map> =
        |   Function.Declaration.Map.NameOf<fdm>
        |   typeof Tool.Choice.APPLY_PATCH
    ;
    export type Map<fdm extends Function.Declaration.Map> = {
        [name in Name<fdm>]:
            name extends Function.Declaration.Map.NameOf<fdm>
                ? Function<Function.Declaration.From<fdm, name>>
            : name extends typeof Tool.Choice.APPLY_PATCH
                ? Tool.ApplyPatch
            : never;
    };

    export type Choice<fdm extends Function.Declaration.Map> =
        |   typeof Function.ToolChoice.NONE
        |   typeof Function.ToolChoice.REQUIRED
        |   typeof Function.ToolChoice.AUTO
        |   Tool.Name<fdm>[]
    ;
    export namespace Choice {
        export const APPLY_PATCH = Symbol();
    }

    export type Call<fdu extends Function.Declaration = never> =
        |   Function.Call.Distributive<fdu>
        |   ApplyPatch.Call
    ;

    export type Response<fdu extends Function.Declaration = never> =
        |   Function.Response.Distributive<fdu>
        |   ApplyPatch.Response
    ;

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
