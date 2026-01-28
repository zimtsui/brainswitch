import assert from 'node:assert';
import { Function } from './function.ts';


export interface Session<out fdu extends Function.Declaration = never> {
    developerMessage?: RoleMessage.Developer;
    chatMessages: ChatMessage<fdu>[];
}

export type ChatMessage<fdu extends Function.Declaration = never> = RoleMessage.User<fdu> | RoleMessage.Ai<fdu>;


export type RoleMessage = RoleMessage.Instance;
export namespace RoleMessage {
    export class SpecificMessageError extends Error {
        public constructor() {
            super('This message is specific to a certain type of engines.');
        }
    }
    export abstract class Instance {
        public static readonly ROLE_MESSAGE_NOMINAL = Symbol();
        private declare readonly [Instance.ROLE_MESSAGE_NOMINAL]: void;
        public abstract getText(): string;
        public abstract getOnlyText(): string;
    }
    export namespace Part {
        export type Text = Text.Instance;
        export namespace Text {
            export function create(text: string): Text {
                return new Instance(text);
            }
            export function paragraph(text: string): Text {
                return new Instance(text.trimEnd() + '\n\n');
            }
            export class Instance {
                public static readonly Text_NOMINAL = Symbol();
                private declare readonly [Instance.Text_NOMINAL]: void;
                public constructor(public text: string) {}
            }
        }
    }

    export type Ai<fdu extends Function.Declaration = never> = Ai.Instance<fdu>;
    export namespace Ai {
        export function create<fdu extends Function.Declaration = never>(parts: Ai.Part<fdu>[]): Ai<fdu> {
            return new Instance(parts);
        }
        export const NOMINAL = Symbol();
        export class Instance<out fdu extends Function.Declaration = never> extends RoleMessage.Instance {
            public declare readonly [NOMINAL]: void;
            public constructor(protected parts: Ai.Part<fdu>[]) {
                super();
            }
            public getParts(): Ai.Part<fdu>[] {
                return this.parts;
            }
            public getText(): string {
                return this.parts.filter(part => part instanceof RoleMessage.Part.Text.Instance).map(part => part.text).join('');
            }
            public getOnlyText(): string {
                assert(this.parts.every(part => part instanceof RoleMessage.Part.Text.Instance));
                return this.getText();
            }
            public getOnlyFunctionCall(): Function.Call.Distributive<fdu> {
                const fcs = this.getFunctionCalls();
                assert(fcs.length === 1);
                return fcs[0]!;
            }
            public getFunctionCalls(): Function.Call.Distributive<fdu>[] {
                return this.parts.filter(part => part instanceof Function.Call);
            }
        }
        export type Part<fdu extends Function.Declaration = never> = RoleMessage.Part.Text | Function.Call.Distributive<fdu>;
    }

    export type User<fdu extends Function.Declaration = never> = User.Instance<fdu>;
    export namespace User {
        export function create<fdu extends Function.Declaration = never>(parts: User.Part<fdu>[]): User<fdu> {
            return new Instance(parts);
        }
        export class Instance<out fdu extends Function.Declaration = never> extends RoleMessage.Instance {
            public static readonly USER_NOMINAL = Symbol();
            private declare readonly [Instance.USER_NOMINAL]: void;
            public constructor(protected parts: User.Part<fdu>[]) {
                super();
            }
            public getParts(): User.Part<fdu>[] {
                return this.parts;
            }
            public getText(): string {
                return this.parts.filter(part => part instanceof RoleMessage.Part.Text.Instance).map(part => part.text).join('');
            }
            public getOnlyText(): string {
                assert(this.parts.every(part => part instanceof RoleMessage.Part.Text.Instance));
                return this.getText();
            }
            public getFunctionResponses(): Function.Response.Distributive<fdu>[] {
                return this.parts.filter(part => part instanceof Function.Response);
            }
            public getOnlyFunctionResponse(): Function.Response.Distributive<fdu> {
                assert(this.parts.length === 1 && this.parts[0] instanceof Function.Response);
                return this.parts[0]! as Function.Response.Distributive<fdu>;
            }
        }
        export type Part<fdu extends Function.Declaration = never> = RoleMessage.Part.Text | Function.Response.Distributive<fdu>;
    }

    export type Developer = Developer.Instance;
    export namespace Developer {
        export function create(parts: Developer.Part[]): Developer {
            return new Instance(parts);
        }
        export class Instance extends RoleMessage.Instance {
            public static readonly DEVELOPER_NOMINAL = Symbol();
            private declare readonly [Instance.DEVELOPER_NOMINAL]: void;
            public constructor(protected parts: Developer.Part[]) {
                super();
            }
            public getParts(): Developer.Part[] {
                return this.parts;
            }
            public getText(): string {
                return this.parts.map(part => part.text).join('');
            }
            public getOnlyText(): string {
                return this.getText();
            }
        }
        export type Part = Part.Text;
    }
}
