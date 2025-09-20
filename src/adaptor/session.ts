import { assert } from 'node:console';
import { Function } from './function.ts';


export interface Session<out fd extends Function.Declaration = never> {
	developerMessage?: RoleMessage.Developer;
	chatMessages: ChatMessage<fd>[];
}

export type ChatMessage<fd extends Function.Declaration = never> = RoleMessage.User<fd> | RoleMessage.AI<fd>;

export abstract class RoleMessage<out fd extends Function.Declaration = never> {
	public static readonly ROLE_MESSAGE_NOMINAL = Symbol();
	private declare readonly [RoleMessage.ROLE_MESSAGE_NOMINAL]: void;
}

export namespace RoleMessage {
	export class Text {
		public static readonly Text_NOMINAL = Symbol();
		private declare readonly [Text.Text_NOMINAL]: void;
		public constructor(public text: string) {}
	}

	export class AI<out fd extends Function.Declaration = never> extends RoleMessage<fd> {
		public static readonly AI_NOMINAL = Symbol();
		private declare readonly [AI.AI_NOMINAL]: void;
		public constructor(public parts: AI.Part<fd>[]) {
			super();
		}
		public getText(): string {
			return this.parts.filter(part => part instanceof Text).map(part => part.text).join('');
		}
		public getOnlyText(): string {
			assert(this.parts.every(part => part instanceof Text));
			return this.getText();
		}
		public getOnlyFunctionCall(): Function.Call.Union<fd> {
			const fcs = this.getFunctionCalls();
			assert(fcs.length === 1);
			return fcs[0]!;
		}
		public getFunctionCalls(): Function.Call.Union<fd>[] {
			return this.parts.filter(part => part instanceof Function.Call);
		}
	}
	export namespace AI {
		export type Part<fd extends Function.Declaration = never> = Text | Function.Call.Union<fd>;
	}

	export class User<fd extends Function.Declaration = never> extends RoleMessage<fd> {
		public static readonly USER_NOMINAL = Symbol();
		private declare readonly [User.USER_NOMINAL]: void;
		public constructor(public parts: User.Part<fd>[]) {
			super();
		}
		public getText(): string {
			return this.parts.filter(part => part instanceof Text).map(part => part.text).join('');
		}
		public getOnlyText(): string {
			assert(this.parts.every(part => part instanceof Text));
			return this.getText();
		}
		public getFunctionResponses(): Function.Response.Union<fd>[] {
			return this.parts.filter(part => part instanceof Function.Response);
		}
		public getOnlyFunctionResponse(): Function.Response.Union<fd> {
			assert(this.parts.length === 1 && this.parts[0] instanceof Function.Response);
			return this.parts[0]! as Function.Response.Union<fd>;
		}
	}
	export namespace User {
		export type Part<fd extends Function.Declaration = never> = Text | Function.Response.Union<fd>;
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
