import { ResponseInvalid } from '../../engine.ts';
import { RoleMessage, type Session } from '../../compatible/session.ts';
import { Function } from '../../function.ts';
import OpenAI from 'openai';
import type { OpenAIChatCompletionsToolCodec } from '../../api-types/openai-chatcompletions/tool-codec.ts';
import type { Verbatim } from '../../verbatim.ts';
import * as VerbatimCodec from '../../verbatim/codec.ts';



export class MessageCodec<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> {
    public constructor(protected ctx: MessageCodec.Context<fdm, vdm>) {}

    /**
     * @throws {@link VerbatimCodec.Request.Invalid}
     */
    public decodeAiMessage(
        message: OpenAI.ChatCompletionMessage,
    ): RoleMessage.Ai.From<fdm, vdm> {
        const parts: RoleMessage.Ai.Part.From<fdm, vdm>[] = [];
        if (message.content) {
            const vrs = VerbatimCodec.Request.decode(message.content, this.ctx.vdm);
            parts.push(new RoleMessage.Part.Text(message.content, vrs));
        }
        if (message.tool_calls)
            parts.push(...message.tool_calls.map(apifc => {
                if (apifc.type === 'function') {} else throw new Error();
                return this.ctx.toolCodec.decodeFunctionCall(apifc);
            }));
        if (parts.length) {} else throw new ResponseInvalid('Content or tool calls not found in Response', { cause: message });
        return new RoleMessage.Ai(parts);
    }

    public encodeDeveloperMessage(developerMessage: RoleMessage.Developer): OpenAI.ChatCompletionSystemMessageParam {
        return {
            role: 'system',
            content: developerMessage.getText(),
        };
    }

    public encodeUserMessage(
        userMessage: RoleMessage.User.From<fdm>,
    ): [OpenAI.ChatCompletionUserMessageParam] | OpenAI.ChatCompletionToolMessageParam[] {
        const textParts = userMessage.getParts().filter(part => part instanceof RoleMessage.Part.Text);
        const frs = userMessage.getFunctionResponses();
        if (textParts.length && !frs.length)
            return [{ role: 'user', content: textParts.map(part => ({ type: 'text', text: part.text })) }];
        else if (!textParts.length && frs.length)
            return frs.map(fr => this.ctx.toolCodec.encodeFunctionResponse(fr));
        else throw new Error();
    }

    public encodeAiMessage(
        aiMessage: RoleMessage.Ai.From<fdm, vdm>,
    ): OpenAI.ChatCompletionAssistantMessageParam {
        const parts = aiMessage.getParts();
        const textParts = parts.filter(part => part instanceof RoleMessage.Part.Text);
        const fcParts = parts.filter(part => part instanceof Function.Call);
        return {
            role: 'assistant',
            content: textParts.length ? textParts.map(part => part.text).join('') : undefined,
            tool_calls: fcParts.length ? fcParts.map(fc => this.ctx.toolCodec.encodeFunctionCall(fc)) : undefined,
        };
    }

    public encodeRoleMessage(
        roleMessage: Session.ChatMessage.From<fdm, vdm> | RoleMessage.Developer,
    ): OpenAI.ChatCompletionMessageParam[] {
        if (roleMessage instanceof RoleMessage.Developer)
            return [this.encodeDeveloperMessage(roleMessage)];
        else if (roleMessage instanceof RoleMessage.User)
            return this.encodeUserMessage(roleMessage);
        else if (roleMessage instanceof RoleMessage.Ai)
            return [this.encodeAiMessage(roleMessage)];
        else throw new Error();
    }

    public encodeRoleMessages(
        chatMessages: (Session.ChatMessage.From<fdm, vdm> | RoleMessage.Developer)[],
    ): OpenAI.ChatCompletionMessageParam[] {
        return chatMessages.map(chatMessage => this.encodeRoleMessage(chatMessage)).flat();
    }

}

export namespace MessageCodec {
    export interface Context<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > {
        toolCodec: OpenAIChatCompletionsToolCodec<fdm>;
        vdm: vdm;
    }
}
