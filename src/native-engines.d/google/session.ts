import { RoleMessage as CompatibleRoleMessage } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import * as Google from '@google/genai';
import type { GenericSession } from '#@/session.ts';
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
    > = Session<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>;

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
        > = ChatMessage<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>;
    }
}



export namespace RoleMessage {
    export namespace Part {
        export import Text = CompatibleRoleMessage.Part.Text;
    }

    export class Ai<
        in out fdu extends Function.Decl.Proto,
        in out vdu extends Verbatim.Decl.Proto,
    > {
        protected declare [NOMINAL]: never;
        public constructor(
            protected parts: RoleMessage.Ai.Part<fdu, vdu>[],
            protected raw: Google.Content,
        ) {}

        public getParts(): RoleMessage.Ai.Part<fdu, vdu>[] {
            return this.parts;
        }
        public getRaw(): Google.Content {
            return this.raw;
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
        public getVerbatimMessages(): Verbatim.Request.Of<vdu>[] {
            return this.parts
                .filter(part => part instanceof RoleMessage.Part.Text)
                .flatMap(part => part.vrs);
        }
        public getOnlyVerbatimMessage(): Verbatim.Request.Of<vdu> {
            const vrs = this.getVerbatimMessages();
            if (vrs.length === 1) {} else throw new Error();
            return vrs[0]!;
        }
    }
    export namespace Ai {
        export type From<
            fdm extends Function.Decl.Map.Proto,
            vdm extends Verbatim.Decl.Map.Proto,
        > = Ai<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>;
        export type Part<
            fdu extends Function.Decl.Proto,
            vdu extends Verbatim.Decl.Proto,
        > =
            |   RoleMessage.Part.Text<vdu>
            |   Function.Call.Of<fdu>
            |   RoleMessage.Ai.Part.ExecutableCode
            |   RoleMessage.Ai.Part.CodeExecutionResult
        ;

        export namespace Part {
            export type From<
                fdm extends Function.Decl.Map.Proto,
                vdm extends Verbatim.Decl.Map.Proto,
            > = Part<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>;

            export class ExecutableCode {
                protected declare [NOMINAL]: never;
                public constructor(public code: string, public language: string) {}
            }

            export class CodeExecutionResult {
                protected declare [NOMINAL]: never;
                public constructor(public outcome: string, public output?: string) {}
            }
        }
    }

    export import User = CompatibleRoleMessage.User;
    export import Developer = CompatibleRoleMessage.Developer;
}
