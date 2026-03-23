import { ResponseInvalid } from '#@/engine.ts';
import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import OpenAI from 'openai';
import type { OpenAIChatCompletionsToolCodec } from '#@/api-types/openai-chatcompletion/tool-codec.ts';
import type { Verbatim } from '#@/verbatim.ts';



export class OpenAIChatCompletionsCompatibleMessageCodec<
    in out fdm extends Function.Declaration.Map.Prototype,
    in out vdm extends Verbatim.Declaration.Map.Prototype,
> {
    public constructor(protected ctx: OpenAIChatCompletionsCompatibleMessageCodec.Context<fdm>) {}

    public convertToAiMessage(
        message: OpenAI.ChatCompletionMessage,
    ): RoleMessage.Ai.From<fdm, vdm> {
        const parts: RoleMessage.Ai.Part.From<fdm, vdm>[] = [];
        if (message.content)
            parts.push(new RoleMessage.Part.Text(message.content));
        if (message.tool_calls)
            parts.push(...message.tool_calls.map(apifc => {
                if (apifc.type === 'function') {} else throw new Error();
                return this.ctx.toolCodec.convertToFunctionCall(apifc);
            }));
        if (parts.length) {} else throw new ResponseInvalid('Content or tool calls not found in Response', { cause: message });
        return new RoleMessage.Ai(parts);
    }

    public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): OpenAI.ChatCompletionSystemMessageParam {
        return {
            role: 'system',
            content: developerMessage.getOnlyText(),
        };
    }

    public convertFromUserMessage(
        userMessage: RoleMessage.User.From<fdm>,
    ): [OpenAI.ChatCompletionUserMessageParam] | OpenAI.ChatCompletionToolMessageParam[] {
        const textParts = userMessage.getParts().filter(part => part instanceof RoleMessage.Part.Text);
        const frs = userMessage.getFunctionResponses();
        if (textParts.length && !frs.length)
            return [{ role: 'user', content: textParts.map(part => ({ type: 'text', text: part.text })) }];
        else if (!textParts.length && frs.length)
            return frs.map(fr => this.ctx.toolCodec.convertFromFunctionResponse(fr));
        else throw new Error();
    }

    public convertFromAiMessage(
        aiMessage: RoleMessage.Ai.From<fdm, vdm>,
    ): OpenAI.ChatCompletionAssistantMessageParam {
        const parts = aiMessage.getParts();
        const textParts = parts.filter(part => part instanceof RoleMessage.Part.Text);
        const fcParts = parts.filter(part => part instanceof Function.Call);
        return {
            role: 'assistant',
            content: textParts.length ? textParts.map(part => part.text).join('') : undefined,
            tool_calls: fcParts.length ? fcParts.map(fc => this.ctx.toolCodec.convertFromFunctionCall(fc)) : undefined,
        };
    }

    public convertFromRoleMessage(
        roleMessage: Session.ChatMessage.From<fdm, vdm> | RoleMessage.Developer,
    ): OpenAI.ChatCompletionMessageParam[] {
        if (roleMessage instanceof RoleMessage.Developer)
            return [this.convertFromDeveloperMessage(roleMessage)];
        else if (roleMessage instanceof RoleMessage.User)
            return this.convertFromUserMessage(roleMessage);
        else if (roleMessage instanceof RoleMessage.Ai)
            return [this.convertFromAiMessage(roleMessage)];
        else throw new Error();
    }

    public convertFromRoleMessages(
        chatMessages: (Session.ChatMessage.From<fdm, vdm> | RoleMessage.Developer)[],
    ): OpenAI.ChatCompletionMessageParam[] {
        return chatMessages.map(chatMessage => this.convertFromRoleMessage(chatMessage)).flat();
    }

}

export namespace OpenAIChatCompletionsCompatibleMessageCodec {
    export interface Context<in out fdm extends Function.Declaration.Map.Prototype> {
        toolCodec: OpenAIChatCompletionsToolCodec<fdm>;
    }
}
