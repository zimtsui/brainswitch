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

export namespace RoleMessage {

    export namespace Part {
        export class Text {
            private static NOMINAL = Symbol();

            public static create(text: string): Text {
                return new Text(text);
            }
            public static paragraph(text: string): Text {
                return new Text(text.trimEnd() + '\n\n');
            }

            private declare readonly [Text.NOMINAL]: void;
            public constructor(public text: string) {}
        }
    }

    export class Ai<
        in out fdu extends Function.Declaration.Prototype,
        in out vdu extends Verbatim.Declaration.Prototype,
    > {
        public static create<
            fdu extends Function.Declaration.Prototype,
            vdu extends Verbatim.Declaration.Prototype,
        >(parts: RoleMessage.Ai.Part<fdu, vdu>[]): RoleMessage.Ai<fdu, vdu> {
            return new Ai(parts);
        }

        private static NOMINAL = Symbol();
        public declare readonly [Ai.NOMINAL]: void;

        public constructor(protected parts: RoleMessage.Ai.Part<fdu, vdu>[]) {}
        public getParts(): RoleMessage.Ai.Part<fdu, vdu>[] {
            return this.parts;
        }
        public getText(): string {
            return this.parts.filter(part => part instanceof RoleMessage.Part.Text).map(part => part.text).join('');
        }
        public getOnlyText(): string {
            if (this.parts.every(part => part instanceof RoleMessage.Part.Text)) {} else throw new Error();
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
    export namespace Ai {
        export type Part<
            fdu extends Function.Declaration.Prototype,
            vdu extends Verbatim.Declaration.Prototype,
        > =
            |   RoleMessage.Part.Text
            |   Function.Call<fdu>
            |   Verbatim.Message<vdu>
        ;
    }

    export class User<
        in out fdu extends Function.Declaration.Prototype,
    > {
        public create<fdu extends Function.Declaration.Prototype>(parts: RoleMessage.User.Part<fdu>[]): RoleMessage.User<fdu> {
            return new User(parts);
        }

        private static NOMINAL = Symbol();
        private declare readonly [User.NOMINAL]: void;

        public constructor(protected parts: RoleMessage.User.Part<fdu>[]) {}
        public getParts(): RoleMessage.User.Part<fdu>[] {
            return this.parts;
        }
        public getText(): string {
            return this.parts.filter(part => part instanceof RoleMessage.Part.Text).map(part => part.text).join('');
        }
        public getOnlyText(): string {
            if (this.parts.every(part => part instanceof RoleMessage.Part.Text)) {} else throw new Error();
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
    export namespace User {
        export type Part<fdu extends Function.Declaration.Prototype> =
            |   RoleMessage.Part.Text
            |   Function.Response<fdu>
            |   Verbatim.Message<Verbatim.Declaration.Prototype>
        ;
    }

    export class Developer {
        public static create(parts: Developer.Part[]): Developer {
            return new Developer(parts);
        }

        private static NOMINAL = Symbol();
        private declare readonly [Developer.NOMINAL]: void;

        public constructor(protected parts: Developer.Part[]) {}
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
    export namespace Developer {
        export type Part = Part.Text;
    }
}
