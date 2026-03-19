import { ResponseInvalid } from '../../engine.ts';
import { RoleMessage } from '../../session.ts';
import { Function } from '../../function.ts';
import OpenAI from 'openai';
import type { OpenAIChatCompletionsToolCodec } from '../../api-types/openai-chatcompletion/tool-codec.ts';



export class OpenAIChatCompletionsCompatibleMessageCodec<in out fdm extends Function.Declaration.Map> {
    public constructor(protected ctx: OpenAIChatCompletionsCompatibleMessageCodec.Context<fdm>) {}

    public convertToAiMessage(
        message: OpenAI.ChatCompletionMessage,
    ): RoleMessage.Ai<Function.Declaration.From<fdm>> {
        const parts: RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] = [];
        if (message.content)
            parts.push(RoleMessage.Part.Text.create(message.content));
        if (message.tool_calls)
            parts.push(...message.tool_calls.map(apifc => {
                if (apifc.type === 'function') {} else throw new Error();
                return this.ctx.toolCodec.convertToFunctionCall(apifc);
            }));
        if (parts.length) {} else throw new ResponseInvalid('Content or tool calls not found in Response', { cause: message });
        return RoleMessage.Ai.create(parts);
    }

    public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): OpenAI.ChatCompletionSystemMessageParam {
        return {
            role: 'system',
            content: developerMessage.getOnlyText(),
        };
    }

    public convertFromUserMessage(
        userMessage: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): [OpenAI.ChatCompletionUserMessageParam] | OpenAI.ChatCompletionToolMessageParam[] {
        const textParts = userMessage.getParts().filter(part => part instanceof RoleMessage.Part.Text.Instance);
        const frs = userMessage.getFunctionResponses();
        if (textParts.length && !frs.length)
            return [{ role: 'user', content: textParts.map(part => ({ type: 'text', text: part.text })) }];
        else if (!textParts.length && frs.length)
            return frs.map(fr => this.ctx.toolCodec.convertFromFunctionResponse(fr));
        else throw new Error();
    }

    public convertFromAiMessage(
        aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>,
    ): OpenAI.ChatCompletionAssistantMessageParam {
        const parts = aiMessage.getParts();
        const textParts = parts.filter(part => part instanceof RoleMessage.Part.Text.Instance);
        const fcParts = parts.filter(part => part instanceof Function.Call);
        return {
            role: 'assistant',
            content: textParts.length ? textParts.map(part => part.text).join('') : undefined,
            tool_calls: fcParts.length ? fcParts.map(fc => this.ctx.toolCodec.convertFromFunctionCall(fc)) : undefined,
        };
    }

    public convertFromRoleMessage(
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

}

export namespace OpenAIChatCompletionsCompatibleMessageCodec {
    export interface Context<in out fdm extends Function.Declaration.Map> {
        toolCodec: OpenAIChatCompletionsToolCodec<fdm>;
    }
}
