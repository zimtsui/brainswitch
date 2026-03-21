import { type Static, type TSchema } from '@sinclair/typebox';


export interface Function<in out fd extends Function.Declaration> {
    (params: Static<fd['paraschema']>): Promise<string> | string;
}

export namespace Function {

    export interface Declaration<name extends string = string, ps extends TSchema = TSchema> extends Declaration.Item<ps> {
        name: name;
    }

    export namespace Declaration {
        export type ExtractFrom<fdm extends Map, nameu extends Map.NameOf<fdm>> = {
            [name in Map.NameOf<fdm>]: Declaration<name, fdm[name]['paraschema']>;
        }[nameu];
        export type From<fdm extends Map> = Function.Declaration.ExtractFrom<fdm, Map.NameOf<fdm>>;

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
        public static readonly NOMINAL = Symbol();
        private declare readonly [Call.NOMINAL]: void;
        public id?: string;
        public name: fd['name'];
        public args: Static<fd['paraschema']>;
        private constructor(fc: Omit<Call<fd>, never>) {
            this.id = fc.id;
            this.name = fc.name;
            this.args = fc.args;
        }
        public static create<fdm extends Declaration.Map>(fc: Call.create.Options<fdm>): Call.From<fdm> {
            return new Call(fc) as Call.From<fdm>;
        }
        public static restore<fdm extends Declaration.Map>(snapshot: Call.Snapshot.Distributive<fdm>): Call.From<fdm> {
            return new Call(snapshot) as Call.From<fdm>;
        }
        public static capture<fdm extends Declaration.Map>(fc: Call.From<fdm>): Call.Snapshot.Distributive<fdm> {
            return fc as Call.Snapshot.Distributive<fdm>;
        }
    }
    export namespace Call {
        export type From<fdm extends Declaration.Map> = {
            [name in Declaration.Map.NameOf<fdm>]: Call<Declaration.ExtractFrom<fdm, name>>;
        }[Declaration.Map.NameOf<fdm>];

        export type Snapshot<fd extends Declaration> = Omit<Call<fd>, never>;
        export namespace Snapshot {
            export type Distributive<fdm extends Declaration.Map> = {
                [name in Declaration.Map.NameOf<fdm>]: Snapshot<Declaration.ExtractFrom<fdm, name>>;
            }[Declaration.Map.NameOf<fdm>];
        }
        export namespace create {
            export type Options<fdm extends Declaration.Map> = {
                [name in Declaration.Map.NameOf<fdm>]: Omit<Call<Declaration.ExtractFrom<fdm, name>>, never>;
            }[Declaration.Map.NameOf<fdm>];
        }

        export function validate<fdm extends Function.Declaration.Map>(
            toolCalls: Function.Call.From<fdm>[],
            toolChoice: Function.ToolChoice<fdm>,
            e: Error,
        ): void {
            if (toolChoice === Function.ToolChoice.REQUIRED)
                if (toolCalls.length) {} else throw e;
            else if (toolChoice instanceof Array) for (const fc of toolCalls) {
                if (toolChoice.includes(fc.name)) {} else throw e;
            } else if (toolChoice === Function.ToolChoice.NONE)
                if (!toolCalls.length) {} else throw e;
        }
    }

    export class Response<in out fd extends Declaration> {
        public static readonly NOMINAL = Symbol();
        private declare readonly [Response.NOMINAL]: void;
        public id?: string;
        public name: fd['name'];
        public text: string;
        private constructor(fr: Omit<Response<fd>, never>) {
            this.id = fr.id;
            this.name = fr.name;
            this.text = fr.text;
        }
        public static create<fdm extends Declaration.Map>(fr: Response.create.Options<fdm>): Response.Distributive<fdm> {
            return new Response(fr) as Response.Distributive<fdm>;
        }
        public static capture<fdm extends Declaration.Map>(response: Response.Distributive<fdm>): Response.Snapshot.Distributive<fdm> {
            return response as Response.Snapshot.Distributive<fdm>;
        }
        public static restore<fdm extends Declaration.Map>(snapshot: Response.Snapshot.Distributive<fdm>): Response.Distributive<fdm> {
            return new Response(snapshot) as Response.Distributive<fdm>;
        }
    }
    export namespace Response {
        export type Snapshot<fd extends Declaration> = Omit<Response<fd>, never>;
        export namespace Snapshot {
            export type Distributive<fdm extends Declaration.Map> = {
                [name in Declaration.Map.NameOf<fdm>]: Snapshot<Declaration.ExtractFrom<fdm, name>>;
            }[Declaration.Map.NameOf<fdm>];
        }
        export type Distributive<fdm extends Declaration.Map> = {
            [name in Declaration.Map.NameOf<fdm>]: Response<Declaration.ExtractFrom<fdm, name>>;
        }[Declaration.Map.NameOf<fdm>];
        export namespace create {
            export type Options<fdm extends Declaration.Map> = {
                [name in Declaration.Map.NameOf<fdm>]: Omit<Response<Declaration.ExtractFrom<fdm, name>>, never>;
            }[Declaration.Map.NameOf<fdm>];
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
        [name in Function.Declaration.Map.NameOf<fdm>]: Function<Function.Declaration.ExtractFrom<fdm, name>>;
    };
}
