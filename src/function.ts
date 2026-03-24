import { type Static, type TObject, type TSchema } from '@sinclair/typebox';

const NOMINAL = Symbol();

export interface Function<in out fd extends Function.Declaration.Prototype> {
    (params: Static<fd['paraschema']>): Promise<string>;
}

export namespace Function {

    export namespace Name {
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = globalThis.Extract<keyof fdm, string>;
    }

    export type Extract<
        fdm extends Function.Declaration.Map.Prototype,
        nameu extends Function.Name.From<fdm>,
    > = Function.Of<Function.Declaration.Extract<fdm, nameu>>;

    export type Of<
        fdu extends Function.Declaration.Prototype,
    > = fdu extends infer fd extends Function.Declaration.Prototype ? Function<fd> : never;

    export interface Declaration<
        in out name extends string,
        in out ps extends Function.Declaration.Paraschema.Prototype,
    > extends Function.Declaration.Item<ps> {
        name: name;
    }

    export namespace Declaration {
        export interface Prototype extends Function.Declaration.Item<Function.Declaration.Paraschema.Prototype> {
            name: string
        }

        export namespace Paraschema {
            export type Prototype = TObject<Record<string, TSchema>>;
        }

        // export type Extract<
        //     fdm extends Function.Declaration.Map.Prototype,
        //     nameu extends Function.Name.From<fdm>,
        // > = {
        //     [name in Function.Name.From<fdm>]: Function.Declaration<name, fdm[name]['paraschema']>;
        // }[nameu];
        export type Extract<
            fdm extends Function.Declaration.Map.Prototype,
            nameu extends Function.Name.From<fdm>,
        > = nameu extends infer name extends Function.Name.From<fdm>
            ? Function.Declaration<name, fdm[name]['paraschema']>
            : never;

        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Function.Declaration.Extract<fdm, Function.Name.From<fdm>>;

        export namespace Map {
            export type Prototype = Record<string, Item.Prototype>;
        }

        export interface Item<
            in out ps extends Function.Declaration.Paraschema.Prototype,
        > {
            description?: string;
            paraschema: ps;
        }
        export namespace Item {
            export interface Prototype {
                description?: string;
                paraschema: Function.Declaration.Paraschema.Prototype;
            }
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
        protected declare [NOMINAL]: never;
        public id?: string;
        public name: fd['name'];
        public args: Static<fd['paraschema']>;
        protected constructor(fc: Omit<Call<fd>, never>) {
            this.id = fc.id;
            this.name = fc.name;
            this.args = fc.args;
        }
        public static of<fdu extends Function.Declaration.Prototype>(
            fc: Function.Call.Options.Of<fdu>,
        ): Function.Call.Of<fdu> {
            return new Function.Call(fc) as Function.Call.Of<fdu>;
        }

    }
    export namespace Call {
        export type Of<
            fdu extends Function.Declaration.Prototype,
        > = fdu extends infer fd extends Function.Declaration.Prototype ? Function.Call<fd> : never;
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Function.Call.Of<Function.Declaration.From<fdm>>;

        export type Options<fd extends Function.Declaration.Prototype> = Omit<Function.Call<fd>, never>;
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
        protected declare [NOMINAL]: never;
        public id?: string;
        public name: fd['name'];
        public text: string;
        protected constructor(fr: Omit<Function.Response<fd>, never>) {
            this.id = fr.id;
            this.name = fr.name;
            this.text = fr.text;
        }
        public static of<fdu extends Function.Declaration.Prototype>(
            fr: Function.Response.Options.Of<fdu>,
        ): Function.Response.Of<fdu> {
            return new Function.Response(fr) as Function.Response.Of<fdu>;
        }
    }
    export namespace Response {
        export type Of<
            fdu extends Function.Declaration.Prototype,
        > = fdu extends infer fd extends Function.Declaration.Prototype ? Function.Response<fd> : never;
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = Function.Response.Of<Function.Declaration.From<fdm>>;

        export type Options<fd extends Function.Declaration.Prototype> = Omit<Function.Response<fd>, never>;
        export namespace Options {
            export type Of<
                fdu extends Function.Declaration.Prototype,
            > = fdu extends infer fd extends Function.Declaration.Prototype ? Options<fd> : never;
            export type From<
                fdm extends Function.Declaration.Map.Prototype,
            > = Function.Response.Options.Of<Function.Declaration.From<fdm>>;
        }
    }

    export type Map<fdm extends Function.Declaration.Map.Prototype> = {
        [name in Function.Name.From<fdm>]: Function<Function.Declaration.Extract<fdm, name>>;
    };
}
