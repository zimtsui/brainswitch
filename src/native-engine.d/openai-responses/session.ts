import * as Common from '../../session.ts';
import { Function } from '../../function.ts';
import assert from 'node:assert';
import { Tool } from './tool.ts';
import OpenAI from 'openai';


export interface Session<out fdu extends Function.Declaration = never> {
    developerMessage?: RoleMessage.Developer;
    chatMessages: ChatMessage<fdu>[];
}

export type ChatMessage<fdu extends Function.Declaration = never> = RoleMessage.User<fdu> | RoleMessage.Ai<fdu>;


export type RoleMessage = RoleMessage.Constructor;
export namespace RoleMessage {
    export abstract class Constructor {
        public static readonly ROLE_MESSAGE_NOMINAL = Symbol();
        private declare readonly [Constructor.ROLE_MESSAGE_NOMINAL]: void;
        public abstract getText(): string;
        public abstract getOnlyText(): string;
    }
    export namespace Part {
        export import Text = Common.RoleMessage.Part.Text;
    }

    export type Ai<fdu extends Function.Declaration = never> = Ai.Constructor<fdu>;
    export namespace Ai {
        export function create<fdu extends Function.Declaration = never>(
            parts: Ai.Part<fdu>[],
            raw: OpenAI.Responses.ResponseOutputItem[],
        ): Ai<fdu> {
            return new Constructor(parts, raw);
        }
        export const NOMINAL = Symbol();
        export class Constructor<out fdu extends Function.Declaration = never> extends RoleMessage.Constructor {
            public declare readonly [NOMINAL]: void;
            public constructor(
                protected parts: Ai.Part<fdu>[],
                protected raw: OpenAI.Responses.ResponseOutputItem[],
            ) {
                super();
            }

            public getParts(): Ai.Part<fdu>[] {
                return this.parts;
            }
            public getRaw(): OpenAI.Responses.ResponseOutputItem[] {
                return this.raw;
            }
            public getText(): string {
                return this.parts.filter(part => part instanceof RoleMessage.Part.Text.Constructor).map(part => part.text).join('');
            }
            public getOnlyText(): string {
                assert(this.parts.every(part => part instanceof RoleMessage.Part.Text.Constructor));
                return this.getText();
            }
            public getOnlyFunctionCall(): Function.Call.Distributive<fdu> {
                const tcs = this.getToolCalls();
                assert(tcs.length === 1);
                const tc = tcs[0]!;
                assert(tc instanceof Function.Call);
                return tc;
            }
            public getOnlyApplyPatchCall(): Tool.ApplyPatch.Call {
                const tcs = this.getToolCalls();
                assert(tcs.length === 1);
                const tc = tcs[0]!;
                assert(tc instanceof Tool.ApplyPatch.Call);
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
                assert(tcs.every(tc => tc instanceof Function.Call));
                return tcs;
            }
        }

        export type Part<fdu extends Function.Declaration = never> =
            |   RoleMessage.Part.Text
            |   Tool.Call<fdu>
        ;
    }

    export type User<fdu extends Function.Declaration = never> = User.Constructor<fdu>;
    export namespace User {
        export function create<fdu extends Function.Declaration = never>(parts: User.Part<fdu>[]): User<fdu> {
            return new Constructor(parts);
        }
        export const NOMINAL = Symbol();
        export class Constructor<out fdu extends Function.Declaration = never> extends RoleMessage.Constructor {
            private declare readonly [NOMINAL]: void;
            public constructor(protected parts: User.Part<fdu>[]) {
                super();
            }
            public getParts(): User.Part<fdu>[] {
                return this.parts;
            }
            public getText(): string {
                return this.parts.filter(part => part instanceof RoleMessage.Part.Text.Constructor).map(part => part.text).join('');
            }
            public getOnlyText(): string {
                assert(this.parts.every(part => part instanceof RoleMessage.Part.Text.Constructor));
                return this.getText();
            }
            public getToolResponses(): Tool.Response<fdu>[] {
                return this.parts.filter(part => part instanceof Function.Response || part instanceof Tool.ApplyPatch.Response);
            }
        }

        export type Part<fdu extends Function.Declaration = never> =
            |   RoleMessage.Part.Text
            |   Tool.Response<fdu>
        ;
    }

    export import Developer = Common.RoleMessage.Developer;
}
