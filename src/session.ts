import assert from 'node:assert';
import { Function } from './function.ts';


export interface Session<out fdu extends Function.Declaration = never> {
    developerMessage?: RoleMessage.Developer;
    chatMessages: ChatMessage<fdu>[];
}

export type ChatMessage<fdu extends Function.Declaration = never> = RoleMessage.User<fdu> | RoleMessage.Ai<fdu>;


export type RoleMessage = RoleMessage.Constructor;
export namespace RoleMessage {
    export class SpecificMessageError extends Error {
        public constructor() {
            super('This message is specific to a certain type of engines.');
        }
    }
    export abstract class Constructor {
        public static readonly ROLE_MESSAGE_NOMINAL = Symbol();
        private declare readonly [Constructor.ROLE_MESSAGE_NOMINAL]: void;
        public abstract getText(): string;
        public abstract getOnlyText(): string;
    }
    export namespace Part {
        export type Text = Text.Constructor;
        export namespace Text {
            export function create(text: string): Text {
                return new Constructor(text);
            }
            export function paragraph(text: string): Text {
                return new Constructor(text.trimEnd() + '\n\n');
            }
            export class Constructor {
                public static readonly Text_NOMINAL = Symbol();
                private declare readonly [Constructor.Text_NOMINAL]: void;
                public constructor(public text: string) {}
            }
        }
    }

    export type Ai<fdu extends Function.Declaration = never> = Ai.Constructor<fdu>;
    export namespace Ai {
        export function create<fdu extends Function.Declaration = never>(parts: Ai.Part<fdu>[]): Ai<fdu> {
            return new Constructor(parts);
        }
        export const NOMINAL = Symbol();
        export class Constructor<out fdu extends Function.Declaration = never> extends RoleMessage.Constructor {
            public declare readonly [NOMINAL]: void;
            public constructor(protected parts: Ai.Part<fdu>[]) {
                super();
            }
            public getParts(): Ai.Part<fdu>[] {
                return this.parts;
            }
            public getText(): string {
                return this.parts.filter(part => part instanceof RoleMessage.Part.Text.Constructor).map(part => part.text).join('');
            }
            public getOnlyText(): string {
                assert(this.parts.every(part => part instanceof RoleMessage.Part.Text.Constructor));
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

    export type User<fdu extends Function.Declaration = never> = User.Constructor<fdu>;
    export namespace User {
        export function create<fdu extends Function.Declaration = never>(parts: User.Part<fdu>[]): User<fdu> {
            return new Constructor(parts);
        }
        export class Constructor<out fdu extends Function.Declaration = never> extends RoleMessage.Constructor {
            public static readonly USER_NOMINAL = Symbol();
            private declare readonly [Constructor.USER_NOMINAL]: void;
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

    export type Developer = Developer.Constructor;
    export namespace Developer {
        export function create(parts: Developer.Part[]): Developer {
            return new Constructor(parts);
        }
        export class Constructor extends RoleMessage.Constructor {
            public static readonly DEVELOPER_NOMINAL = Symbol();
            private declare readonly [Constructor.DEVELOPER_NOMINAL]: void;
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
