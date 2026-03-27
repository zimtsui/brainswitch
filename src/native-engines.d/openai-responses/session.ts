import { RoleMessage as CompatibleRoleMessage} from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';
import type { GenericSession } from '#@/engine/session.ts';
import type { Verbatim } from '#@/verbatim.ts';
import OpenAI from 'openai';

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
        > = Session.ChatMessage<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>;
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
            protected raw: OpenAI.Responses.ResponseOutputItem[],
        ) {}

        public getParts(): RoleMessage.Ai.Part<fdu, vdu>[] {
            return this.parts;
        }
        public getRaw(): OpenAI.Responses.ResponseOutputItem[] {
            return this.raw;
        }
        public allTextPart(): boolean {
            return this.parts.every(part => part instanceof RoleMessage.Part.Text);
        }
        public getTextParts(): RoleMessage.Part.Text<vdu>[] {
            return this.parts.filter(part => part instanceof RoleMessage.Part.Text);
        }
        public getText(): string {
            return this.getTextParts().map(part => part.text).join('');
        }
        public getToolCalls(): Tool.Call.Of<fdu>[] {
            return this.parts.filter(part => part instanceof Function.Call || part instanceof Tool.ApplyPatch.Call);
        }
        public getFunctionCalls(): Function.Call.Of<fdu>[] {
            return this.parts.filter(part => part instanceof Function.Call);
        }
        public getVerbatimRequests(): Verbatim.Request.Of<vdu>[] {
            return this.parts
                .filter(part => part instanceof RoleMessage.Part.Text)
                .flatMap(part => part.vrs);
        }

        public getOnlyFunctionCall(): Function.Call.Of<fdu> {
            const tcs = this.getToolCalls();
            if (tcs.length === 1) {} else throw new Error();
            const tc = tcs[0]!;
            if (tc instanceof Function.Call) {} else throw new Error();
            return tc;
        }
        public getOnlyToolCall(): Tool.Call.Of<fdu> {
            const tcs = this.getToolCalls();
            if (tcs.length === 1) {} else throw new Error();
            return tcs[0]!;
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
        > = RoleMessage.Ai<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>;

        export type Part<
            fdu extends Function.Decl.Proto,
            vdu extends Verbatim.Decl.Proto,
        > =
            |   RoleMessage.Part.Text<vdu>
            |   Tool.Call.Of<fdu>
        ;
        export namespace Part {
            export type From<
                fdm extends Function.Decl.Map.Proto,
                vdm extends Verbatim.Decl.Map.Proto,
            > = RoleMessage.Ai.Part<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>;
        }
    }

    export class User<
        in out fdu extends Function.Decl.Proto,
    > {
        protected declare [NOMINAL]: never;
        public constructor(protected parts: RoleMessage.User.Part<fdu>[]) {}
        public getParts(): RoleMessage.User.Part<fdu>[] {
            return this.parts;
        }
        public getToolResponses(): Tool.Response.Of<fdu>[] {
            return this.parts.filter(part => part instanceof Function.Response || part instanceof Tool.ApplyPatch.Response);
        }
    }
    export namespace User {
        export type From<
            fdm extends Function.Decl.Map.Proto,
        > = RoleMessage.User<Function.Decl.From<fdm>>;

        export type Part<fdu extends Function.Decl.Proto> =
            |   RoleMessage.Part.Text<never>
            |   Tool.Response.Of<fdu>
        ;
        export namespace Part {
            export type From<
                fdm extends Function.Decl.Map.Proto,
            > = RoleMessage.User.Part<Function.Decl.From<fdm>>;
        }
    }

    export import Developer = CompatibleRoleMessage.Developer;
}
