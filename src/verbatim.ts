import { type Static, type TObject, type TString } from '@sinclair/typebox';

const NOMINAL = Symbol();


export namespace Verbatim {

    export namespace Name {
        export type From<
            fdm extends Verbatim.Declaration.Map.Prototype,
        > = globalThis.Extract<keyof fdm, string>;
    }

    export interface Declaration<
        in out name extends string,
        in out ps extends Declaration.Paraschema.Prototype,
    > extends Verbatim.Declaration.Item<ps> {
        name: name;
    }

    export namespace Declaration {
        export interface Prototype extends Verbatim.Declaration.Item.Prototype {
            name: string;
        }

        export namespace Paraschema {
            export type Prototype = TObject<Record<string, TString>>;
        }

        export type Extract<
            vdm extends Verbatim.Declaration.Map.Prototype,
            nameu extends Verbatim.Name.From<vdm>,
        > = nameu extends infer name extends Verbatim.Name.From<vdm>
            ? Verbatim.Declaration<name, vdm[name]['paraschema']>
            : never;

        export type From<
            vdm extends Verbatim.Declaration.Map.Prototype,
        > = Verbatim.Declaration.Extract<vdm, Verbatim.Name.From<vdm>>;

        export namespace Map {
            export type Prototype = Record<string, Item<Verbatim.Declaration.Paraschema.Prototype>>;
        }

        export interface Item<
            in out ps extends Verbatim.Declaration.Paraschema.Prototype,
        > {
            description?: string;
            paraschema: ps;
        }
        export namespace Item {
            export interface Prototype {
                description?: string;
                paraschema: Verbatim.Declaration.Paraschema.Prototype;
            }

            export type Extract<
                vdm extends Verbatim.Declaration.Map.Prototype,
                name extends Verbatim.Name.From<vdm>,
            > = Verbatim.Declaration.Item<vdm[name]['paraschema']>;
        }

        export type Entry<
            name extends string,
            ps extends Verbatim.Declaration.Paraschema.Prototype,
        > = [name, Verbatim.Declaration.Item<ps>];

        export namespace Entry {
            export type Of<
                vdu extends Verbatim.Declaration.Prototype,
            > = vdu extends infer vd extends Verbatim.Declaration.Prototype ? Entry<vd['name'], vd['paraschema']> : never;

            export type From<
                vdm extends Verbatim.Declaration.Map.Prototype,
            > = Verbatim.Declaration.Entry.Of<Verbatim.Declaration.From<vdm>>;
        }
    }

    export class Message<in out vd extends Verbatim.Declaration.Prototype> {
        protected declare [NOMINAL]: never;
        public name: vd['name'];
        public args: Static<vd['paraschema']>;
        protected constructor(vm: Message.Options<vd>) {
            this.name = vm.name;
            this.args = vm.args;
        }

        public static create<vdu extends Verbatim.Declaration.Prototype>(
            vm: Verbatim.Message.Options.Of<vdu>,
        ): Verbatim.Message.Of<vdu> {
            return new Verbatim.Message(vm) as Verbatim.Message.Of<vdu>;
        }
    }

    export namespace Message {
        export type Of<
            vdu extends Verbatim.Declaration.Prototype,
        > = vdu extends infer vd extends Verbatim.Declaration.Prototype ? Verbatim.Message<vd> : never;

        export type From<
            vdm extends Verbatim.Declaration.Map.Prototype,
        > = Verbatim.Message.Of<Verbatim.Declaration.From<vdm>>;

        export type Options<vd extends Verbatim.Declaration.Prototype> = Omit<Verbatim.Message<vd>, never>;
        export namespace Options {

            export type Of<
                vdu extends Verbatim.Declaration.Prototype,
            > = vdu extends infer vd extends Verbatim.Declaration.Prototype ? Verbatim.Message.Options<vd> : never;

            export type From<
                vdm extends Verbatim.Declaration.Map.Prototype,
            > = Verbatim.Message.Options.Of<Verbatim.Declaration.From<vdm>>;
        }
    }

    export interface Handler<vd extends Verbatim.Declaration.Prototype> {
        (params: Static<vd['paraschema']>): Promise<string>;
    }

    export namespace Handler {
        export type Extract<
            vdm extends Verbatim.Declaration.Map.Prototype,
            nameu extends Verbatim.Name.From<vdm>,
        > = Verbatim.Handler.Of<Verbatim.Declaration.Extract<vdm, nameu>>;

        export type Of<
            vdu extends Verbatim.Declaration.Prototype,
        > = vdu extends infer vd extends Verbatim.Declaration.Prototype ? Handler<vd> : never;

        export type Map<vdm extends Verbatim.Declaration.Map.Prototype> = {
            [name in Verbatim.Name.From<vdm>]: Verbatim.Handler<Verbatim.Declaration.Extract<vdm, name>>;
        };
    }

}
