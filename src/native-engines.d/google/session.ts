import * as Compatible from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import * as Google from '@google/genai';
import type { GenericSession } from '#@/session.ts';


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
    export abstract class Instance {
        public static readonly ROLE_MESSAGE_NOMINAL = Symbol();
        private declare readonly [Instance.ROLE_MESSAGE_NOMINAL]: void;
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
            raw: Google.Content,
        ): Ai<fdm> {
            return new Instance(parts, raw);
        }
        export const NOMINAL = Symbol();
        export class Instance<in out fdm extends Function.Declaration.Map> extends RoleMessage.Instance {
            public declare readonly [NOMINAL]: void;
            public constructor(
                protected parts: RoleMessage.Ai.Part<fdm>[],
                protected raw: Google.Content,
            ) {
                super();
            }

            public getParts(): RoleMessage.Ai.Part<fdm>[] {
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
            public getOnlyFunctionCall(): Function.Call.From<fdm> {
                const fcs = this.getFunctionCalls();
                if (fcs.length === 1) {} else throw new Error();
                return fcs[0]!;
            }
            public getFunctionCalls(): Function.Call.From<fdm>[] {
                return this.parts.filter(part => part instanceof Function.Call);
            }
        }

        export type Part<fdm extends Function.Declaration.Map> =
            |   RoleMessage.Part.Text
            |   Function.Call.From<fdm>
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
