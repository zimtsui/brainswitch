import { RoleMessage, type Session } from '#@/native-engines.d/openai-responses/session.ts';
import { Function } from '#@/function.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';
import OpenAI from 'openai';
import { OpenAIResponsesCompatibleMessageCodec } from '#@/compatible.d/openai-responses/message-codec.ts';
import type { OpenAIResponsesToolCodec } from '#@/api-types/openai-responses/tool-codec.ts';



export class OpenAIResponsesNativeMessageCodec<fdm extends Function.Declaration.Map> {
    public constructor(protected ctx: OpenAIResponsesNativeMessageCodec.Context<fdm>) {}

    public convertFromFunctionResponse(
        fr: Function.Response.Distributive<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseInputItem.FunctionCallOutput {
        return this.ctx.toolCodec.convertFromFunctionResponse(fr);
    }

    public convertToAiMessage(
        output: OpenAI.Responses.ResponseOutputItem[],
    ): RoleMessage.Ai<Function.Declaration.From<fdm>> {
        const parts = output.flatMap((item): RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] => {
            if (item.type === 'message') {
                if (item.content.every(part => part.type === 'output_text')) {} else throw new Error();
                return [RoleMessage.Part.Text.create(item.content.map(part => part.text).join(''))];
            } else if (item.type === 'function_call')
                return [this.ctx.toolCodec.convertToFunctionCall(item)];
            else if (item.type === 'reasoning')
                return [];
            else if (item.type === 'apply_patch_call')
                return [Tool.ApplyPatch.Call.create(item)];
            else throw new Error();
        });
        return RoleMessage.Ai.create(parts, output);
    }

    public convertFromUserMessage(
        userMessage: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseInput {
        return userMessage.getParts().map(part => {
            if (part instanceof RoleMessage.Part.Text.Instance)
                return {
                    type: 'message',
                    role: 'user',
                    content: part.text,
                } satisfies OpenAI.Responses.EasyInputMessage;
            else if (part instanceof Function.Response)
                return this.convertFromFunctionResponse(part);
            else if (part instanceof Tool.ApplyPatch.Response)
                return {
                    type: 'apply_patch_call_output',
                    call_id: part.id,
                    status: part.failure ? 'failed' : 'completed',
                    output: part.failure || undefined,
                } satisfies OpenAI.Responses.ResponseInputItem.ApplyPatchCallOutput;
            else throw new Error();
        });
    }

    public convertFromAiMessage(
        aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseInput {
        return aiMessage.getRaw();
    }

    public convertFromDeveloperMessage(
        developerMessage: RoleMessage.Developer,
    ): string {
        return this.ctx.compatibleMessageCodec.convertFromDeveloperMessage(developerMessage);
    }

    public convertFromChatMessage(
        chatMessage: Session.ChatMessage<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseInput {
        if (chatMessage instanceof RoleMessage.User.Instance)
            return this.convertFromUserMessage(chatMessage);
        else if (chatMessage instanceof RoleMessage.Ai.Instance)
            return this.convertFromAiMessage(chatMessage);
        else throw new Error();
    }
}

export namespace OpenAIResponsesNativeMessageCodec {
    export interface Context<fdm extends Function.Declaration.Map> {
        toolCodec: OpenAIResponsesToolCodec<fdm>;
        compatibleMessageCodec: OpenAIResponsesCompatibleMessageCodec<fdm>;
    }
}
