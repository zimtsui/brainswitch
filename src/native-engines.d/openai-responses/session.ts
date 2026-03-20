import * as Compatible from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';
import type { GenericSession } from '#@/session.ts';
import OpenAI from 'openai';


export interface Session<in out fdu extends Function.Declaration> extends GenericSession<
    RoleMessage.User<fdu>,
    RoleMessage.Ai<fdu>,
    RoleMessage.Developer
> {}
export namespace Session {
    export type ChatMessage<fdu extends Function.Declaration> = GenericSession.ChatMessage<
        RoleMessage.User<fdu>,
        RoleMessage.Ai<fdu>
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

    export type Ai<fdu extends Function.Declaration> = Ai.Instance<fdu>;
    export namespace Ai {
        export function create<fdu extends Function.Declaration>(
            parts: RoleMessage.Ai.Part<fdu>[],
            raw: OpenAI.Responses.ResponseOutputItem[],
        ): RoleMessage.Ai<fdu> {
            return new Instance(parts, raw);
        }
        export const NOMINAL = Symbol();
        export class Instance<out fdu extends Function.Declaration> extends RoleMessage.Instance {
            public declare readonly [NOMINAL]: void;
            public constructor(
                protected parts: RoleMessage.Ai.Part<fdu>[],
                protected raw: OpenAI.Responses.ResponseOutputItem[],
            ) {
                super();
            }

            public getParts(): RoleMessage.Ai.Part<fdu>[] {
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
            public getOnlyFunctionCall(): Function.Call.Distributive<fdu> {
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
            public getToolCalls(): Tool.Call<fdu>[] {
                return this.parts.filter(part => part instanceof Function.Call || part instanceof Tool.ApplyPatch.Call);
            }
            public getFunctionCalls(): Function.Call.Distributive<fdu>[] {
                return this.parts.filter(part => part instanceof Function.Call);
            }
            public getOnlyFunctionCalls(): Function.Call.Distributive<fdu>[] {
                const tcs = this.getToolCalls();
                if (tcs.every(tc => tc instanceof Function.Call)) {} else throw new Error();
                return tcs;
            }
        }

        export type Part<fdu extends Function.Declaration> =
            |   RoleMessage.Part.Text
            |   Tool.Call<fdu>
        ;
    }

    export type User<fdu extends Function.Declaration> = User.Instance<fdu>;
    export namespace User {
        export function create<fdu extends Function.Declaration>(parts: User.Part<fdu>[]): User<fdu> {
            return new Instance(parts);
        }
        export const NOMINAL = Symbol();
        export class Instance<out fdu extends Function.Declaration> extends RoleMessage.Instance {
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
            public getToolResponses(): Tool.Response<fdu>[] {
                return this.parts.filter(part => part instanceof Function.Response || part instanceof Tool.ApplyPatch.Response);
            }
        }

        export type Part<fdu extends Function.Declaration> =
            |   RoleMessage.Part.Text
            |   Tool.Response<fdu>
        ;
    }

    export import Developer = Compatible.RoleMessage.Developer;
}
