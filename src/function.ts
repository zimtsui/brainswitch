import { type Static, type TObject, type TSchema } from '@sinclair/typebox';

const NOMINAL = Symbol();

export interface Function<in out fd extends Function.Decl.Proto> {
    (params: Static<fd['parameters']>): Promise<string>;
}

export namespace Function {

    export namespace Name {
        export type From<
            fdm extends Function.Decl.Map.Proto,
        > = globalThis.Extract<keyof fdm, string>;
    }

    export type Extract<
        fdm extends Function.Decl.Map.Proto,
        nameu extends Function.Name.From<fdm>,
    > = Function.Of<Function.Decl.Extract<fdm, nameu>>;

    export type Of<
        fdu extends Function.Decl.Proto,
    > = fdu extends infer fd extends Function.Decl.Proto ? Function<fd> : never;

    export interface Decl<
        in out name extends string,
        in out params extends Function.Decl.Params.Proto,
    > extends Function.Decl.Body<params> {
        name: name;
    }

    export namespace Decl {
        export interface Proto extends Function.Decl.Body<Function.Decl.Params.Proto> {
            name: string
        }

        export type Args<params extends Params.Proto> = Static<params>;
        export namespace Params {
            export type Proto = TObject<Record<string, TSchema>>;
        }

        // export type Extract<
        //     fdm extends Function.Decl.Map.Proto,
        //     nameu extends Function.Name.From<fdm>,
        // > = {
        //     [name in Function.Name.From<fdm>]: Function.Decl<name, fdm[name]['parameters']>;
        // }[nameu];
        export type Extract<
            fdm extends Function.Decl.Map.Proto,
            nameu extends Function.Name.From<fdm>,
        > = nameu extends infer name extends Function.Name.From<fdm>
            ? Function.Decl<name, fdm[name]['parameters']>
            : never;

        export type From<
            fdm extends Function.Decl.Map.Proto,
        > = Function.Decl.Extract<fdm, Function.Name.From<fdm>>;

        export namespace Map {
            export type Proto = Record<string, Body.Prototype>;
        }

        export interface Body<
            in out params extends Function.Decl.Params.Proto,
        > {
            description?: string;
            parameters: params;
        }
        export namespace Body {
            export interface Prototype {
                description?: string;
                parameters: Function.Decl.Params.Proto;
            }
        }

        export type Entry<
            name extends string,
            params extends Function.Decl.Params.Proto,
        > = [name, Function.Decl.Body<params>];
        export namespace Entry {
            export type Of<
                fdu extends Function.Decl.Proto,
            > = fdu extends infer fd extends Function.Decl.Proto ? Entry<fd['name'], fd['parameters']> : never;
            export type From<
                fdm extends Function.Decl.Map.Proto,
            > = Function.Decl.Entry.Of<Function.Decl.From<fdm>>;
        }
    }

    export class Call<in out fd extends Function.Decl.Proto> {
        protected declare [NOMINAL]: never;
        public id?: string;
        public name: fd['name'];
        public args: Static<fd['parameters']>;
        protected constructor(fc: Omit<Call<fd>, never>) {
            this.id = fc.id;
            this.name = fc.name;
            this.args = fc.args;
        }
        public static of<fdu extends Function.Decl.Proto>(
            fc: Function.Call.Options.Of<fdu>,
        ): Function.Call.Of<fdu> {
            return new Function.Call(fc) as Function.Call.Of<fdu>;
        }

    }
    export namespace Call {
        export type Of<
            fdu extends Function.Decl.Proto,
        > = fdu extends infer fd extends Function.Decl.Proto ? Function.Call<fd> : never;
        export type From<
            fdm extends Function.Decl.Map.Proto,
        > = Function.Call.Of<Function.Decl.From<fdm>>;

        export type Options<fd extends Function.Decl.Proto> = Omit<Function.Call<fd>, never>;
        export namespace Options {
            export type Of<
                fdu extends Function.Decl.Proto,
            > = fdu extends infer fd extends Function.Decl.Proto ? Options<fd> : never;
            export type From<
                fdm extends Function.Decl.Map.Proto,
            > = Function.Call.Options.Of<Function.Decl.From<fdm>>;
        }

    }

    export class Response<in out fd extends Function.Decl.Proto> {
        protected declare [NOMINAL]: never;
        public id?: string;
        public name: fd['name'];
        public text: string;
        protected constructor(fr: Omit<Function.Response<fd>, never>) {
            this.id = fr.id;
            this.name = fr.name;
            this.text = fr.text;
        }
        public static of<fdu extends Function.Decl.Proto>(
            fr: Function.Response.Options.Of<fdu>,
        ): Function.Response.Of<fdu> {
            return new Function.Response(fr) as Function.Response.Of<fdu>;
        }
    }
    export namespace Response {
        export type Of<
            fdu extends Function.Decl.Proto,
        > = fdu extends infer fd extends Function.Decl.Proto ? Function.Response<fd> : never;
        export type From<
            fdm extends Function.Decl.Map.Proto,
        > = Function.Response.Of<Function.Decl.From<fdm>>;

        export type Options<fd extends Function.Decl.Proto> = Omit<Function.Response<fd>, never>;
        export namespace Options {
            export type Of<
                fdu extends Function.Decl.Proto,
            > = fdu extends infer fd extends Function.Decl.Proto ? Options<fd> : never;
            export type From<
                fdm extends Function.Decl.Map.Proto,
            > = Function.Response.Options.Of<Function.Decl.From<fdm>>;
        }
    }

    export type Map<fdm extends Function.Decl.Map.Proto> = {
        [name in Function.Name.From<fdm>]: Function<Function.Decl.Extract<fdm, name>>;
    };
}
