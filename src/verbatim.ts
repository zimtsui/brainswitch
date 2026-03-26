
const NOMINAL = Symbol();


export namespace Verbatim {

    export namespace Name {
        export type From<
            fdm extends Verbatim.Decl.Map.Proto,
        > = globalThis.Extract<keyof fdm, string>;
    }

    export interface Decl<
        in out name extends string,
        in out params extends Decl.Params.Proto,
    > extends Verbatim.Decl.Body<params> {
        name: name;
    }

    export namespace Decl {
        export interface Proto extends Verbatim.Decl.Body.Proto {
            name: string;
        }

        export type Args<parameters extends Params.Proto> = {
            [name in keyof parameters]: string;
        }
        export namespace Params {
            export type Proto = Record<string, Para.Body>;
        }
        export namespace Para {
            export interface Body {
                description: string;
                mimeType: string;
            }
        }

        export type Extract<
            vdm extends Verbatim.Decl.Map.Proto,
            nameu extends Verbatim.Name.From<vdm>,
        > = nameu extends infer name extends Verbatim.Name.From<vdm>
            ? Verbatim.Decl<name, vdm[name]['parameters']>
            : never;

        export type From<
            vdm extends Verbatim.Decl.Map.Proto,
        > = Verbatim.Decl.Extract<vdm, Verbatim.Name.From<vdm>>;

        export namespace Map {
            export type Proto = Record<string, Body<Verbatim.Decl.Params.Proto>>;
        }

        export interface Body<
            in out params extends Verbatim.Decl.Params.Proto,
        > {
            description: string;
            parameters: params;
        }
        export namespace Body {
            export interface Proto {
                description: string;
                parameters: Verbatim.Decl.Params.Proto;
            }

            export type Extract<
                vdm extends Verbatim.Decl.Map.Proto,
                name extends Verbatim.Name.From<vdm>,
            > = Verbatim.Decl.Body<vdm[name]['parameters']>;
        }

        export type Entry<
            name extends string,
            ps extends Verbatim.Decl.Params.Proto,
        > = [name, Verbatim.Decl.Body<ps>];

        export namespace Entry {
            export type Of<
                vdu extends Verbatim.Decl.Proto,
            > = vdu extends infer vd extends Verbatim.Decl.Proto ? Entry<vd['name'], vd['parameters']> : never;

            export type From<
                vdm extends Verbatim.Decl.Map.Proto,
            > = Verbatim.Decl.Entry.Of<Verbatim.Decl.From<vdm>>;
        }
    }

    export class Request<in out vd extends Verbatim.Decl.Proto> {
        protected declare [NOMINAL]: never;
        public name: vd['name'];
        public args: Verbatim.Decl.Args<vd['parameters']>;
        protected constructor(vm: Request.Options<vd>) {
            this.name = vm.name;
            this.args = vm.args;
        }

        public static create<vdu extends Verbatim.Decl.Proto>(
            vm: Verbatim.Request.Options.Of<vdu>,
        ): Verbatim.Request.Of<vdu> {
            return new Verbatim.Request(vm) as Verbatim.Request.Of<vdu>;
        }
    }

    export namespace Request {
        export type Of<
            vdu extends Verbatim.Decl.Proto,
        > = vdu extends infer vd extends Verbatim.Decl.Proto ? Verbatim.Request<vd> : never;

        export type From<
            vdm extends Verbatim.Decl.Map.Proto,
        > = Verbatim.Request.Of<Verbatim.Decl.From<vdm>>;

        export type Options<vd extends Verbatim.Decl.Proto> = Omit<Verbatim.Request<vd>, never>;
        export namespace Options {

            export type Of<
                vdu extends Verbatim.Decl.Proto,
            > = vdu extends infer vd extends Verbatim.Decl.Proto ? Verbatim.Request.Options<vd> : never;

            export type From<
                vdm extends Verbatim.Decl.Map.Proto,
            > = Verbatim.Request.Options.Of<Verbatim.Decl.From<vdm>>;
        }
    }

    export interface Handler<vd extends Verbatim.Decl.Proto> {
        (params: Verbatim.Decl.Args<vd['parameters']>): Promise<string>;
    }

    export namespace Handler {
        export type Extract<
            vdm extends Verbatim.Decl.Map.Proto,
            nameu extends Verbatim.Name.From<vdm>,
        > = Verbatim.Handler.Of<Verbatim.Decl.Extract<vdm, nameu>>;

        export type Of<
            vdu extends Verbatim.Decl.Proto,
        > = vdu extends infer vd extends Verbatim.Decl.Proto ? Handler<vd> : never;

        export type Map<vdm extends Verbatim.Decl.Map.Proto> = {
            [name in Verbatim.Name.From<vdm>]: Verbatim.Handler<Verbatim.Decl.Extract<vdm, name>>;
        };
    }

}
