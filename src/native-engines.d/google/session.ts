import * as Compatible from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import * as Google from '@google/genai';
import type { GenericSession } from '#@/session.ts';
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
    > = Session<Function.Declaration.From<fdm>, Verbatim.Declaration.From<vdm>>;

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
        > = ChatMessage<Function.Declaration.From<fdm>, Verbatim.Declaration.From<vdm>>;
    }
}



export namespace RoleMessage {
    export namespace Part {
        export import Text = Compatible.RoleMessage.Part.Text;
    }

    export class Ai<
        in out fdu extends Function.Declaration.Prototype,
        in out vdu extends Verbatim.Declaration.Prototype,
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
        public getVerbatimMessages(): Verbatim.Message.Of<vdu>[] {
            return this.parts
                .filter(part => part instanceof RoleMessage.Part.Text)
                .flatMap(part => part.vms);
        }
        public getOnlyVerbatimMessage(): Verbatim.Message.Of<vdu> {
            const vms = this.getVerbatimMessages();
            if (vms.length === 1) {} else throw new Error();
            return vms[0]!;
        }
    }
    export namespace Ai {
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
            vdm extends Verbatim.Declaration.Map.Prototype,
        > = Ai<Function.Declaration.From<fdm>, Verbatim.Declaration.From<vdm>>;
        export type Part<
            fdu extends Function.Declaration.Prototype,
            vdu extends Verbatim.Declaration.Prototype,
        > =
            |   RoleMessage.Part.Text<vdu>
            |   Function.Call.Of<fdu>
            |   RoleMessage.Ai.Part.ExecutableCode
            |   RoleMessage.Ai.Part.CodeExecutionResult
        ;

        export namespace Part {
            export type From<
                fdm extends Function.Declaration.Map.Prototype,
                vdm extends Verbatim.Declaration.Map.Prototype,
            > = Part<Function.Declaration.From<fdm>, Verbatim.Declaration.From<vdm>>;

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

    export import User = Compatible.RoleMessage.User;
    export import Developer = Compatible.RoleMessage.Developer;
}
