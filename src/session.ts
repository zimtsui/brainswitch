import assert from 'node:assert';
import { Function } from './function.ts';


export interface Session<out fdu extends Function.Declaration = never> {
	developerMessage?: RoleMessage.Developer.Constructor;
	chatMessages: ChatMessage<fdu>[];
}
export namespace Session {
	export interface Snapshot<in out fdu extends Function.Declaration = never> {
		developerMessage?: RoleMessage.Developer.Snapshot;
		chatMessages: ChatMessage.Snapshot<fdu>[];
	}
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

export type ChatMessage<fdu extends Function.Declaration = never> = RoleMessage.User.Constructor<fdu> | RoleMessage.AI.Constructor<fdu>;
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
		return chatMessage instanceof RoleMessage.User.Constructor ? {
			type: 'RoleMessage.User',
			value: RoleMessage.User.capture(chatMessage),
		} : {
			type: 'RoleMessage.AI',
			value: RoleMessage.AI.capture(chatMessage),
		};
	}
}


export type RoleMessage = RoleMessage.Constructor;
export namespace RoleMessage {
	export abstract class Constructor {
		public static readonly ROLE_MESSAGE_NOMINAL = Symbol();
		private declare readonly [Constructor.ROLE_MESSAGE_NOMINAL]: void;
	}
	export namespace Part {
		export type Text = Text.Constructor;
		export namespace Text {
			export function create(text: string): Text {
				return new Constructor(text);
			}
			export class Constructor {
				public static readonly Text_NOMINAL = Symbol();
				private declare readonly [Constructor.Text_NOMINAL]: void;
				public constructor(public text: string) {}
			}
			export type Snapshot = string;
			export function capture(part: Constructor): Snapshot {
				return part.text;
			}
			export function restore(snapshot: Snapshot): Constructor {
				return new Constructor(snapshot);
			}
		}
	}

	export type AI<fdu extends Function.Declaration = never> = AI.Constructor<fdu>;
	export namespace AI {
		export function create<fdu extends Function.Declaration>(parts: AI.Part<fdu>[]): AI<fdu> {
			return new Constructor(parts);
		}
		export const NOMINAL = Symbol();
		export class Constructor<out fdu extends Function.Declaration = never> extends RoleMessage.Constructor {
			public declare readonly [NOMINAL]: void;
			public constructor(public parts: AI.Part<fdu>[]) {
				super();
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
		export function capture<fdu extends Function.Declaration>(message: Constructor<fdu>): Snapshot<fdu> {
			return message.parts.map(AI.Part.capture<fdu>);
		}
		export function restore<fdu extends Function.Declaration>(snapshot: Snapshot<fdu>): Constructor<fdu> {
			return new Constructor(snapshot.map(AI.Part.restore<fdu>));
		}
		export type Snapshot<fdu extends Function.Declaration = never> = Part.Snapshot<fdu>[];
		export type Part<fdu extends Function.Declaration = never> = RoleMessage.Part.Text | Function.Call.Distributive<fdu>;
		export namespace Part {
			export function restore<fdu extends Function.Declaration>(snapshot: Part.Snapshot<fdu>): Part<fdu> {
				if (snapshot.type === 'RoleMessage.Part.Text')
					return RoleMessage.Part.Text.restore(snapshot.value);
				else if (snapshot.type === 'Function.Call')
					return Function.Call.restore<fdu>(snapshot.value);
				else throw new Error();
			}
			export function capture<fdu extends Function.Declaration>(part: Part<fdu>): Part.Snapshot<fdu> {
				return part instanceof RoleMessage.Part.Text.Constructor ? {
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

	export type User<fdu extends Function.Declaration = never> = User.Constructor<fdu>;
	export namespace User {
		export function create<fdu extends Function.Declaration>(parts: User.Part<fdu>[]): User<fdu> {
			return new Constructor(parts);
		}
		export class Constructor<out fdu extends Function.Declaration = never> extends RoleMessage.Constructor {
			public static readonly USER_NOMINAL = Symbol();
			private declare readonly [Constructor.USER_NOMINAL]: void;
			public constructor(public parts: User.Part<fdu>[]) {
				super();
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
		export function capture<fdu extends Function.Declaration>(message: Constructor<fdu>): Snapshot<fdu> {
			return message.parts.map(User.Part.capture<fdu>);
		}
		export function restore<fdu extends Function.Declaration>(snapshot: Snapshot<fdu>): Constructor<fdu> {
			return new Constructor(snapshot.map(User.Part.restore<fdu>));
		}
		export type Snapshot<fdu extends Function.Declaration = never> = Part.Snapshot<fdu>[];
		export type Part<fdu extends Function.Declaration = never> = RoleMessage.Part.Text | Function.Response.Distributive<fdu>;
		export namespace Part {
			export function restore<fdu extends Function.Declaration>(snapshot: Part.Snapshot<fdu>): Part<fdu> {
				if (snapshot.type === 'RoleMessage.Part.Text')
					return RoleMessage.Part.Text.restore(snapshot.value);
				else if (snapshot.type === 'Function.Response')
					return Function.Response.restore<fdu>(snapshot.value);
				else throw new Error();
			}
			export function capture<fdu extends Function.Declaration>(part: Part<fdu>): Part.Snapshot<fdu> {
				return part instanceof RoleMessage.Part.Text.Constructor ? {
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

	export type Developer = Developer.Constructor;
	export namespace Developer {
		export function create(parts: Developer.Part[]): Developer {
			return new Constructor(parts);
		}
		export class Constructor extends RoleMessage.Constructor {
			public static readonly DEVELOPER_NOMINAL = Symbol();
			private declare readonly [Constructor.DEVELOPER_NOMINAL]: void;
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
		export type Snapshot = RoleMessage.Part.Text.Snapshot[];
		export type Part = RoleMessage.Part.Text.Constructor;
		export function capture(message: Constructor): Snapshot {
			return message.parts.map(RoleMessage.Part.Text.capture);
		}
		export function restore(snapshot: Snapshot): Constructor {
			return new Constructor(snapshot.map(RoleMessage.Part.Text.restore));
		}
	}
}
