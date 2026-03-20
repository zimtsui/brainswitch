import * as Compatible from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';
import type { GenericSession } from '#@/session.ts';
import OpenAI from 'openai';


export interface Session<in out fdm extends Function.Declaration.Map> extends GenericSession<
    RoleMessage.User<fdm>,
    RoleMessage.Ai<fdm>,
    RoleMessage.Developer
> {}
export namespace Session {
    export type ChatMessage<fdm extends Function.Declaration.Map> = GenericSession.ChatMessage<
        RoleMessage.User<fdm>,
        RoleMessage.Ai<fdm>
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
        export import Text = Compatible.RoleMessage.Part.Text;
    }

    export type Ai<fdm extends Function.Declaration.Map> = Ai.Instance<fdm>;
    export namespace Ai {
        export function create<fdm extends Function.Declaration.Map>(
            parts: RoleMessage.Ai.Part<fdm>[],
            raw: OpenAI.Responses.ResponseOutputItem[],
        ): RoleMessage.Ai<fdm> {
            return new Instance(parts, raw);
        }
        export const NOMINAL = Symbol();
        export class Instance<in out fdm extends Function.Declaration.Map> extends RoleMessage.Instance {
            public declare readonly [NOMINAL]: void;
            public constructor(
                protected parts: RoleMessage.Ai.Part<fdm>[],
                protected raw: OpenAI.Responses.ResponseOutputItem[],
            ) {
                super();
            }

            public getParts(): RoleMessage.Ai.Part<fdm>[] {
                return this.parts;
            }
            public getRaw(): OpenAI.Responses.ResponseOutputItem[] {
                return this.raw;
            }
            public getText(): string {
                return this.parts.filter(part => part instanceof RoleMessage.Part.Text.Instance).map(part => part.text).join('');
            }
            public getOnlyText(): string {
                if (this.parts.every(part => part instanceof RoleMessage.Part.Text.Instance)) {} else throw new Error();
                return this.getText();
            }
            public getOnlyFunctionCall(): Function.Call.From<fdm> {
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
            public getToolCalls(): Tool.Call<fdm>[] {
                return this.parts.filter(part => part instanceof Function.Call || part instanceof Tool.ApplyPatch.Call);
            }
            public getFunctionCalls(): Function.Call.From<fdm>[] {
                return this.parts.filter(part => part instanceof Function.Call);
            }
            public getOnlyFunctionCalls(): Function.Call.From<fdm>[] {
                const tcs = this.getToolCalls();
                if (tcs.every(tc => tc instanceof Function.Call)) {} else throw new Error();
                return tcs;
            }
        }

        export type Part<fdm extends Function.Declaration.Map> =
            |   RoleMessage.Part.Text
            |   Tool.Call<fdm>
        ;
    }

    export type User<fdm extends Function.Declaration.Map> = User.Instance<fdm>;
    export namespace User {
        export function create<fdm extends Function.Declaration.Map>(parts: User.Part<fdm>[]): User<fdm> {
            return new Instance(parts);
        }
        export const NOMINAL = Symbol();
        export class Instance<in out fdm extends Function.Declaration.Map> extends RoleMessage.Instance {
            private declare readonly [NOMINAL]: void;
            public constructor(protected parts: RoleMessage.User.Part<fdm>[]) {
                super();
            }
            public getParts(): RoleMessage.User.Part<fdm>[] {
                return this.parts;
            }
            public getText(): string {
                return this.parts.filter(part => part instanceof RoleMessage.Part.Text.Instance).map(part => part.text).join('');
            }
            public getOnlyText(): string {
                if (this.parts.every(part => part instanceof RoleMessage.Part.Text.Instance)) {} else throw new Error();
                return this.getText();
            }
            public getToolResponses(): Tool.Response<fdm>[] {
                return this.parts.filter(part => part instanceof Function.Response || part instanceof Tool.ApplyPatch.Response);
            }
        }

        export type Part<fdm extends Function.Declaration.Map> =
            |   RoleMessage.Part.Text
            |   Tool.Response<fdm>
        ;
    }

    export import Developer = Compatible.RoleMessage.Developer;
}
