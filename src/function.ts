import { type Static, type TObject, type TSchema } from '@sinclair/typebox';

const NOMINAL = Symbol();

export interface Function<in out fd extends Function.Declaration.Prototype> {
    (params: Static<fd['paraschema']>): Promise<string>;
}

export namespace Function {

    export namespace Name {
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Extract<keyof fdm, string>;
    }

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
            nameu extends Function.Name.From<fdm>,
        > = {
            [name in Function.Name.From<fdm>]: Function.Declaration<name, fdm[name]['paraschema']>;
        }[nameu];
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Function.Declaration.Extract<fdm, Function.Name.From<fdm>>;

        export namespace Map {
            export type Prototype = Record<string, Item<Function.Declaration.Paraschema.Prototype>>;
        }

        export interface Item<in out ps extends Function.Declaration.Paraschema.Prototype> {
            description?: string;
            paraschema: ps;
        }

        export type Entry<
            name extends string,
            ps extends Function.Declaration.Paraschema.Prototype,
        > = [name, Item<ps>];
        export namespace Entry {
            export type Of<
                fdu extends Function.Declaration.Prototype,
            > = fdu extends infer fd extends Function.Declaration.Prototype ? Entry<fd['name'], fd['paraschema']> : never;
            export type From<
                fdm extends Function.Declaration.Map.Prototype,
            > = Function.Declaration.Entry.Of<Function.Declaration.From<fdm>>;
        }
    }

    export class Call<in out fd extends Function.Declaration.Prototype> {
        protected declare [NOMINAL]: void;
        public id?: string;
        public name: fd['name'];
        public args: Static<fd['paraschema']>;
        protected constructor(fc: Omit<Call<fd>, never>) {
            this.id = fc.id;
            this.name = fc.name;
            this.args = fc.args;
        }
        public static of<fdu extends Function.Declaration.Prototype>(fc: Call.Options.Of<fdu>): Call.Of<fdu> {
            return new Call(fc) as Call.Of<fdu>;
        }

        public static validate<fdu extends Function.Declaration.Prototype>(
            toolCalls: Function.Call.Of<fdu>[],
            toolChoice: Function.ToolChoice<fdu>,
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
    export namespace Call {
        export type Of<
            fdu extends Function.Declaration.Prototype,
        > = fdu extends infer fd extends Function.Declaration.Prototype ? Call<fd> : never;
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Function.Call.Of<Function.Declaration.From<fdm>>;

        export type Options<fd extends Function.Declaration.Prototype> = Omit<Call<fd>, never>;
        export namespace Options {
            export type Of<
                fdu extends Function.Declaration.Prototype,
            > = fdu extends infer fd extends Function.Declaration.Prototype ? Options<fd> : never;
            export type From<
                fdm extends Function.Declaration.Map.Prototype,
            > = Function.Call.Options.Of<Function.Declaration.From<fdm>>;
        }

    }

    export class Response<in out fd extends Function.Declaration.Prototype> {
        protected declare [NOMINAL]: void;
        public id?: string;
        public name: fd['name'];
        public text: string;
        protected constructor(fr: Omit<Response<fd>, never>) {
            this.id = fr.id;
            this.name = fr.name;
            this.text = fr.text;
        }
        public static of<fdu extends Function.Declaration.Prototype>(fr: Response.Options.Of<fdu>): Response.Of<fdu> {
            return new Response(fr) as Response.Of<fdu>;
        }
    }
    export namespace Response {
        export type Of<
            fdu extends Function.Declaration.Prototype,
        > = fdu extends infer fd extends Function.Declaration.Prototype ? Response<fd> : never;
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Function.Response.Of<Function.Declaration.From<fdm>>;

        export type Options<fd extends Function.Declaration.Prototype> = Omit<Response<fd>, never>;
        export namespace Options {
            export type Of<
                fdu extends Function.Declaration.Prototype,
            > = fdu extends infer fd extends Function.Declaration.Prototype ? Options<fd> : never;
            export type From<
                fdm extends Function.Declaration.Map.Prototype,
            > = Function.Response.Options.Of<Function.Declaration.From<fdm>>;
        }
    }

    export type ToolChoice<fdu extends Function.Declaration.Prototype> =
        | fdu['name'][]
        | typeof ToolChoice.NONE
        | typeof ToolChoice.REQUIRED
        | typeof ToolChoice.AUTO;
    export namespace ToolChoice {
        export const NONE = Symbol();
        export const REQUIRED = Symbol();
        export const AUTO = Symbol();

        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Function.ToolChoice<Function.Declaration.From<fdm>>;
    }

    export type Map<fdm extends Function.Declaration.Map.Prototype> = {
        [name in Function.Name.From<fdm>]: Function<Function.Declaration.Extract<fdm, name>>;
    };
}
