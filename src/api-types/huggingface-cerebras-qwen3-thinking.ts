import { Engine } from '../engine.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import { OpenAIChatCompletionsMonolithAPIBase } from './openai-chatcompletions-monolith-base.ts';
import { RoleMessage } from '../session.ts';
import assert from 'node:assert';
import { TransientError } from './base.ts';



export class HuggingFaceCerebrasQwen3ThinkingAPI<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsMonolithAPIBase<fdm> {
	public static create<fdm extends Function.Declaration.Map = never>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		const api = new HuggingFaceCerebrasQwen3ThinkingAPI(options);
		return api.monolith.bind(api);
	}

	protected override convertFromDeveloperMessage(developerMessage: RoleMessage.DeveloperClass): OpenAI.ChatCompletionSystemMessageParam {
		return {
			role: 'system',
			content: developerMessage.getOnlyText(),
		};
	}
	protected override convertFromUserMessage(userMessage: RoleMessage.UserClass<Function.Declaration.From<fdm>>): [OpenAI.ChatCompletionUserMessageParam] | OpenAI.ChatCompletionToolMessageParam[] {
		const textParts = userMessage.parts.filter(part => part instanceof RoleMessage.Part.TextClass);
		const frs = userMessage.getFunctionResponses();
		if (textParts.length && !frs.length)
			return [{ role: 'user', content: textParts.map(part => part.text).join('') }];
		else if (!textParts.length && frs.length)
			return frs.map(fr => this.convertFromFunctionResponse(fr));
		else throw new Error();
	}
	protected override convertFromAIMessage(aiMessage: RoleMessage.AIClass<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionAssistantMessageParam {
		const textParts = aiMessage.parts.filter(part => part instanceof RoleMessage.Part.TextClass);
		const fcParts = aiMessage.parts.filter(part => part instanceof Function.Call);
		return {
			role: 'assistant',
			content: textParts.length ? textParts.map(part => part.text).join('') : undefined,
			tool_calls: fcParts.length ? fcParts.map(fc => this.convertFromFunctionCall(fc)) : undefined,
		};
	}
	protected override convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionToolMessageParam {
		assert(fr.id);
		return {
			role: 'tool',
			tool_call_id: fr.id,
			content: fr.text,
		};
	}

	protected override extractContent(completionContent: string): string {
		const match = completionContent.match(/(?:<think>)?(?<thoughts>.*?)<\/think>(?<content>.*)/us);
		assert(match, new TransientError('Response doesn\'t conform to the expected pattern.', { cause: completionContent }));
		return match.groups!.content!.trimStart();
	}
}
