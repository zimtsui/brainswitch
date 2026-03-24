import * as Compatible from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';
import type { GenericSession } from '#@/session.ts';
import type { Verbatim } from '#@/verbatim.ts';
import OpenAI from 'openai';

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
        > = Session.ChatMessage<Function.Declaration.From<fdm>, Verbatim.Declaration.From<vdm>>;
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
            protected raw: OpenAI.Responses.ResponseOutputItem[],
        ) {}

        public getParts(): RoleMessage.Ai.Part<fdu, vdu>[] {
            return this.parts;
        }
        public getRaw(): OpenAI.Responses.ResponseOutputItem[] {
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
            const tcs = this.getToolCalls();
            if (tcs.length === 1) {} else throw new Error();
            const tc = tcs[0]!;
            if (tc instanceof Function.Call) {} else throw new Error();
            return tc;
        }
        public getOnlyApplyPatchCall(): Tool.ApplyPatch.Call {
            const tcs = this.getToolCalls();
            if (tcs.length === 1) {} else throw new Error();
            const tc = tcs[0]!;
            if (tc instanceof Tool.ApplyPatch.Call) {} else throw new Error();
            return tc;
        }
        public getToolCalls(): Tool.Call.Of<fdu>[] {
            return this.parts.filter(part => part instanceof Function.Call || part instanceof Tool.ApplyPatch.Call);
        }
        public getFunctionCalls(): Function.Call.Of<fdu>[] {
            return this.parts.filter(part => part instanceof Function.Call);
        }
        public getOnlyFunctionCalls(): Function.Call.Of<fdu>[] {
            const tcs = this.getToolCalls();
            if (tcs.every(tc => tc instanceof Function.Call)) {} else throw new Error();
            return tcs;
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
        > = RoleMessage.Ai<Function.Declaration.From<fdm>, Verbatim.Declaration.From<vdm>>;

        export type Part<
            fdu extends Function.Declaration.Prototype,
            vdu extends Verbatim.Declaration.Prototype,
        > =
            |   RoleMessage.Part.Text<vdu>
            |   Tool.Call.Of<fdu>
        ;
        export namespace Part {
            export type From<
                fdm extends Function.Declaration.Map.Prototype,
                vdm extends Verbatim.Declaration.Map.Prototype,
            > = RoleMessage.Ai.Part<Function.Declaration.From<fdm>, Verbatim.Declaration.From<vdm>>;
        }
    }

    export class User<
        in out fdu extends Function.Declaration.Prototype,
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
        public getToolResponses(): Tool.Response.Of<fdu>[] {
            return this.parts.filter(part => part instanceof Function.Response || part instanceof Tool.ApplyPatch.Response);
        }
    }
    export namespace User {
        export type From<
            fdm extends Function.Declaration.Map.Prototype,
        > = RoleMessage.User<Function.Declaration.From<fdm>>;

        export type Part<fdu extends Function.Declaration.Prototype> =
            |   RoleMessage.Part.Text<never>
            |   Tool.Response.Of<fdu>
        ;
        export namespace Part {
            export type From<
                fdm extends Function.Declaration.Map.Prototype,
            > = RoleMessage.User.Part<Function.Declaration.From<fdm>>;
        }
    }

    export import Developer = Compatible.RoleMessage.Developer;
}
