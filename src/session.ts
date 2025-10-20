import assert from 'node:assert';
import { Function } from './function.ts';


export interface Session<out fdu extends Function.Declaration = never> {
	developerMessage?: RoleMessage.Developer;
	chatMessages: ChatMessage<fdu>[];
}
export namespace Session {
	export type Snapshot<fdu extends Function.Declaration = never> = {
		developerMessage?: RoleMessage.Developer.Snapshot;
		chatMessages: ChatMessage.Snapshot<fdu>[];
	};
	export function restore<fdu extends Function.Declaration>(snapshot: Snapshot<fdu>): Session<fdu> {
		return {
			developerMessage: snapshot.developerMessage && RoleMessage.Developer.restore(snapshot.developerMessage),
			chatMessages: snapshot.chatMessages.map(ChatMessage.restore<fdu>),
		};
	}
	export function capture<fdu extends Function.Declaration>(session: Session<fdu>): Snapshot<fdu> {
		return {
			developerMessage: session.developerMessage && RoleMessage.Developer.capture(session.developerMessage),
			chatMessages: session.chatMessages.map(ChatMessage.capture<fdu>),
		};
	}
}

export type ChatMessage<fdu extends Function.Declaration = never> = RoleMessage.User<fdu> | RoleMessage.AI<fdu>;
export namespace ChatMessage {
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
		return chatMessage instanceof RoleMessage.User ? {
			type: 'RoleMessage.User',
			value: RoleMessage.User.capture(chatMessage),
		} : {
			type: 'RoleMessage.AI',
			value: RoleMessage.AI.capture(chatMessage),
		};
	}
}


export abstract class RoleMessage<out fdu extends Function.Declaration = never> {
	public static readonly ROLE_MESSAGE_NOMINAL = Symbol();
	private declare readonly [RoleMessage.ROLE_MESSAGE_NOMINAL]: void;
}

export namespace RoleMessage {
	export class Text {
		public static readonly Text_NOMINAL = Symbol();
		private declare readonly [Text.Text_NOMINAL]: void;
		public constructor(public text: string) {}
		public static capture(part: Text): Text.Snapshot {
			return part.text;
		}
		public static restore(snapshot: Text.Snapshot): Text {
			return new Text(snapshot);
		}
	}
	export namespace Text {
		export type Snapshot = string;
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
		public static capture<fdu extends Function.Declaration>(message: AI<fdu>): AI.Snapshot<fdu> {
			return {
				parts: message.parts.map(part => part instanceof Text ? {
					type: 'RoleMessage.Text',
					value: Text.capture(part),
				} : {
					type: 'Function.Call',
					value: Function.Call.capture(part),
				}),
			};
		}
		public static restore<fdu extends Function.Declaration>(snapshot: AI.Snapshot<fdu>): AI<fdu> {
			return new AI(snapshot.parts.map(partSnapshot => AI.Part.restore<fdu>(partSnapshot)));
		}
	}
	export namespace AI {
		export interface Snapshot<fdu extends Function.Declaration = never> {
			parts: Part.Snapshot<fdu>[];
		}
		export type Part<fdu extends Function.Declaration = never> = Text | Function.Call.Distributive<fdu>;
		export namespace Part {
			export function restore<fdu extends Function.Declaration>(snapshot: Part.Snapshot<fdu>): Part<fdu> {
				if (snapshot.type === 'RoleMessage.Text')
					return Text.restore(snapshot.value);
				else if (snapshot.type === 'Function.Call')
					return Function.Call.restore<fdu>(snapshot.value);
				else throw new Error();
			}
			export type Snapshot<fdu extends Function.Declaration = never> =
				| {
					type: 'RoleMessage.Text';
					value: Text.Snapshot;
				}
				| {
					type: 'Function.Call';
					value: Function.Call.Snapshot.Distributive<fdu>;
				}
			;
		}
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
		public static capture<fdu extends Function.Declaration>(message: User<fdu>): User.Snapshot<fdu> {
			return message.parts.map(part => part instanceof Text ? {
				type: 'RoleMessage.Text',
				value: Text.capture(part),
			} : {
				type: 'Function.Response',
				value: Function.Response.capture(part),
			});
		}
		public static restore<fdu extends Function.Declaration>(snapshot: User.Snapshot<fdu>): User<fdu> {
			return new User(snapshot.map(partSnapshot => User.Part.restore<fdu>(partSnapshot)));
		}
	}
	export namespace User {
		export type Snapshot<fdu extends Function.Declaration = never> = Part.Snapshot<fdu>[];
		export type Part<fdu extends Function.Declaration = never> = Text | Function.Response.Distributive<fdu>;
		export namespace Part {
			export function restore<fdu extends Function.Declaration>(snapshot: Part.Snapshot<fdu>): Part<fdu> {
				if (snapshot.type === 'RoleMessage.Text')
					return Text.restore(snapshot.value);
				else if (snapshot.type === 'Function.Response')
					return Function.Response.restore<fdu>(snapshot.value);
				else throw new Error();
			}
			export type Snapshot<fdu extends Function.Declaration = never> =
				| {
					type: 'RoleMessage.Text';
					value: Text.Snapshot;
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
		public constructor(public parts: Developer.Part[]) {
			super();
		}
		public getText(): string {
			return this.parts.map(part => part.text).join('');
		}
		public getOnlyText(): string {
			return this.getText();
		}
		public static capture(message: Developer): Developer.Snapshot {
			return message.parts.map(Text.capture);
		}
		public static restore(snapshot: Developer.Snapshot): Developer {
			return new Developer(snapshot.map(Text.restore));
		}
	}
	export namespace Developer {
		export type Snapshot = Text.Snapshot[];
		export type Part = Text;
	}
}
