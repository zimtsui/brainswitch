import { type Static, type TObject, type TSchema } from '@sinclair/typebox';


export interface Function<in out fd extends Function.Declaration.Prototype> {
    (params: Static<fd['paraschema']>): Promise<string>;
}

export namespace Function {

    export interface Declaration<
        name extends string,
        ps extends Function.Declaration.Paraschema.Prototype,
    > extends Declaration.Item<ps> {
        name: name;
    }

    export namespace Declaration {
        export type Prototype = Function.Declaration<string, Function.Declaration.Paraschema.Prototype>;

        export namespace Paraschema {
            export type Prototype = TObject<Record<string, TSchema>>;
        }

        export type Extract<
            fdm extends Function.Declaration.Map.Prototype,
            nameu extends Function.Declaration.Map.NameOf<fdm>,
        > = {
            [name in Function.Declaration.Map.NameOf<fdm>]: Function.Declaration<name, fdm[name]['paraschema']>;
        }[nameu];
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Function.Declaration.Extract<fdm, Function.Declaration.Map.NameOf<fdm>>;

        export namespace Map {
            export type Prototype = Record<string, Item<Function.Declaration.Paraschema.Prototype>>;
            export type NameOf<
                fdm extends Function.Declaration.Map.Prototype,
            > = globalThis.Extract<keyof fdm, string>;
        }
        export interface Item<in out ps extends Function.Declaration.Paraschema.Prototype> {
            description?: string;
            paraschema: ps;
        }
        export namespace Item {
            export type Extract<
                fdm extends Function.Declaration.Map.Prototype,
                name extends Function.Declaration.Map.NameOf<fdm>,
            > = Item<fdm[name]['paraschema']>;
            export type From<
                fdm extends Function.Declaration.Map.Prototype,
            > = Function.Declaration.Item.Extract<fdm, Function.Declaration.Map.NameOf<fdm>>;
        }
        export type Entry<
            name extends string,
            ps extends Function.Declaration.Paraschema.Prototype,
        > = [name, Item<ps>];
        export namespace Entry {
            export type Extract<
                fdm extends Function.Declaration.Map.Prototype,
                name extends Function.Declaration.Map.NameOf<fdm>,
            > = Entry<name, fdm[name]['paraschema']>;
            export type From<
                fdm extends Function.Declaration.Map.Prototype,
            > = Entry<
                Function.Declaration.Map.NameOf<fdm>,
                fdm[Function.Declaration.Map.NameOf<fdm>]['paraschema']
            >;
        }
    }

    export class Call<in out fd extends Function.Declaration.Prototype> {
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
        public static create<fdm extends Function.Declaration.Map.Prototype>(fc: Call.create.Options<fdm>): Call.From<fdm> {
            return new Call(fc) as Call.From<fdm>;
        }
        public static restore<fdm extends Function.Declaration.Map.Prototype>(snapshot: Call.Snapshot.Distributive<fdm>): Call.From<fdm> {
            return new Call(snapshot) as Call.From<fdm>;
        }
        public static capture<fdm extends Function.Declaration.Map.Prototype>(fc: Call.From<fdm>): Call.Snapshot.Distributive<fdm> {
            return fc as Call.Snapshot.Distributive<fdm>;
        }
    }
    export namespace Call {
        export type From<fdm extends Function.Declaration.Map.Prototype> = {
            [name in Function.Declaration.Map.NameOf<fdm>]: Call<Function.Declaration.Extract<fdm, name>>;
        }[Function.Declaration.Map.NameOf<fdm>];

        export type Snapshot<fd extends Function.Declaration.Prototype> = Omit<Call<fd>, never>;
        export namespace Snapshot {
            export type Distributive<fdm extends Function.Declaration.Map.Prototype> = {
                [name in Function.Declaration.Map.NameOf<fdm>]: Snapshot<Function.Declaration.Extract<fdm, name>>;
            }[Function.Declaration.Map.NameOf<fdm>];
        }
        export namespace create {
            export type Options<fdm extends Function.Declaration.Map.Prototype> = {
                [name in Function.Declaration.Map.NameOf<fdm>]: Omit<Call<Function.Declaration.Extract<fdm, name>>, never>;
            }[Function.Declaration.Map.NameOf<fdm>];
        }

        export function validate<fdm extends Function.Declaration.Map.Prototype>(
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

    export class Response<in out fd extends Function.Declaration.Prototype> {
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
        public static create<fdm extends Function.Declaration.Map.Prototype>(fr: Response.create.Options<fdm>): Response.From<fdm> {
            return new Response(fr) as Response.From<fdm>;
        }
        public static capture<fdm extends Function.Declaration.Map.Prototype>(response: Response.From<fdm>): Response.Snapshot.Distributive<fdm> {
            return response as Response.Snapshot.Distributive<fdm>;
        }
        public static restore<fdm extends Function.Declaration.Map.Prototype>(snapshot: Response.Snapshot.Distributive<fdm>): Response.From<fdm> {
            return new Response(snapshot) as Response.From<fdm>;
        }
    }
    export namespace Response {
        export type Snapshot<fd extends Function.Declaration.Prototype> = Omit<Response<fd>, never>;
        export namespace Snapshot {
            export type Distributive<fdm extends Function.Declaration.Map.Prototype> = {
                [name in Function.Declaration.Map.NameOf<fdm>]: Snapshot<Function.Declaration.Extract<fdm, name>>;
            }[Function.Declaration.Map.NameOf<fdm>];
        }
        export type From<fdm extends Function.Declaration.Map.Prototype> = {
            [name in Function.Declaration.Map.NameOf<fdm>]: Response<Function.Declaration.Extract<fdm, name>>;
        }[Function.Declaration.Map.NameOf<fdm>];
        export namespace create {
            export type Options<fdm extends Function.Declaration.Map.Prototype> = {
                [name in Function.Declaration.Map.NameOf<fdm>]: Omit<Response<Function.Declaration.Extract<fdm, name>>, never>;
            }[Function.Declaration.Map.NameOf<fdm>];
        }
    }

    export type ToolChoice<fdm extends Function.Declaration.Map.Prototype> =
        | Function.Declaration.Map.NameOf<fdm>[]
        | typeof ToolChoice.NONE
        | typeof ToolChoice.REQUIRED
        | typeof ToolChoice.AUTO;
    export namespace ToolChoice {
        export const NONE = Symbol();
        export const REQUIRED = Symbol();
        export const AUTO = Symbol();
    }

    export type Map<fdm extends Function.Declaration.Map.Prototype> = {
        [name in Function.Declaration.Map.NameOf<fdm>]: Function<Function.Declaration.Extract<fdm, name>>;
    };
}
