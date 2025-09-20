import { ChatCompletion } from '../chat-completion.ts';
import { RoleMessage, type ChatMessage } from '../session.ts';
import { Function } from '../function.ts';
import * as Google from '@google/genai';
import assert from 'node:assert';
import { APIBase, TransientError } from './base.ts';
import Ajv from 'ajv';

const ajv = new Ajv();

export abstract class GoogleAPIBase<in out fd extends Function.Declaration = never> extends APIBase<fd> {
	protected constructor(options: ChatCompletion.Options<fd>) {
		super(options);
	}

	protected convertFromFunctionCall(fc: Function.Call.Union<fd>): Google.FunctionCall {
		return {
			id: fc.id,
			name: fc.name,
			args: fc.args as Record<string, unknown>,
		};
	}
	protected convertToFunctionCall(googlefc: Google.FunctionCall): Function.Call.Union<fd> {
		assert(googlefc.name);
		const fd = this.functionDeclarations.find(fd => fd.name === googlefc.name);
		assert(fd);
		assert(ajv.validate(fd.paraschema, googlefc.args), new TransientError('Invalid function call', { cause: googlefc }));
		return new Function.Call<Function.Declaration>({
			id: googlefc.id,
			name: googlefc.name,
			args: googlefc.args as Function.Call<fd>['args'],
		}) as Function.Call.Union<fd>;
	}

	protected convertFromUserMessage(userMessage: RoleMessage.User<fd>): Google.Content {
		const parts = userMessage.parts.map(part => {
			if (part instanceof RoleMessage.Text)
				return Google.createPartFromText(part.text);
			else if (part instanceof Function.Response)
				return {
					functionResponse: { id: part.id, name: part.name, response: { returnValue: part.text } },
				};
			else throw new Error();
		});
		return Google.createUserContent(parts);
	}
	protected convertFromAIMessage(aiMessage: RoleMessage.AI<fd>): Google.Content {
		if (aiMessage instanceof GoogleAIMessage)
			return aiMessage.raw;
		else {
			const parts = aiMessage.parts.map(part => {
				if (part instanceof RoleMessage.Text)
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
	protected convertFromChatMessages(chatMessages: ChatMessage<fd>[]): Google.Content[] {
		return chatMessages.map(chatMessage => {
			if (chatMessage instanceof RoleMessage.User) return this.convertFromUserMessage(chatMessage);
			else if (chatMessage instanceof RoleMessage.AI) return this.convertFromAIMessage(chatMessage);
			else throw new Error();
		});
	}

	protected convertToAIMessage(content: Google.Content): GoogleAIMessage<fd> {
		assert(content.parts);
		return new GoogleAIMessage(content.parts.flatMap(part => {
			const parts: RoleMessage.AI.Part<fd>[] = [];
			if (part.text) parts.push(new RoleMessage.Text(part.text));
			if (part.functionCall) parts.push(this.convertToFunctionCall(part.functionCall));
			return parts;
		}), content);
	}

	protected convertFromFunctionDeclaration(fd: fd): Google.FunctionDeclaration {
		const json = JSON.stringify(fd.paraschema);
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
			name: fd.name,
			description: fd.description,
			parameters: parsed,
		};
	}

	protected convertFromFunctionCallMode(mode: Function.ToolChoice<fd>): Google.FunctionCallingConfig {
		if (mode === Function.ToolChoice.NONE) return { mode: Google.FunctionCallingConfigMode.NONE };
		else if (mode === Function.ToolChoice.REQUIRED) return { mode: Google.FunctionCallingConfigMode.ANY };
		else if (mode === Function.ToolChoice.AUTO) return { mode: Google.FunctionCallingConfigMode.AUTO };
		else return { mode: Google.FunctionCallingConfigMode.ANY, allowedFunctionNames: [...mode] };
	}

	protected validateFunctionCallByToolChoice(aiMessage: RoleMessage.AI<fd>): void {
		const functionCalls = aiMessage.getFunctionCalls();
		if (this.toolChoice === Function.ToolChoice.REQUIRED)
			assert(functionCalls.length, new TransientError('No function call'));
		else if (this.toolChoice instanceof Array)
			for (const fc of functionCalls) assert(this.toolChoice.includes(fc.name), new TransientError('Invalid function call', { cause: fc }));
		else if (this.toolChoice === Function.ToolChoice.NONE)
			assert(!functionCalls.length, new TransientError('No function should be called.'));
	}
}

export class GoogleAIMessage<out fd extends Function.Declaration> extends RoleMessage.AI<fd> {
	public constructor(parts: RoleMessage.AI.Part<fd>[], public raw: Google.Content) {
		super(parts);
	}
}
