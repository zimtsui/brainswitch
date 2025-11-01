import { type Static, type TSchema } from '@sinclair/typebox';


export interface Function<in out fd extends Function.Declaration> {
    (params: Static<fd['paraschema']>): Promise<string> | string;
}

export namespace Function {

    export interface Declaration<name extends string = string, ps extends TSchema = TSchema> extends Declaration.Item<ps> {
        name: name;
    }

    export namespace Declaration {
        export type From<fdm extends Map, name extends Map.NameOf<fdm> = Map.NameOf<fdm>> = {
            [name in Map.NameOf<fdm>]: Declaration<name, fdm[name]['paraschema']>;
        }[name];

        export type Map = Record<string, Item<TSchema>>;
        export namespace Map {
            export type NameOf<fdm extends Map> = Extract<keyof fdm, string>;
        }
        export interface Item<in out ps extends TSchema = TSchema> {
            description?: string;
            paraschema: ps;
        }
        export namespace Item {
            export type From<fdm extends Map, name extends Map.NameOf<fdm> = Map.NameOf<fdm>> = Item<fdm[name]['paraschema']>;
        }
        export type Entry<name extends string, ps extends TSchema> = [name, Item<ps>];
        export namespace Entry {
            export type From<fdm extends Map, name extends Map.NameOf<fdm> = Map.NameOf<fdm>> = Entry<name, fdm[name]['paraschema']>;
        }
    }

    export class Call<in out fd extends Declaration> {
        public static readonly CALL_NOMINAL = Symbol();
        private declare readonly [Call.CALL_NOMINAL]: void;
        public id?: string;
        public name: fd['name'];
        public args: Static<fd['paraschema']>;
        private constructor(fc: Omit<Call<fd>, never>) {
            this.id = fc.id;
            this.name = fc.name;
            this.args = fc.args;
        }
        public static create<fdu extends Declaration>(fc: Call.create.Options<fdu>): Call.Distributive<fdu> {
            return new Call(fc) as Call.Distributive<fdu>;
        }
        public static restore<fdu extends Declaration>(snapshot: Call.Snapshot.Distributive<fdu>): Call.Distributive<fdu> {
            return new Call(snapshot) as Call.Distributive<fdu>;
        }
        public static capture<fdu extends Declaration>(fc: Call.Distributive<fdu>): Call.Snapshot.Distributive<fdu> {
            return fc as Call.Snapshot.Distributive<fdu>;
        }
    }
    export namespace Call {
        export type Snapshot<fd extends Declaration> = Omit<Call<fd>, never>;
        export namespace Snapshot {
            export type Distributive<fdu extends Declaration> = fdu extends infer fd extends Declaration ? Snapshot<fd> : never;
        }
        export type Distributive<fdu extends Declaration> = fdu extends infer fd extends Declaration ? Call<fd> : never;
        export namespace create {
            export type Options<fdu extends Declaration> = fdu extends infer fd extends Function.Declaration ? Omit<Call<fd>, never> : never;
        }
    }

    export class Response<in out fd extends Declaration> {
        public static readonly RESPONSE_NOMINAL = Symbol();
        private declare readonly [Response.RESPONSE_NOMINAL]: void;
        public id?: string;
        public name: fd['name'];
        public text: string;
        private constructor(fr: Omit<Response<fd>, never>) {
            this.id = fr.id;
            this.name = fr.name;
            this.text = fr.text;
        }
        public static create<fdu extends Declaration>(fr: Response.create.Options<fdu>): Response.Distributive<fdu> {
            return new Response(fr) as Response.Distributive<fdu>;
        }
        public static capture<fdu extends Declaration>(response: Response.Distributive<fdu>): Response.Snapshot.Distributive<fdu> {
            return response as Response.Snapshot.Distributive<fdu>;
        }
        public static restore<fdu extends Declaration>(snapshot: Response.Snapshot.Distributive<fdu>): Response.Distributive<fdu> {
            return new Response(snapshot) as Response.Distributive<fdu>;
        }
    }
    export namespace Response {
        export type Snapshot<fd extends Declaration> = Omit<Response<fd>, never>;
        export namespace Snapshot {
            export type Distributive<fdu extends Declaration> = fdu extends infer fd extends Declaration ? Snapshot<fd> : never;
        }
        export type Distributive<fdu extends Declaration> = fdu extends infer fd extends Declaration ? Response<fd> : never;
        export namespace create {
            export type Options<fdu extends Declaration> = fdu extends infer fd extends Function.Declaration ? Omit<Response<fd>, never> : never;
        }
    }

    export type ToolChoice<fdm extends Function.Declaration.Map> =
        | Function.Declaration.Map.NameOf<fdm>[]
        | typeof ToolChoice.NONE
        | typeof ToolChoice.REQUIRED
        | typeof ToolChoice.AUTO;
    export namespace ToolChoice {
        export const NONE = Symbol();
        export const REQUIRED = Symbol();
        export const AUTO = Symbol();
    }

    export type Map<fdm extends Function.Declaration.Map> = {
        [name in Function.Declaration.Map.NameOf<fdm>]: Function<Function.Declaration.From<fdm, name>>;
    };
}
