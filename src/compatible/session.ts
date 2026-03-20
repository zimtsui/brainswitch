import { Function } from '#@/function.ts';
import { type GenericSession } from '#@/session.ts';


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

    export type Ai<fdm extends Function.Declaration.Map> = Ai.Instance<fdm>;
    export namespace Ai {
        export function create<fdm extends Function.Declaration.Map>(parts: RoleMessage.Ai.Part<fdm>[]): RoleMessage.Ai<fdm> {
            return new Instance(parts);
        }
        export const NOMINAL = Symbol();
        export class Instance<in out fdm extends Function.Declaration.Map> extends RoleMessage.Instance {
            public declare readonly [NOMINAL]: void;
            public constructor(protected parts: RoleMessage.Ai.Part<fdm>[]) {
                super();
            }
            public getParts(): RoleMessage.Ai.Part<fdm>[] {
                return this.parts;
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
            |   Function.Call.From<fdm>;
    }

    export type User<fdm extends Function.Declaration.Map> = User.Instance<fdm>;
    export namespace User {
        export function create<fdm extends Function.Declaration.Map>(parts: RoleMessage.User.Part<fdm>[]): RoleMessage.User<fdm> {
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
            public getFunctionResponses(): Function.Response.Distributive<fdm>[] {
                return this.parts.filter(part => part instanceof Function.Response);
            }
            public getOnlyFunctionResponse(): Function.Response.Distributive<fdm> {
                if (this.parts.length === 1 && this.parts[0] instanceof Function.Response) {} else throw new Error();
                return this.parts[0]! as Function.Response.Distributive<fdm>;
            }
        }
        export type Part<fdm extends Function.Declaration.Map> = RoleMessage.Part.Text | Function.Response.Distributive<fdm>;
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
