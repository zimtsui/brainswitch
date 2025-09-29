import { assert } from 'node:console';
import { Function } from './function.ts';


export interface Session<out fdu extends Function.Declaration = never> {
	developerMessage?: RoleMessage.Developer;
	chatMessages: ChatMessage<fdu>[];
}

export type ChatMessage<fdu extends Function.Declaration = never> = RoleMessage.User<fdu> | RoleMessage.AI<fdu>;


export abstract class RoleMessage<out fdu extends Function.Declaration = never> {
	public static readonly ROLE_MESSAGE_NOMINAL = Symbol();
	private declare readonly [RoleMessage.ROLE_MESSAGE_NOMINAL]: void;
}

export namespace RoleMessage {
	export class Text {
		public static readonly Text_NOMINAL = Symbol();
		private declare readonly [Text.Text_NOMINAL]: void;
		public constructor(public text: string) {}
	}

	export class AI<out fdu extends Function.Declaration = never> extends RoleMessage<fdu> {
		public static readonly AI_NOMINAL = Symbol();
		private declare readonly [AI.AI_NOMINAL]: void;
		public constructor(public parts: AI.Part<fdu>[]) {
			super();
		}
		public getText(): string {
			return this.parts.filter(part => part instanceof Text).map(part => part.text).join('');
		}
		public getOnlyText(): string {
			assert(this.parts.every(part => part instanceof Text));
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
	export namespace AI {
		export type Part<fdu extends Function.Declaration = never> = Text | Function.Call.Distributive<fdu>;
	}

	export class User<out fdu extends Function.Declaration = never> extends RoleMessage<fdu> {
		public static readonly USER_NOMINAL = Symbol();
		private declare readonly [User.USER_NOMINAL]: void;
		public constructor(public parts: User.Part<fdu>[]) {
			super();
		}
		public getText(): string {
			return this.parts.filter(part => part instanceof Text).map(part => part.text).join('');
		}
		public getOnlyText(): string {
			assert(this.parts.every(part => part instanceof Text));
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
	export namespace User {
		export type Part<fdu extends Function.Declaration = never> = Text | Function.Response.Distributive<fdu>;
	}

	export class Developer extends RoleMessage {
		public static readonly DEVELOPER_NOMINAL = Symbol();
		private declare readonly [Developer.DEVELOPER_NOMINAL]: void;
		public constructor(public parts: Developer.Part[]) {
			super();
		}
		public getText(): string {
			return this.parts.map(part => part.text).join('');
		}
		public getOnlyText(): string {
			return this.getText();
		}
	}
	export namespace Developer {
		export type Part = Text;
	}
}
