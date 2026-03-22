import { Function } from '#@/function.ts';
import { type GenericSession } from '#@/session.ts';
import { Verbatim } from '#@/verbatim.ts';


export interface Session<
    in out fdu extends Function.Declaration.Prototype,
    in out vdu extends Verbatim.Declaration.Prototype,
> extends GenericSession<
    RoleMessage.User<fdu>,
    RoleMessage.Ai<fdu, vdu>,
    RoleMessage.Developer
> {}
export namespace Session {
    export type ChatMessage<
        fdu extends Function.Declaration.Prototype,
        vdu extends Verbatim.Declaration.Prototype,
    > = GenericSession.ChatMessage<
        RoleMessage.User<fdu>,
        RoleMessage.Ai<fdu, vdu>
    >;
}

export type RoleMessage = RoleMessage.Instance;
export namespace RoleMessage {

    export const NOMINAL = Symbol();
    export abstract class Instance {
        private declare readonly [NOMINAL]: void;
        public abstract getText(): string;
        public abstract getOnlyText(): string;
    }
    export namespace Part {
        export type Text = Text.Instance;
        export namespace Text {
            export function create(text: string): Text {
                return new Instance(text);
            }
            export function paragraph(text: string): Text {
                return new Instance(text.trimEnd() + '\n\n');
            }
            export const NOMINAL = Symbol();
            export class Instance {
                private declare readonly [NOMINAL]: void;
                public constructor(public text: string) {}
            }
        }
    }

    export type Ai<
        fdu extends Function.Declaration.Prototype,
        vdu extends Verbatim.Declaration.Prototype,
    > = Ai.Instance<fdu, vdu>;
    export namespace Ai {
        export function create<
            fdu extends Function.Declaration.Prototype,
            vdu extends Verbatim.Declaration.Prototype,
        >(parts: RoleMessage.Ai.Part<fdu, vdu>[]): RoleMessage.Ai<fdu, vdu> {
            return new Instance(parts);
        }
        export const NOMINAL = Symbol();
        export class Instance<
            in out fdu extends Function.Declaration.Prototype,
            in out vdu extends Verbatim.Declaration.Prototype,
        > extends RoleMessage.Instance {
            public declare readonly [NOMINAL]: void;
            public constructor(protected parts: RoleMessage.Ai.Part<fdu, vdu>[]) {
                super();
            }
            public getParts(): RoleMessage.Ai.Part<fdu, vdu>[] {
                return this.parts;
            }
            public getText(): string {
                return this.parts.filter(part => part instanceof RoleMessage.Part.Text.Instance).map(part => part.text).join('');
            }
            public getOnlyText(): string {
                if (this.parts.every(part => part instanceof RoleMessage.Part.Text.Instance)) {} else throw new Error();
                return this.getText();
            }
            public getOnlyFunctionCall(): Function.Call<fdu> {
                const fcs = this.getFunctionCalls();
                if (fcs.length === 1) {} else throw new Error();
                return fcs[0]!;
            }
            public getFunctionCalls(): Function.Call<fdu>[] {
                return this.parts.filter(part => part instanceof Function.Call);
            }
            public getOnlyVerbatimMessage(): Verbatim.Message<vdu> {
                const vms = this.getVerbatimMessages();
                if (vms.length === 1) {} else throw new Error();
                return vms[0]!;
            }
            public getVerbatimMessages(): Verbatim.Message<vdu>[] {
                return this.parts.filter(part => part instanceof Verbatim.Message);
            }
        }
        export type Part<
            fdu extends Function.Declaration.Prototype,
            vdu extends Verbatim.Declaration.Prototype,
        > =
            |   RoleMessage.Part.Text
            |   Function.Call<fdu>
            |   Verbatim.Message<vdu>
        ;
    }

    export type User<fdu extends Function.Declaration.Prototype> = User.Instance<fdu>;
    export namespace User {
        export function create<fdu extends Function.Declaration.Prototype>(parts: RoleMessage.User.Part<fdu>[]): RoleMessage.User<fdu> {
            return new Instance(parts);
        }
        export const NOMINAL = Symbol();
        export class Instance<
            in out fdu extends Function.Declaration.Prototype,
        > extends RoleMessage.Instance {
            private declare readonly [NOMINAL]: void;
            public constructor(protected parts: RoleMessage.User.Part<fdu>[]) {
                super();
            }
            public getParts(): RoleMessage.User.Part<fdu>[] {
                return this.parts;
            }
            public getText(): string {
                return this.parts.filter(part => part instanceof RoleMessage.Part.Text.Instance).map(part => part.text).join('');
            }
            public getOnlyText(): string {
                if (this.parts.every(part => part instanceof RoleMessage.Part.Text.Instance)) {} else throw new Error();
                return this.getText();
            }
            public getFunctionResponses(): Function.Response<fdu>[] {
                return this.parts.filter(part => part instanceof Function.Response);
            }
            public getOnlyFunctionResponse(): Function.Response<fdu> {
                if (this.parts.length === 1 && this.parts[0] instanceof Function.Response) {} else throw new Error();
                return this.parts[0]! as Function.Response<fdu>;
            }
            public getVerbatimMessages(): Verbatim.Message<Verbatim.Declaration.Prototype>[] {
                return this.parts.filter(part => part instanceof Verbatim.Message);
            }
        }
        export type Part<fdu extends Function.Declaration.Prototype> =
            |   RoleMessage.Part.Text
            |   Function.Response<fdu>
            |   Verbatim.Message<Verbatim.Declaration.Prototype>
        ;
    }

    export type Developer = Developer.Instance;
    export namespace Developer {
        export function create(parts: Developer.Part[]): Developer {
            return new Instance(parts);
        }
        export const NOMINAL = Symbol();
        export class Instance extends RoleMessage.Instance {
            private declare readonly [NOMINAL]: void;
            public constructor(protected parts: Developer.Part[]) {
                super();
            }
            public getParts(): Developer.Part[] {
                return this.parts;
            }
            public getText(): string {
                return this.parts.map(part => part.text).join('');
            }
            public getOnlyText(): string {
                return this.getText();
            }
        }
        export type Part = Part.Text;
    }
}
