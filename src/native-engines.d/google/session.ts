import * as Compatible from '../../compatible/session.ts';
import { Function } from '../../function.ts';
import * as Google from '@google/genai';
import type { GenericSession } from '../../session.ts';


export type Session<fdu extends Function.Declaration = never> = GenericSession<
    RoleMessage.User<fdu>,
    RoleMessage.Ai<fdu>,
    RoleMessage.Developer
>;
export namespace Session {
    export type ChatMessage<fdu extends Function.Declaration> = GenericSession.ChatMessage<
        RoleMessage.User<fdu>,
        RoleMessage.Ai<fdu>
    >;
}



export type RoleMessage = RoleMessage.Instance;
export namespace RoleMessage {
    export abstract class Instance {
        public static readonly ROLE_MESSAGE_NOMINAL = Symbol();
        private declare readonly [Instance.ROLE_MESSAGE_NOMINAL]: void;
        public abstract getText(): string;
        public abstract getOnlyText(): string;
    }
    export namespace Part {
        export import Text = Compatible.RoleMessage.Part.Text;
    }

    export type Ai<fdu extends Function.Declaration = never> = Ai.Instance<fdu>;
    export namespace Ai {
        export function create<fdu extends Function.Declaration = never>(
            parts: RoleMessage.Ai.Part<fdu>[],
            raw: Google.Content,
        ): Ai<fdu> {
            return new Instance(parts, raw);
        }
        export const NOMINAL = Symbol();
        export class Instance<out fdu extends Function.Declaration = never> extends RoleMessage.Instance {
            public declare readonly [NOMINAL]: void;
            public constructor(
                protected parts: RoleMessage.Ai.Part<fdu>[],
                protected raw: Google.Content,
            ) {
                super();
            }

            public getParts(): RoleMessage.Ai.Part<fdu>[] {
                return this.parts;
            }
            public getRaw(): Google.Content {
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
                const fcs = this.getFunctionCalls();
                if (fcs.length === 1) {} else throw new Error();
                return fcs[0]!;
            }
            public getFunctionCalls(): Function.Call.Distributive<fdu>[] {
                return this.parts.filter(part => part instanceof Function.Call);
            }
        }

        export type Part<fdu extends Function.Declaration = never> =
            |   RoleMessage.Part.Text
            |   Function.Call.Distributive<fdu>
            |   RoleMessage.Ai.Part.ExecutableCode
            |   RoleMessage.Ai.Part.CodeExecutionResult
        ;

        export namespace Part {
            export type ExecutableCode = ExecutableCode.Instance;
            export namespace ExecutableCode {
                export const NOMINAL = Symbol();
                export class Instance {
                    private declare readonly [NOMINAL]: void;
                    public constructor(public code: string, public language: string) {}
                }
                export function create(code: string, language: string) {
                    return new Instance(code, language);
                }
            }
            export type CodeExecutionResult = CodeExecutionResult.Instance;
            export namespace CodeExecutionResult {
                export const NOMINAL = Symbol();
                export class Instance {
                    private declare readonly [NOMINAL]: void;
                    public constructor(public outcome: string, public output?: string) {}
                }
                export function create(outcome: string, output?: string) {
                    return new Instance(outcome, output);
                }
            }
        }
    }

    export import User = Compatible.RoleMessage.User;
    export import Developer = Compatible.RoleMessage.Developer;
}
