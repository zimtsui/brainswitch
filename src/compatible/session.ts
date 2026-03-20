import { Function } from '#@/function.ts';
import { type GenericSession } from '#@/session.ts';


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
    export class SpecificMessageError extends Error {
        public constructor() {
            super('This message is specific to a certain type of engines.');
        }
    }
    export const NOMINAL = Symbol();
    export abstract class Instance {
        private declare readonly [NOMINAL]: void;
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
            export const NOMINAL = Symbol();
            export class Instance {
                private declare readonly [NOMINAL]: void;
                public constructor(public text: string) {}
            }
        }
    }

    export type Ai<fdu extends Function.Declaration> = Ai.Instance<fdu>;
    export namespace Ai {
        export function create<fdu extends Function.Declaration>(parts: RoleMessage.Ai.Part<fdu>[]): RoleMessage.Ai<fdu> {
            return new Instance(parts);
        }
        export const NOMINAL = Symbol();
        export class Instance<out fdu extends Function.Declaration> extends RoleMessage.Instance {
            public declare readonly [NOMINAL]: void;
            public constructor(protected parts: RoleMessage.Ai.Part<fdu>[]) {
                super();
            }
            public getParts(): RoleMessage.Ai.Part<fdu>[] {
                return this.parts;
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
        export type Part<fdu extends Function.Declaration> = RoleMessage.Part.Text | Function.Call.Distributive<fdu>;
    }

    export type User<fdu extends Function.Declaration> = User.Instance<fdu>;
    export namespace User {
        export function create<fdu extends Function.Declaration>(parts: RoleMessage.User.Part<fdu>[]): RoleMessage.User<fdu> {
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
            public getFunctionResponses(): Function.Response.Distributive<fdu>[] {
                return this.parts.filter(part => part instanceof Function.Response);
            }
            public getOnlyFunctionResponse(): Function.Response.Distributive<fdu> {
                if (this.parts.length === 1 && this.parts[0] instanceof Function.Response) {} else throw new Error();
                return this.parts[0]! as Function.Response.Distributive<fdu>;
            }
        }
        export type Part<fdu extends Function.Declaration> = RoleMessage.Part.Text | Function.Response.Distributive<fdu>;
    }

    export type Developer = Developer.Instance;
    export namespace Developer {
        export function create(parts: Developer.Part[]): Developer {
            return new Instance(parts);
        }
        export const NOMINAL = Symbol();
        export class Instance extends RoleMessage.Instance {
            private declare readonly [NOMINAL]: void;
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
