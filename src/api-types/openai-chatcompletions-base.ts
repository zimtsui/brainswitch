import { type Engine } from '../engine.ts';
import { RoleMessage } from '../session.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { EngineBase, TransientError } from './base.ts';
import { Ajv } from 'ajv';


const ajv = new Ajv();


export abstract class OpenAIChatCompletionsEngineBase<in out fdm extends Function.Declaration.Map = {}> extends EngineBase<fdm> {
	protected override parallel: boolean;

	public constructor(options: Engine.Options<fdm>) {
		super(options);
		this.parallel = options.parallelFunctionCall ?? false;
	}

	protected convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionMessageToolCall {
		assert(fc.id);
		return {
			id: fc.id,
			type: 'function',
			function: {
				name: fc.name,
				arguments: JSON.stringify(fc.args),
			},
		};
	}
	protected convertToFunctionCall(apifc: OpenAI.ChatCompletionMessageFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
		const fditem = this.fdm[apifc.function.name] as Function.Declaration.Item.From<fdm>;
		assert(fditem, new TransientError('Invalid function call', { cause: apifc }));
		const args = (() => {
			try {
				return JSON.parse(apifc.function.arguments);
			} catch (e) {
				return new TransientError('Invalid function call', { cause: apifc });
			}
		})();
		assert(
			ajv.validate(fditem.paraschema, args),
			new TransientError('Invalid function call', { cause: apifc }),
		);
		return Function.Call.create({
			id: apifc.id,
			name: apifc.function.name,
			args,
		} as Function.Call.create.Options<Function.Declaration.From<fdm>>);
	}


	protected convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionToolMessageParam {
		assert(fr.id);
		return {
			role: 'tool',
			tool_call_id: fr.id,
			content: fr.text,
		};
	}
	protected convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): OpenAI.ChatCompletionSystemMessageParam {
		return {
			role: 'system',
			content: developerMessage.getOnlyText(),
		};
	}
	protected convertFromUserMessage(
		userMessage: RoleMessage.User<Function.Declaration.From<fdm>>,
	): [OpenAI.ChatCompletionUserMessageParam] | OpenAI.ChatCompletionToolMessageParam[] {
		const textParts = userMessage.parts.filter(part => part instanceof RoleMessage.Part.Text.Constructor);
		const frs = userMessage.getFunctionResponses();
		if (textParts.length && !frs.length)
			return [{ role: 'user', content: textParts.map(part => ({ type: 'text', text: part.text })) }];
		else if (!textParts.length && frs.length)
			return frs.map(fr => this.convertFromFunctionResponse(fr));
		else throw new Error();
	}
	protected convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionAssistantMessageParam {
		const textParts = aiMessage.parts.filter(part => part instanceof RoleMessage.Part.Text.Constructor);
		const fcParts = aiMessage.parts.filter(part => part instanceof Function.Call);
		return {
			role: 'assistant',
			content: textParts.length ? textParts.map(part => part.text).join('') : undefined,
			tool_calls: fcParts.length ? fcParts.map(fc => this.convertFromFunctionCall(fc)) : undefined,
		};
	}
	protected convertFromRoleMessage(roleMessage: RoleMessage): OpenAI.ChatCompletionMessageParam[] {
		if (roleMessage instanceof RoleMessage.Developer.Constructor)
			return [this.convertFromDeveloperMessage(roleMessage)];
		else if (roleMessage instanceof RoleMessage.User.Constructor)
			return this.convertFromUserMessage(roleMessage);
		else if (roleMessage instanceof RoleMessage.Ai.Constructor)
			return [this.convertFromAiMessage(roleMessage)];
		else throw new Error();
	}

	protected convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.ChatCompletionTool {
		return {
			type: 'function',
			function: {
				name: fdentry[0],
				description: fdentry[1].description,
				strict: true,
				parameters: fdentry[1].paraschema,
			},
		};
	}

	protected convertFromToolChoice(mode: Function.ToolChoice<fdm>): OpenAI.ChatCompletionToolChoiceOption {
		if (mode === Function.ToolChoice.NONE) return 'none';
		else if (mode === Function.ToolChoice.REQUIRED) return 'required';
		else if (mode === Function.ToolChoice.AUTO) return 'auto';
		else {
			assert(mode.length === 1);
			return { type: 'function', function: { name: mode[0]! } };
		}
	}

	protected validateFunctionCallByToolChoice(fcs: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void {
		// https://community.openai.com/t/function-call-with-finish-reason-of-stop/437226/7
		if (this.toolChoice === Function.ToolChoice.REQUIRED)
			assert(fcs.length, new TransientError());
		else if (this.toolChoice instanceof Array)
			for (const fc of fcs) assert(this.toolChoice.includes(fc.name), new TransientError());
		else if (this.toolChoice === Function.ToolChoice.NONE)
			assert(!fcs.length, new TransientError());
	}

	protected calcCost(usage: OpenAI.CompletionUsage): number {
		const cacheHitTokenCount = usage.prompt_tokens_details?.cached_tokens ?? 0;
		const cacheMissTokenCount = usage.prompt_tokens - cacheHitTokenCount;
		return	this.inputPrice * cacheMissTokenCount / 1e6 +
				this.cachedPrice * cacheHitTokenCount / 1e6 +
				this.outputPrice * usage.completion_tokens / 1e6;
	}

	protected extractContent(completionContent: string): string {
		return completionContent;
	}
}
