import { Function } from '#@/function.ts';
import { type GenericSession } from '#@/session.ts';
import { Verbatim } from '#@/verbatim.ts';

const NOMINAL = Symbol();


export interface Session<
    in out fdu extends Function.Declaration.Prototype,
    in out vdu extends Verbatim.Declaration.Prototype,
> extends GenericSession<
    RoleMessage.User<fdu>,
    RoleMessage.Ai<fdu, vdu>,
    RoleMessage.Developer
> {}
export namespace Session {
    export type From<
        fdm extends Function.Declaration.Map.Prototype,
        vdm extends Verbatim.Declaration.Map.Prototype,
    > = Session<
        Function.Declaration.From<fdm>,
        Verbatim.Declaration.From<vdm>
    >;

    export type ChatMessage<
        fdu extends Function.Declaration.Prototype,
        vdu extends Verbatim.Declaration.Prototype,
    > = GenericSession.ChatMessage<
        RoleMessage.User<fdu>,
        RoleMessage.Ai<fdu, vdu>
    >;
    export namespace ChatMessage {
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
            vdm extends Verbatim.Declaration.Map.Prototype,
        > = ChatMessage<
            Function.Declaration.From<fdm>,
            Verbatim.Declaration.From<vdm>
        >;
    }
}

export namespace RoleMessage {

    export namespace Part {
        export class Text<out vdu extends Verbatim.Declaration.Prototype> {
            public static paragraph(text: string): Text<never> {
                return new Text(text.trimEnd() + '\n\n', []);
            }

            protected declare [NOMINAL]: void;
            public constructor(
                public text: string,
                public vms: Verbatim.Message.Of<vdu>[],
            ) {}
        }
    }

    export class Ai<
        out fdu extends Function.Declaration.Prototype,
        out vdu extends Verbatim.Declaration.Prototype,
    > {
        protected declare [NOMINAL]: void;

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
        public getOnlyFunctionCall(): Function.Call.Of<fdu> {
            const fcs = this.getFunctionCalls();
            if (fcs.length === 1) {} else throw new Error();
            return fcs[0]!;
        }
        public getFunctionCalls(): Function.Call.Of<fdu>[] {
            return this.parts.filter(part => part instanceof Function.Call);
        }
        public getOnlyVerbatimMessage(): Verbatim.Message.Of<vdu> {
            const vms = this.getVerbatimMessages();
            if (vms.length === 1) {} else throw new Error();
            return vms[0]!;
        }
        public getVerbatimMessages(): Verbatim.Message.Of<vdu>[] {
            return this.parts
                .filter(part => part instanceof RoleMessage.Part.Text)
                .flatMap(part => part.vms);
        }
    }
    export namespace Ai {
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
            vdm extends Verbatim.Declaration.Map.Prototype,
        > = Ai<
            Function.Declaration.From<fdm>,
            Verbatim.Declaration.From<vdm>
        >;

        export type Part<
            fdu extends Function.Declaration.Prototype,
            vdu extends Verbatim.Declaration.Prototype,
        > =
            |   RoleMessage.Part.Text<vdu>
            |   Function.Call.Of<fdu>
        ;
        export namespace Part {
            export type From<
                fdm extends Function.Declaration.Map.Prototype,
                vdm extends Verbatim.Declaration.Map.Prototype,
            > = Part<
                Function.Declaration.From<fdm>,
                Verbatim.Declaration.From<vdm>
            >;
        }
    }

    export class User<
        out fdu extends Function.Declaration.Prototype,
    > {
        protected declare [NOMINAL]: void;

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
        public getFunctionResponses(): Function.Response.Of<fdu>[] {
            return this.parts.filter(part => part instanceof Function.Response);
        }
        public getOnlyFunctionResponse(): Function.Response.Of<fdu> {
            if (this.parts.length === 1 && this.parts[0] instanceof Function.Response) {} else throw new Error();
            return this.parts[0]!;
        }
    }
    export namespace User {
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = User<
            Function.Declaration.From<fdm>
        >;

        export type Part<fdu extends Function.Declaration.Prototype> =
            |   RoleMessage.Part.Text<never>
            |   Function.Response.Of<fdu>
        ;
    }

    export class Developer {
        protected declare [NOMINAL]: void;

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
        export type Part = Part.Text<never>;
    }
}
