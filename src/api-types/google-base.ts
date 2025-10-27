import { Engine } from '../engine.ts';
import { RoleMessage, type ChatMessage } from '../session.ts';
import { Function } from '../function.ts';
import * as Google from '@google/genai';
import assert from 'node:assert';
import { APIBase, TransientError } from './base.ts';
import Ajv from 'ajv';

const ajv = new Ajv();

export abstract class GoogleAPIBase<in out fdm extends Function.Declaration.Map = {}> extends APIBase<fdm> {
	protected constructor(options: Engine.Options<fdm>) {
		super(options);
	}

	protected convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Google.FunctionCall {
		return {
			id: fc.id,
			name: fc.name,
			args: fc.args as Record<string, unknown>,
		};
	}
	protected convertToFunctionCall(googlefc: Google.FunctionCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
		assert(googlefc.name);
		const fditem = this.functionDeclarationMap[googlefc.name] as Function.Declaration.Item.From<fdm> | undefined;
		assert(fditem);
		assert(ajv.validate(fditem.paraschema, googlefc.args), new TransientError('Invalid function call', { cause: googlefc }));
		return Function.Call.create({
			id: googlefc.id,
			name: googlefc.name,
			args: googlefc.args,
		} as Function.Call.create.Options<Function.Declaration.From<fdm>>);
	}

	protected convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Google.Content {
		const parts = userMessage.parts.map(part => {
			if (part instanceof RoleMessage.Part.Text.Constructor)
				return Google.createPartFromText(part.text);
			else if (part instanceof Function.Response)
				return {
					functionResponse: { id: part.id, name: part.name, response: { returnValue: part.text } },
				};
			else throw new Error();
		});
		return Google.createUserContent(parts);
	}
	protected convertFromAIMessage(aiMessage: RoleMessage.AI<Function.Declaration.From<fdm>>): Google.Content {
		if (aiMessage instanceof GoogleAIMessage.Constructor)
			return aiMessage.raw;
		else {
			const parts = aiMessage.parts.map(part => {
				if (part instanceof RoleMessage.Part.Text.Constructor)
					return Google.createPartFromText(part.text);
				else if (part instanceof Function.Call) {
					assert(part.args instanceof Object);
					return Google.createPartFromFunctionCall(part.name, part.args as Record<string, unknown>);
				} else throw new Error();
			});
			return Google.createModelContent(parts);
		}
	}
	protected convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content {
		const parts = developerMessage.parts.map(part => Google.createPartFromText(part.text));
		return { parts };
	}
	protected convertFromChatMessages(chatMessages: ChatMessage<Function.Declaration.From<fdm>>[]): Google.Content[] {
		return chatMessages.map(chatMessage => {
			if (chatMessage instanceof RoleMessage.User.Constructor) return this.convertFromUserMessage(chatMessage);
			else if (chatMessage instanceof RoleMessage.AI.Constructor) return this.convertFromAIMessage(chatMessage);
			else throw new Error();
		});
	}

	protected convertToAIMessage(content: Google.Content): GoogleAIMessage<Function.Declaration.From<fdm>> {
		assert(content.parts);
		return GoogleAIMessage.create(content.parts.flatMap(part => {
			const parts: RoleMessage.AI.Part<Function.Declaration.From<fdm>>[] = [];
			if (part.text) parts.push(RoleMessage.Part.Text.create(part.text));
			if (part.functionCall) parts.push(this.convertToFunctionCall(part.functionCall));
			return parts;
		}), content);
	}

	protected convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Google.FunctionDeclaration {
		const json = JSON.stringify(fdentry[1].paraschema);
		const parsed = JSON.parse(json, (key, value) => {
			if (key === 'type' && typeof value === 'string') {
				if (value === 'string') return Google.Type.STRING;
				else if (value === 'number') return Google.Type.NUMBER;
				else if (value === 'boolean') return Google.Type.BOOLEAN;
				else if (value === 'object') return Google.Type.OBJECT;
				else if (value === 'array') return Google.Type.ARRAY;
				else throw new Error();
			} else if (key === 'additionalProperties' && typeof value === 'boolean')
				return;
			else return value;
		}) as Google.Schema;
		return {
			name: fdentry[0],
			description: fdentry[1].description,
			parameters: parsed,
		};
	}

	protected convertFromFunctionCallMode(mode: Function.ToolChoice<fdm>): Google.FunctionCallingConfig {
		if (mode === Function.ToolChoice.NONE) return { mode: Google.FunctionCallingConfigMode.NONE };
		else if (mode === Function.ToolChoice.REQUIRED) return { mode: Google.FunctionCallingConfigMode.ANY };
		else if (mode === Function.ToolChoice.AUTO) return { mode: Google.FunctionCallingConfigMode.AUTO };
		else return { mode: Google.FunctionCallingConfigMode.ANY, allowedFunctionNames: [...mode] };
	}

	protected validateFunctionCallByToolChoice(aiMessage: RoleMessage.AI<Function.Declaration.From<fdm>>): void {
		const functionCalls = aiMessage.getFunctionCalls();
		if (this.toolChoice === Function.ToolChoice.REQUIRED)
			assert(functionCalls.length, new TransientError('No function call'));
		else if (this.toolChoice instanceof Array)
			for (const fc of functionCalls) assert(this.toolChoice.includes(fc.name), new TransientError('Invalid function call', { cause: fc }));
		else if (this.toolChoice === Function.ToolChoice.NONE)
			assert(!functionCalls.length, new TransientError('No function should be called.'));
	}
}


export type GoogleAIMessage<fdu extends Function.Declaration> = GoogleAIMessage.Constructor<fdu>;
export namespace GoogleAIMessage {
	export function create<fdu extends Function.Declaration>(parts: RoleMessage.AI.Part<fdu>[], raw: Google.Content): GoogleAIMessage<fdu> {
		return new Constructor(parts, raw);
	}
	export const NOMINAL = Symbol();
	export class Constructor<out fdu extends Function.Declaration> extends RoleMessage.AI.Constructor<fdu> {
		public declare readonly [NOMINAL]: void;
		public constructor(parts: RoleMessage.AI.Part<fdu>[], public raw: Google.Content) {
			super(parts);
		}
	}
	export interface Snapshot<in out fdu extends Function.Declaration = never> {
		parts: RoleMessage.AI.Part.Snapshot<fdu>[];
		raw: Google.Content;
	}
	export function restore<fdu extends Function.Declaration>(snapshot: GoogleAIMessage.Snapshot<fdu>): GoogleAIMessage<fdu> {
		return new Constructor(RoleMessage.AI.restore<fdu>(snapshot.parts).parts, snapshot.raw);
	}
	export function capture<fdu extends Function.Declaration>(message: GoogleAIMessage<fdu>): GoogleAIMessage.Snapshot<fdu> {
		return {
			parts: RoleMessage.AI.capture(message),
			raw: message.raw,
		};
	}
}
