import { RoleMessage, type Session } from '#@/native-engines.d/openai-responses/session.ts';
import { Function } from '#@/function.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';
import OpenAI from 'openai';
import { MessageCodec as CompatibleMessageCodec } from '#@/compatible.d/openai-responses/message-codec.ts';
import type { ToolCodec } from '#@/api-types/openai-responses/tool-codec.ts';
import type { Verbatim } from '#@/verbatim.ts';
import { ResponseInvalid } from '#@/engine.ts';
import * as VerbatimCodec from '#@/verbatim/codec.ts';



export class MessageCodec<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> {
    public constructor(protected ctx: MessageCodec.Context<fdm, vdm>) {}

    public convertFromFunctionResponse(
        fr: Function.Response.From<fdm>,
    ): OpenAI.Responses.ResponseInputItem.FunctionCallOutput {
        return this.ctx.toolCodec.convertFromFunctionResponse(fr);
    }

    public convertToAiMessage(
        output: OpenAI.Responses.ResponseOutputItem[],
    ): RoleMessage.Ai.From<fdm, vdm> {
        const parts = output.flatMap((item): RoleMessage.Ai.Part.From<fdm, vdm>[] => {
            if (item.type === 'message') {
                if (item.content.every(part => part.type === 'output_text')) {} else
                    throw new ResponseInvalid('Refusal', { cause: output });
                const text = item.content.map(part => part.text).join('');
                const vms = VerbatimCodec.decode(text, this.ctx.vdm);
                return [new RoleMessage.Part.Text(text, vms)];
            } else if (item.type === 'function_call')
                return [this.ctx.toolCodec.convertToFunctionCall(item)];
            else if (item.type === 'reasoning')
                return [];
            else if (item.type === 'apply_patch_call')
                return [new Tool.ApplyPatch.Call(item)];
            else throw new Error();
        });
        return new RoleMessage.Ai(parts, output);
    }

    public convertFromUserMessage(
        userMessage: RoleMessage.User.From<fdm>,
    ): OpenAI.Responses.ResponseInput {
        return userMessage.getParts().map(part => {
            if (part instanceof RoleMessage.Part.Text)
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
        aiMessage: RoleMessage.Ai.From<fdm, vdm>,
    ): OpenAI.Responses.ResponseInput {
        return aiMessage.getRaw();
    }

    public convertFromDeveloperMessage(
        developerMessage: RoleMessage.Developer,
    ): string {
        return this.ctx.compatibleMessageCodec.convertFromDeveloperMessage(developerMessage);
    }

    public convertFromChatMessage(
        chatMessage: Session.ChatMessage.From<fdm, vdm>,
    ): OpenAI.Responses.ResponseInput {
        if (chatMessage instanceof RoleMessage.User)
            return this.convertFromUserMessage(chatMessage);
        else if (chatMessage instanceof RoleMessage.Ai)
            return this.convertFromAiMessage(chatMessage);
        else throw new Error();
    }
}

export namespace MessageCodec {
    export interface Context<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > {
        toolCodec: ToolCodec<fdm>;
        compatibleMessageCodec: CompatibleMessageCodec<fdm, vdm>;
        vdm: vdm;
    }
}
