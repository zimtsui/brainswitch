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
            export type NameOf<fdm extends Map.Prototype> = globalThis.Extract<keyof fdm, string>;
        }
        export interface Item<in out ps extends Verbatim.Declaration.Paraschema.Prototype> {
            description?: string;
            paraschema: ps;
        }
        export namespace Item {
            export type Extract<
                vdm extends Verbatim.Declaration.Map.Prototype,
                name extends Verbatim.Declaration.Map.NameOf<vdm>,
            > = Item<vdm[name]['paraschema']>;
            export type From<
                vdm extends Verbatim.Declaration.Map.Prototype,
            > = Item<vdm[Verbatim.Declaration.Map.NameOf<vdm>]['paraschema']>;
        }
        export type Entry<name extends string, ps extends Verbatim.Declaration.Paraschema.Prototype> = [name, Item<ps>];
        export namespace Entry {
            export type Extract<
                vdm extends Verbatim.Declaration.Map.Prototype,
                name extends Verbatim.Declaration.Map.NameOf<vdm>,
            > = Entry<name, vdm[name]['paraschema']>;
            export type From<
                vdm extends Verbatim.Declaration.Map.Prototype,
            > = Entry<
                Verbatim.Declaration.Map.NameOf<vdm>,
                vdm[Verbatim.Declaration.Map.NameOf<vdm>]['paraschema']
            >;
        }
    }

    export class Send<in out vd extends Verbatim.Declaration.Prototype> {
        public static readonly NOMINAL = Symbol();
        private declare readonly [Send.NOMINAL]: void;
        public id?: string;
        public name: vd['name'];
        public args: Static<vd['paraschema']>;
        private constructor(fc: Omit<Send<vd>, never>) {
            this.id = fc.id;
            this.name = fc.name;
            this.args = fc.args;
        }
        public static create<vdm extends Declaration.Map.Prototype>(fc: Send.create.Options<vdm>): Send.From<vdm> {
            return new Send(fc) as Send.From<vdm>;
        }
        public static restore<vdm extends Declaration.Map.Prototype>(snapshot: Send.Snapshot.Distributive<vdm>): Send.From<vdm> {
            return new Send(snapshot) as Send.From<vdm>;
        }
        public static capture<vdm extends Declaration.Map.Prototype>(fc: Send.From<vdm>): Send.Snapshot.Distributive<vdm> {
            return fc as Send.Snapshot.Distributive<vdm>;
        }
    }
    export namespace Send {
        export type From<vdm extends Verbatim.Declaration.Map.Prototype> = {
            [name in Verbatim.Declaration.Map.NameOf<vdm>]: Send<Verbatim.Declaration.Extract<vdm, name>>;
        }[Verbatim.Declaration.Map.NameOf<vdm>];

        export type Snapshot<fd extends Verbatim.Declaration.Prototype> = Omit<Send<fd>, never>;
        export namespace Snapshot {
            export type Distributive<vdm extends Verbatim.Declaration.Map.Prototype> = {
                [name in Verbatim.Declaration.Map.NameOf<vdm>]: Snapshot<Verbatim.Declaration.Extract<vdm, name>>;
            }[Verbatim.Declaration.Map.NameOf<vdm>];
        }
        export namespace create {
            export type Options<vdm extends Verbatim.Declaration.Map.Prototype> = {
                [name in Verbatim.Declaration.Map.NameOf<vdm>]: Omit<Send<Verbatim.Declaration.Extract<vdm, name>>, never>;
            }[Verbatim.Declaration.Map.NameOf<vdm>];
        }
    }

    export class Response<in out vd extends Verbatim.Declaration.Prototype> {
        public static readonly NOMINAL = Symbol();
        private declare readonly [Response.NOMINAL]: void;
        public id?: string;
        public name: vd['name'];
        public text: string;
        private constructor(fr: Omit<Response<vd>, never>) {
            this.id = fr.id;
            this.name = fr.name;
            this.text = fr.text;
        }
        public static create<vdm extends Verbatim.Declaration.Map.Prototype>(fr: Response.create.Options<vdm>): Response.Distributive<vdm> {
            return new Response(fr) as Response.Distributive<vdm>;
        }
        public static capture<vdm extends Verbatim.Declaration.Map.Prototype>(response: Response.Distributive<vdm>): Response.Snapshot.Distributive<vdm> {
            return response as Response.Snapshot.Distributive<vdm>;
        }
        public static restore<vdm extends Verbatim.Declaration.Map.Prototype>(snapshot: Response.Snapshot.Distributive<vdm>): Response.Distributive<vdm> {
            return new Response(snapshot) as Response.Distributive<vdm>;
        }
    }
    export namespace Response {
        export type Snapshot<vd extends Verbatim.Declaration.Prototype> = Omit<Response<vd>, never>;
        export namespace Snapshot {
            export type Distributive<vdm extends Verbatim.Declaration.Map.Prototype> = {
                [name in Verbatim.Declaration.Map.NameOf<vdm>]: Snapshot<Verbatim.Declaration.Extract<vdm, name>>;
            }[Verbatim.Declaration.Map.NameOf<vdm>];
        }
        export type Distributive<vdm extends Verbatim.Declaration.Map.Prototype> = {
            [name in Verbatim.Declaration.Map.NameOf<vdm>]: Response<Verbatim.Declaration.Extract<vdm, name>>;
        }[Verbatim.Declaration.Map.NameOf<vdm>];
        export namespace create {
            export type Options<vdm extends Verbatim.Declaration.Map.Prototype> = {
                [name in Verbatim.Declaration.Map.NameOf<vdm>]: Omit<Response<Verbatim.Declaration.Extract<vdm, name>>, never>;
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
