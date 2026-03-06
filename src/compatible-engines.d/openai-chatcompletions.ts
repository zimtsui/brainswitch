import { type CompatibleEngine } from '../compatible-engine.ts';
import { ResponseInvalid } from '../engine.ts';
import { RoleMessage, type Session } from '../session.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import type { InferenceContext } from '../inference-context.ts';
import { type OpenAIChatCompletionsEngine } from '../api-types/openai-chat-completions.ts';



export namespace OpenAIChatCompletionsCompatibleEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends
        OpenAIChatCompletionsEngine.Options<fdm>,
        CompatibleEngine.Options<fdm>
    {}

    export interface Underhood<in out fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Underhood<fdm>,
        OpenAIChatCompletionsEngine.Underhood<fdm>
    {
        fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        convertToAiMessage(message: OpenAI.ChatCompletionMessage): RoleMessage.Ai<Function.Declaration.From<fdm>>;
        convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): OpenAI.ChatCompletionSystemMessageParam;
        convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): [OpenAI.ChatCompletionUserMessageParam] | OpenAI.ChatCompletionToolMessageParam[];
        convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionAssistantMessageParam;
        convertFromRoleMessage(roleMessage: RoleMessage): OpenAI.ChatCompletionMessageParam[];
        validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void;
        fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    }

    export async function fetch<fdm extends Function.Declaration.Map>(
        this: OpenAIChatCompletionsCompatibleEngine.Underhood<fdm>,
        ctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        return await this.fetchRaw(ctx, session, signal).catch(e => Promise.reject(e instanceof OpenAI.APIError ? new ResponseInvalid(undefined, { cause: e }) : e));
    }

    export function convertToAiMessage<fdm extends Function.Declaration.Map>(
        this: OpenAIChatCompletionsCompatibleEngine.Underhood<fdm>,
        message: OpenAI.ChatCompletionMessage,
    ): RoleMessage.Ai<Function.Declaration.From<fdm>> {
        const parts: RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] = [];
        if (message.content)
            parts.push(RoleMessage.Part.Text.create(this.extractContent(message.content)));
        if (message.tool_calls)
            parts.push(...message.tool_calls.map(apifc => {
                if (apifc.type === 'function') {} else throw new Error();
                return this.convertToFunctionCall(apifc);
            }));
        if (parts.length) {} else throw new ResponseInvalid('Content or tool calls not found in Response', { cause: message });
        return RoleMessage.Ai.create(parts);
    }


    export function convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): OpenAI.ChatCompletionSystemMessageParam {
        return {
            role: 'system',
            content: developerMessage.getOnlyText(),
        };
    }

    export function convertFromUserMessage<fdm extends Function.Declaration.Map>(
        this: OpenAIChatCompletionsEngine.Underhood<fdm>,
        userMessage: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): [OpenAI.ChatCompletionUserMessageParam] | OpenAI.ChatCompletionToolMessageParam[] {
        const textParts = userMessage.getParts().filter(part => part instanceof RoleMessage.Part.Text.Instance);
        const frs = userMessage.getFunctionResponses();
        if (textParts.length && !frs.length)
            return [{ role: 'user', content: textParts.map(part => ({ type: 'text', text: part.text })) }];
        else if (!textParts.length && frs.length)
            return frs.map(fr => this.convertFromFunctionResponse(fr));
        else throw new Error();
    }

    export function convertFromAiMessage<fdm extends Function.Declaration.Map>(
        this: OpenAIChatCompletionsEngine.Underhood<fdm>,
        aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>,
    ): OpenAI.ChatCompletionAssistantMessageParam {
        const parts = aiMessage.getParts();
        const textParts = parts.filter(part => part instanceof RoleMessage.Part.Text.Instance);
        const fcParts = parts.filter(part => part instanceof Function.Call);
        return {
            role: 'assistant',
            content: textParts.length ? textParts.map(part => part.text).join('') : undefined,
            tool_calls: fcParts.length ? fcParts.map(fc => this.convertFromFunctionCall(fc)) : undefined,
        };
    }

    export function convertFromRoleMessage<fdm extends Function.Declaration.Map>(
        this: OpenAIChatCompletionsCompatibleEngine.Underhood<fdm>,
        roleMessage: RoleMessage,
    ): OpenAI.ChatCompletionMessageParam[] {
        if (roleMessage instanceof RoleMessage.Developer.Instance)
            return [this.convertFromDeveloperMessage(roleMessage)];
        else if (roleMessage instanceof RoleMessage.User.Instance)
            return this.convertFromUserMessage(roleMessage);
        else if (roleMessage instanceof RoleMessage.Ai.Instance)
            return [this.convertFromAiMessage(roleMessage)];
        else throw new Error();
    }

    export function validateToolCallsByToolChoice<fdm extends Function.Declaration.Map>(
        this: OpenAIChatCompletionsCompatibleEngine.Underhood<fdm>,
        toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[],
    ): void {
        // https://community.openai.com/t/function-call-with-finish-reason-of-stop/437226/7
        Function.Call.validate<fdm>(
            toolCalls,
            this.toolChoice,
            new ResponseInvalid('Invalid function call', { cause: toolCalls }),
        );
    }
}
