import { type Static, type TObject, type TString } from '@sinclair/typebox';



export namespace Verbatim {

    export interface Declaration<
        name extends string,
        ps extends Declaration.Paraschema.Prototype,
    > extends Verbatim.Declaration.Item<ps> {
        name: name;
    }

    export namespace Declaration {
        export type Prototype = Verbatim.Declaration<string, Verbatim.Declaration.Paraschema.Prototype>;

        export namespace Paraschema {
            export type Prototype = TObject<Record<string, TString>>;
        }

        export type Extract<
            vdm extends Verbatim.Declaration.Map.Prototype,
            nameu extends Verbatim.Declaration.Map.NameOf<vdm>,
        > = {
            [name in Verbatim.Declaration.Map.NameOf<vdm>]: Verbatim.Declaration<name, vdm[name]['paraschema']>;
        }[nameu];
        export type From<
            vdm extends Verbatim.Declaration.Map.Prototype,
        > = Verbatim.Declaration.Extract<vdm, Verbatim.Declaration.Map.NameOf<vdm>>;

        export namespace Map {
            export type Prototype = Record<string, Item<Verbatim.Declaration.Paraschema.Prototype>>;
            export type NameOf<vdm extends Verbatim.Declaration.Map.Prototype> = globalThis.Extract<keyof vdm, string>;
        }
        export interface Item<in out ps extends Verbatim.Declaration.Paraschema.Prototype> {
            description?: string;
            paraschema: ps;
        }
        export namespace Item {
            export type Extract<
                vdm extends Verbatim.Declaration.Map.Prototype,
                name extends Verbatim.Declaration.Map.NameOf<vdm>,
            > = Verbatim.Declaration.Item<vdm[name]['paraschema']>;
        }
        export type Entry<
            name extends string,
            ps extends Verbatim.Declaration.Paraschema.Prototype,
        > = [name, Verbatim.Declaration.Item<ps>];
        export namespace Entry {
            export type Extract<
                vdm extends Verbatim.Declaration.Map.Prototype,
                name extends Verbatim.Declaration.Map.NameOf<vdm>,
            > = Verbatim.Declaration.Entry<name, vdm[name]['paraschema']>;
            export type From<vdm extends Verbatim.Declaration.Map.Prototype> = {
                [name in Verbatim.Declaration.Map.NameOf<vdm>]: Verbatim.Declaration.Entry<name, vdm[name]['paraschema']>;
            }[Verbatim.Declaration.Map.NameOf<vdm>];
        }
    }

    export class Message<in out vd extends Verbatim.Declaration.Prototype> {
        private static readonly NOMINAL = Symbol();
        private declare readonly [Message.NOMINAL]: void;
        public name: vd['name'];
        public args: Static<vd['paraschema']>;
        protected constructor(vm: Message.Options<vd>) {
            this.name = vm.name;
            this.args = vm.args;
        }
        public static create<vdu extends Verbatim.Declaration.Prototype>(vm: Message.Options.Of<vdu>): Message.Of<vdu> {
            return new Message(vm) as Message.Of<vdu>;
        }
    }
    export namespace Message {
        export type Of<
            vdu extends Verbatim.Declaration.Prototype,
        > = vdu extends infer vd extends Verbatim.Declaration.Prototype ? Message<vd> : never;
        export type From<vdm extends Verbatim.Declaration.Map.Prototype> = {
            [name in Verbatim.Declaration.Map.NameOf<vdm>]: Message<Verbatim.Declaration.Extract<vdm, name>>;
        }[Verbatim.Declaration.Map.NameOf<vdm>];

        export type Options<vd extends Verbatim.Declaration.Prototype> = Omit<Message<vd>, never>;
        export namespace Options {
            export type Of<
                vdu extends Verbatim.Declaration.Prototype,
            > = vdu extends infer vd extends Verbatim.Declaration.Prototype ? Options<vd> : never;
            export type From<vdm extends Verbatim.Declaration.Map.Prototype> = {
                [name in Verbatim.Declaration.Map.NameOf<vdm>]: Options<Verbatim.Declaration.Extract<vdm, name>>;
            }[Verbatim.Declaration.Map.NameOf<vdm>];
        }
    }

    export interface Handler<vd extends Verbatim.Declaration.Prototype> {
        (params: Static<vd['paraschema']>): Promise<string>;
    }
    export namespace Handler {
        export type Map<vdm extends Verbatim.Declaration.Map.Prototype> = {
            [name in Verbatim.Declaration.Map.NameOf<vdm>]: Verbatim.Handler<Verbatim.Declaration.Extract<vdm, name>>;
        };
    }
}
