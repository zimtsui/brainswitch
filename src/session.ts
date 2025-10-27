import assert from 'node:assert';
import { Function } from './function.ts';


export interface Session<out fdu extends Function.Declaration = never> {
	developerMessage?: RoleMessageStatic.Developer;
	chatMessages: ChatMessage<fdu>[];
}
export namespace SessionStatic {
	export interface Snapshot<in out fdu extends Function.Declaration = never> {
		developerMessage?: RoleMessageStatic.DeveloperStatic.Snapshot;
		chatMessages: ChatMessageStatic.Snapshot<fdu>[];
	}
	export function restore<fdu extends Function.Declaration>(snapshot: Snapshot<fdu>): Session<fdu> {
		return {
			developerMessage: snapshot.developerMessage && RoleMessageStatic.DeveloperStatic.restore(snapshot.developerMessage),
			chatMessages: snapshot.chatMessages.map(ChatMessageStatic.restore<fdu>),
		};
	}
	export function capture<fdu extends Function.Declaration>(session: Session<fdu>): Snapshot<fdu> {
		return {
			developerMessage: session.developerMessage && RoleMessageStatic.DeveloperStatic.capture(session.developerMessage),
			chatMessages: session.chatMessages.map(ChatMessageStatic.capture<fdu>),
		};
	}
}

export type ChatMessage<fdu extends Function.Declaration = never> = RoleMessageStatic.User<fdu> | RoleMessageStatic.AI<fdu>;
export namespace ChatMessageStatic {
	export type Snapshot<fdu extends Function.Declaration = never> =
		| {
			type: 'RoleMessage.User';
			value: RoleMessageStatic.User.Snapshot<fdu>;
		}
		| {
			type: 'RoleMessage.AI';
			value: RoleMessageStatic.AIStatic.Snapshot<fdu>;
		}
	;
	export function restore<fdu extends Function.Declaration>(snapshot: Snapshot<fdu>): ChatMessage<fdu> {
		if (snapshot.type === 'RoleMessage.User')
			return RoleMessageStatic.User.restore(snapshot.value);
		else if (snapshot.type === 'RoleMessage.AI')
			return RoleMessageStatic.AIStatic.restore(snapshot.value);
		else throw new Error();
	}
	export function capture<fdu extends Function.Declaration>(chatMessage: ChatMessage<fdu>): Snapshot<fdu> {
		return chatMessage instanceof RoleMessageStatic.User ? {
			type: 'RoleMessage.User',
			value: RoleMessageStatic.User.capture(chatMessage),
		} : {
			type: 'RoleMessage.AI',
			value: RoleMessageStatic.AIStatic.capture(chatMessage),
		};
	}
}


export abstract class RoleMessage {
	public static readonly ROLE_MESSAGE_NOMINAL = Symbol();
	private declare readonly [RoleMessage.ROLE_MESSAGE_NOMINAL]: void;
}

export namespace RoleMessageStatic {
	export namespace PartStatic {
		export class Text {
			public static readonly Text_NOMINAL = Symbol();
			private declare readonly [Text.Text_NOMINAL]: void;
			public constructor(public text: string) {}
		}
		export namespace TextStatic {
			export type Snapshot = string;
			export function capture(part: Text): TextStatic.Snapshot {
				return part.text;
			}
			export function restore(snapshot: TextStatic.Snapshot): Text {
				return new Text(snapshot);
			}
		}
	}

	export class AI<out fdu extends Function.Declaration = never> extends RoleMessage {
		public static readonly AI_NOMINAL = Symbol();
		private declare readonly [AI.AI_NOMINAL]: void;
		public constructor(public parts: AIStatic.Part<fdu>[]) {
			super();
		}
		public getText(): string {
			return this.parts.filter(part => part instanceof RoleMessageStatic.PartStatic.Text).map(part => part.text).join('');
		}
		public getOnlyText(): string {
			assert(this.parts.every(part => part instanceof RoleMessageStatic.PartStatic.Text));
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
	export namespace AIStatic {
		export function capture<fdu extends Function.Declaration>(message: AI<fdu>): AIStatic.Snapshot<fdu> {
			return message.parts.map(AIStatic.PartStatic.capture<fdu>);
		}
		export function restore<fdu extends Function.Declaration>(snapshot: AIStatic.Snapshot<fdu>): AI<fdu> {
			return new AI(snapshot.map(AIStatic.PartStatic.restore<fdu>));
		}
		export type Snapshot<fdu extends Function.Declaration = never> = PartStatic.Snapshot<fdu>[];
		export type Part<fdu extends Function.Declaration = never> = RoleMessageStatic.PartStatic.Text | Function.Call.Distributive<fdu>;
		export namespace PartStatic {
			export function restore<fdu extends Function.Declaration>(snapshot: PartStatic.Snapshot<fdu>): Part<fdu> {
				if (snapshot.type === 'RoleMessage.Part.Text')
					return RoleMessageStatic.PartStatic.TextStatic.restore(snapshot.value);
				else if (snapshot.type === 'Function.Call')
					return Function.Call.restore<fdu>(snapshot.value);
				else throw new Error();
			}
			export function capture<fdu extends Function.Declaration>(part: Part<fdu>): PartStatic.Snapshot<fdu> {
				return part instanceof RoleMessageStatic.PartStatic.Text ? {
					type: 'RoleMessage.Part.Text',
					value: RoleMessageStatic.PartStatic.TextStatic.capture(part),
				} : {
					type: 'Function.Call',
					value: Function.Call.capture(part),
				};
			}
			export type Snapshot<fdu extends Function.Declaration = never> =
				| {
					type: 'RoleMessage.Part.Text';
					value: RoleMessageStatic.PartStatic.TextStatic.Snapshot;
				}
				| {
					type: 'Function.Call';
					value: Function.Call.Snapshot.Distributive<fdu>;
				}
			;
		}
	}

	export class User<out fdu extends Function.Declaration = never> extends RoleMessage {
		public static readonly USER_NOMINAL = Symbol();
		private declare readonly [User.USER_NOMINAL]: void;
		public constructor(public parts: User.Part<fdu>[]) {
			super();
		}
		public getText(): string {
			return this.parts.filter(part => part instanceof RoleMessageStatic.PartStatic.Text).map(part => part.text).join('');
		}
		public getOnlyText(): string {
			assert(this.parts.every(part => part instanceof RoleMessageStatic.PartStatic.Text));
			return this.getText();
		}
		public getFunctionResponses(): Function.Response.Distributive<fdu>[] {
			return this.parts.filter(part => part instanceof Function.Response);
		}
		public getOnlyFunctionResponse(): Function.Response.Distributive<fdu> {
			assert(this.parts.length === 1 && this.parts[0] instanceof Function.Response);
			return this.parts[0]! as Function.Response.Distributive<fdu>;
		}
		public static capture<fdu extends Function.Declaration>(message: User<fdu>): User.Snapshot<fdu> {
			return message.parts.map(User.PartStatic.capture<fdu>);
		}
		public static restore<fdu extends Function.Declaration>(snapshot: User.Snapshot<fdu>): User<fdu> {
			return new User(snapshot.map(User.PartStatic.restore<fdu>));
		}
	}
	export namespace User {
		export type Snapshot<fdu extends Function.Declaration = never> = PartStatic.Snapshot<fdu>[];
		export type Part<fdu extends Function.Declaration = never> = RoleMessageStatic.PartStatic.Text | Function.Response.Distributive<fdu>;
		export namespace PartStatic {
			export function restore<fdu extends Function.Declaration>(snapshot: PartStatic.Snapshot<fdu>): Part<fdu> {
				if (snapshot.type === 'RoleMessage.Part.Text')
					return RoleMessageStatic.PartStatic.TextStatic.restore(snapshot.value);
				else if (snapshot.type === 'Function.Response')
					return Function.Response.restore<fdu>(snapshot.value);
				else throw new Error();
			}
			export function capture<fdu extends Function.Declaration>(part: Part<fdu>): PartStatic.Snapshot<fdu> {
				return part instanceof RoleMessageStatic.PartStatic.Text ? {
					type: 'RoleMessage.Part.Text',
					value: RoleMessageStatic.PartStatic.TextStatic.capture(part),
				} : {
					type: 'Function.Response',
					value: Function.Response.capture(part),
				};
			}
			export type Snapshot<fdu extends Function.Declaration = never> =
				| {
					type: 'RoleMessage.Part.Text';
					value: RoleMessageStatic.PartStatic.TextStatic.Snapshot;
				}
				| {
					type: 'Function.Response';
					value: Function.Response.Snapshot.Distributive<fdu>;
				}
			;
		}
	}

	export class Developer extends RoleMessage {
		public static readonly DEVELOPER_NOMINAL = Symbol();
		private declare readonly [Developer.DEVELOPER_NOMINAL]: void;
		public constructor(public parts: DeveloperStatic.Part[]) {
			super();
		}
		public getText(): string {
			return this.parts.map(part => part.text).join('');
		}
		public getOnlyText(): string {
			return this.getText();
		}
	}
	export namespace DeveloperStatic {
		export type Snapshot = RoleMessageStatic.PartStatic.TextStatic.Snapshot[];
		export type Part = RoleMessageStatic.PartStatic.Text;
		export function capture(message: Developer): DeveloperStatic.Snapshot {
			return message.parts.map(RoleMessageStatic.PartStatic.TextStatic.capture);
		}
		export function restore(snapshot: DeveloperStatic.Snapshot): Developer {
			return new Developer(snapshot.map(RoleMessageStatic.PartStatic.TextStatic.restore));
		}
	}
}
