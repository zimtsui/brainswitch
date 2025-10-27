import assert from 'node:assert';
import { Function } from './function.ts';


export interface Session<out fdu extends Function.Declaration = never> {
	developerMessage?: RoleMessage.DeveloperClass;
	chatMessages: ChatMessage<fdu>[];
}
export namespace SessionStatic {
	export interface Snapshot<in out fdu extends Function.Declaration = never> {
		developerMessage?: RoleMessage.Developer.Snapshot;
		chatMessages: ChatMessageStatic.Snapshot<fdu>[];
	}
	export function restore<fdu extends Function.Declaration>(snapshot: Snapshot<fdu>): Session<fdu> {
		return {
			developerMessage: snapshot.developerMessage && RoleMessage.Developer.restore(snapshot.developerMessage),
			chatMessages: snapshot.chatMessages.map(ChatMessageStatic.restore<fdu>),
		};
	}
	export function capture<fdu extends Function.Declaration>(session: Session<fdu>): Snapshot<fdu> {
		return {
			developerMessage: session.developerMessage && RoleMessage.Developer.capture(session.developerMessage),
			chatMessages: session.chatMessages.map(ChatMessageStatic.capture<fdu>),
		};
	}
}

export type ChatMessage<fdu extends Function.Declaration = never> = RoleMessage.UserClass<fdu> | RoleMessage.AIClass<fdu>;
export namespace ChatMessageStatic {
	export type Snapshot<fdu extends Function.Declaration = never> =
		| {
			type: 'RoleMessage.User';
			value: RoleMessage.User.Snapshot<fdu>;
		}
		| {
			type: 'RoleMessage.AI';
			value: RoleMessage.AI.Snapshot<fdu>;
		}
	;
	export function restore<fdu extends Function.Declaration>(snapshot: Snapshot<fdu>): ChatMessage<fdu> {
		if (snapshot.type === 'RoleMessage.User')
			return RoleMessage.User.restore(snapshot.value);
		else if (snapshot.type === 'RoleMessage.AI')
			return RoleMessage.AI.restore(snapshot.value);
		else throw new Error();
	}
	export function capture<fdu extends Function.Declaration>(chatMessage: ChatMessage<fdu>): Snapshot<fdu> {
		return chatMessage instanceof RoleMessage.UserClass ? {
			type: 'RoleMessage.User',
			value: RoleMessage.User.capture(chatMessage),
		} : {
			type: 'RoleMessage.AI',
			value: RoleMessage.AI.capture(chatMessage),
		};
	}
}


export abstract class RoleMessageClass {
	public static readonly ROLE_MESSAGE_NOMINAL = Symbol();
	private declare readonly [RoleMessageClass.ROLE_MESSAGE_NOMINAL]: void;
}

export namespace RoleMessage {
	export namespace Part {
		export class TextClass {
			public static readonly Text_NOMINAL = Symbol();
			private declare readonly [TextClass.Text_NOMINAL]: void;
			public constructor(public text: string) {}
		}
		export namespace Text {
			export type Snapshot = string;
			export function capture(part: TextClass): Text.Snapshot {
				return part.text;
			}
			export function restore(snapshot: Text.Snapshot): TextClass {
				return new TextClass(snapshot);
			}
		}
	}

	export class AIClass<out fdu extends Function.Declaration = never> extends RoleMessageClass {
		public static readonly AI_NOMINAL = Symbol();
		private declare readonly [AIClass.AI_NOMINAL]: void;
		public constructor(public parts: AI.Part<fdu>[]) {
			super();
		}
		public getText(): string {
			return this.parts.filter(part => part instanceof RoleMessage.Part.TextClass).map(part => part.text).join('');
		}
		public getOnlyText(): string {
			assert(this.parts.every(part => part instanceof RoleMessage.Part.TextClass));
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
		export function capture<fdu extends Function.Declaration>(message: AIClass<fdu>): AI.Snapshot<fdu> {
			return message.parts.map(AI.Part.capture<fdu>);
		}
		export function restore<fdu extends Function.Declaration>(snapshot: AI.Snapshot<fdu>): AIClass<fdu> {
			return new AIClass(snapshot.map(AI.Part.restore<fdu>));
		}
		export type Snapshot<fdu extends Function.Declaration = never> = Part.Snapshot<fdu>[];
		export type Part<fdu extends Function.Declaration = never> = RoleMessage.Part.TextClass | Function.Call.Distributive<fdu>;
		export namespace Part {
			export function restore<fdu extends Function.Declaration>(snapshot: Part.Snapshot<fdu>): Part<fdu> {
				if (snapshot.type === 'RoleMessage.Part.Text')
					return RoleMessage.Part.Text.restore(snapshot.value);
				else if (snapshot.type === 'Function.Call')
					return Function.Call.restore<fdu>(snapshot.value);
				else throw new Error();
			}
			export function capture<fdu extends Function.Declaration>(part: Part<fdu>): Part.Snapshot<fdu> {
				return part instanceof RoleMessage.Part.TextClass ? {
					type: 'RoleMessage.Part.Text',
					value: RoleMessage.Part.Text.capture(part),
				} : {
					type: 'Function.Call',
					value: Function.Call.capture(part),
				};
			}
			export type Snapshot<fdu extends Function.Declaration = never> =
				| {
					type: 'RoleMessage.Part.Text';
					value: RoleMessage.Part.Text.Snapshot;
				}
				| {
					type: 'Function.Call';
					value: Function.Call.Snapshot.Distributive<fdu>;
				}
			;
		}
	}

	export class UserClass<out fdu extends Function.Declaration = never> extends RoleMessageClass {
		public static readonly USER_NOMINAL = Symbol();
		private declare readonly [UserClass.USER_NOMINAL]: void;
		public constructor(public parts: User.Part<fdu>[]) {
			super();
		}
		public getText(): string {
			return this.parts.filter(part => part instanceof RoleMessage.Part.TextClass).map(part => part.text).join('');
		}
		public getOnlyText(): string {
			assert(this.parts.every(part => part instanceof RoleMessage.Part.TextClass));
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
		export function capture<fdu extends Function.Declaration>(message: UserClass<fdu>): User.Snapshot<fdu> {
			return message.parts.map(User.Part.capture<fdu>);
		}
		export function restore<fdu extends Function.Declaration>(snapshot: User.Snapshot<fdu>): UserClass<fdu> {
			return new UserClass(snapshot.map(User.Part.restore<fdu>));
		}
		export type Snapshot<fdu extends Function.Declaration = never> = Part.Snapshot<fdu>[];
		export type Part<fdu extends Function.Declaration = never> = RoleMessage.Part.TextClass | Function.Response.Distributive<fdu>;
		export namespace Part {
			export function restore<fdu extends Function.Declaration>(snapshot: Part.Snapshot<fdu>): Part<fdu> {
				if (snapshot.type === 'RoleMessage.Part.Text')
					return RoleMessage.Part.Text.restore(snapshot.value);
				else if (snapshot.type === 'Function.Response')
					return Function.Response.restore<fdu>(snapshot.value);
				else throw new Error();
			}
			export function capture<fdu extends Function.Declaration>(part: Part<fdu>): Part.Snapshot<fdu> {
				return part instanceof RoleMessage.Part.TextClass ? {
					type: 'RoleMessage.Part.Text',
					value: RoleMessage.Part.Text.capture(part),
				} : {
					type: 'Function.Response',
					value: Function.Response.capture(part),
				};
			}
			export type Snapshot<fdu extends Function.Declaration = never> =
				| {
					type: 'RoleMessage.Part.Text';
					value: RoleMessage.Part.Text.Snapshot;
				}
				| {
					type: 'Function.Response';
					value: Function.Response.Snapshot.Distributive<fdu>;
				}
			;
		}
	}

	export class DeveloperClass extends RoleMessageClass {
		public static readonly DEVELOPER_NOMINAL = Symbol();
		private declare readonly [DeveloperClass.DEVELOPER_NOMINAL]: void;
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
		export type Snapshot = RoleMessage.Part.Text.Snapshot[];
		export type Part = RoleMessage.Part.TextClass;
		export function capture(message: DeveloperClass): Developer.Snapshot {
			return message.parts.map(RoleMessage.Part.Text.capture);
		}
		export function restore(snapshot: Developer.Snapshot): DeveloperClass {
			return new DeveloperClass(snapshot.map(RoleMessage.Part.Text.restore));
		}
	}
}
