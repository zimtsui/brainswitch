import { Function } from '#@/function.ts';
import { type GenericSession } from '#@/session.ts';
import { Verbatim } from '#@/verbatim.ts';

const NOMINAL = Symbol();


export interface Session<
    in out fdu extends Function.Decl.Proto,
    in out vdu extends Verbatim.Decl.Proto,
> extends GenericSession<
    RoleMessage.User<fdu>,
    RoleMessage.Ai<fdu, vdu>,
    RoleMessage.Developer
> {}
export namespace Session {
    export type From<
        fdm extends Function.Decl.Map.Proto,
        vdm extends Verbatim.Decl.Map.Proto,
    > = Session<
        Function.Decl.From<fdm>,
        Verbatim.Decl.From<vdm>
    >;

    export type ChatMessage<
        fdu extends Function.Decl.Proto,
        vdu extends Verbatim.Decl.Proto,
    > = GenericSession.ChatMessage<
        RoleMessage.User<fdu>,
        RoleMessage.Ai<fdu, vdu>
    >;
    export namespace ChatMessage {
        export type From<
            fdm extends Function.Decl.Map.Proto,
            vdm extends Verbatim.Decl.Map.Proto,
        > = ChatMessage<
            Function.Decl.From<fdm>,
            Verbatim.Decl.From<vdm>
        >;
    }
}

export namespace RoleMessage {

    export namespace Part {
        export class Text<out vdu extends Verbatim.Decl.Proto> {
            public static paragraph(text: string): Text<never> {
                return new RoleMessage.Part.Text(text.trimEnd() + '\n\n', []);
            }

            protected declare [NOMINAL]: never;
            public constructor(
                public text: string,
                public vrs: Verbatim.Request.Of<vdu>[],
            ) {}
        }
    }

    export class Ai<
        out fdu extends Function.Decl.Proto,
        out vdu extends Verbatim.Decl.Proto,
    > {
        protected declare [NOMINAL]: never;

        public constructor(protected parts: RoleMessage.Ai.Part<fdu, vdu>[]) {}
        public getParts(): RoleMessage.Ai.Part<fdu, vdu>[] {
            return this.parts;
        }
        public getText(): string {
            return this.parts
                .filter(part => part instanceof RoleMessage.Part.Text)
                .map(part => part.text).join('');
        }
        public getOnlyText(): string {
            if (this.parts.every(part => part instanceof RoleMessage.Part.Text)) {} else throw new Error();
            return this.getText();
        }
        public getFunctionCalls(): Function.Call.Of<fdu>[] {
            return this.parts.filter(part => part instanceof Function.Call);
        }
        public getOnlyFunctionCall(): Function.Call.Of<fdu> {
            const fcs = this.getFunctionCalls();
            if (fcs.length === 1) {} else throw new Error();
            return fcs[0]!;
        }
        public getVerbatimRequests(): Verbatim.Request.Of<vdu>[] {
            return this.parts
                .filter(part => part instanceof RoleMessage.Part.Text)
                .flatMap(part => part.vrs);
        }
        public getOnlyVerbatimRequest(): Verbatim.Request.Of<vdu> {
            const vrs = this.getVerbatimRequests();
            if (vrs.length === 1) {} else throw new Error();
            return vrs[0]!;
        }
    }
    export namespace Ai {
        export type From<
            fdm extends Function.Decl.Map.Proto,
            vdm extends Verbatim.Decl.Map.Proto,
        > = RoleMessage.Ai<
            Function.Decl.From<fdm>,
            Verbatim.Decl.From<vdm>
        >;

        export type Part<
            fdu extends Function.Decl.Proto,
            vdu extends Verbatim.Decl.Proto,
        > =
            |   RoleMessage.Part.Text<vdu>
            |   Function.Call.Of<fdu>
        ;
        export namespace Part {
            export type From<
                fdm extends Function.Decl.Map.Proto,
                vdm extends Verbatim.Decl.Map.Proto,
            > = RoleMessage.Ai.Part<
                Function.Decl.From<fdm>,
                Verbatim.Decl.From<vdm>
            >;
        }
    }

    export class User<
        out fdu extends Function.Decl.Proto,
    > {
        protected declare [NOMINAL]: never;

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
            fdm extends Function.Decl.Map.Proto,
        > = RoleMessage.User<Function.Decl.From<fdm>>;

        export type Part<fdu extends Function.Decl.Proto> =
            |   RoleMessage.Part.Text<never>
            |   Function.Response.Of<fdu>
        ;
    }

    export class Developer {
        protected declare [NOMINAL]: never;

        public constructor(protected parts: RoleMessage.Developer.Part[]) {}
        public getParts(): RoleMessage.Developer.Part[] {
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
        export type Part = RoleMessage.Part.Text<never>;
    }
}
