import { ResponseInvalid } from '../../engine.ts';
import { RoleMessage, type ChatMessage } from '../../session.ts';
import { Function } from '../../function.ts';
import OpenAI from 'openai';
import type { OpenAIResponsesToolCodec } from '../../api-types/openai-responses/tool-codec.ts';


export class OpenAIResponsesCompatibleMessageCodec<in out fdm extends Function.Declaration.Map> {
    public constructor(protected ctx: OpenAIResponsesCompatibleMessageCodec.Context<fdm>) {}

    public convertToAiMessage(
        output: OpenAI.Responses.ResponseOutputItem[],
    ): OpenAIResponsesCompatibleMessageCodec.Message.Ai<Function.Declaration.From<fdm>> {
        const parts = output.flatMap((item): RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] => {
            if (item.type === 'message') {
                if (item.content.every(part => part.type === 'output_text')) {} else throw new Error();
                return [RoleMessage.Part.Text.create(item.content.map(part => part.text).join(''))];
            } else if (item.type === 'function_call')
                return [this.ctx.toolCodec.convertToFunctionCall(item)];
            else if (item.type === 'reasoning')
                return [];
            else throw new Error();
        });
        return OpenAIResponsesCompatibleMessageCodec.Message.Ai.create(parts, output);
    }

    public convertFromFunctionCall(
        fc: Function.Call.Distributive<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseFunctionToolCall {
        if (fc.id) {} else throw new Error();
        return {
            type: 'function_call',
            call_id: fc.id,
            name: fc.name,
            arguments: JSON.stringify(fc.args),
        };
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
                return this.ctx.toolCodec.convertFromFunctionResponse(part);
            else throw new Error();
        });
    }

    public convertFromAiMessage(
        aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseInput {
        if (aiMessage instanceof OpenAIResponsesCompatibleMessageCodec.Message.Ai.Instance)
            return aiMessage.getRaw();
        else {
            return aiMessage.getParts().map(part => {
                if (part instanceof RoleMessage.Part.Text.Instance)
                    return {
                        role: 'assistant',
                        content: part.text,
                    } satisfies OpenAI.Responses.EasyInputMessage;
                else if (part instanceof Function.Call)
                    return this.convertFromFunctionCall(part);
                else throw new Error();
            });
        }
    }

    public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): string {
        return developerMessage.getOnlyText();
    }

    public convertFromChatMessage(
        chatMessage: ChatMessage<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseInput {
        if (chatMessage instanceof RoleMessage.User.Instance)
            return this.convertFromUserMessage(chatMessage);
        else if (chatMessage instanceof RoleMessage.Ai.Instance)
            return this.convertFromAiMessage(chatMessage);
        else throw new Error();
    }
}

export namespace OpenAIResponsesCompatibleMessageCodec {
    export interface Context<in out fdm extends Function.Declaration.Map> {
        toolCodec: OpenAIResponsesToolCodec<fdm>;
    }

    export namespace Message {
        export type Ai<fdu extends Function.Declaration> = Ai.Instance<fdu>;
        export namespace Ai {
            export function create<fdu extends Function.Declaration>(
                parts: RoleMessage.Ai.Part<fdu>[],
                raw: OpenAI.Responses.ResponseOutputItem[],
            ): Ai<fdu> {
                return new Instance(parts, raw);
            }
            export const NOMINAL = Symbol();
            export class Instance<out fdu extends Function.Declaration> extends RoleMessage.Ai.Instance<fdu> {
                public declare readonly [NOMINAL]: void;
                public constructor(
                    parts: RoleMessage.Ai.Part<fdu>[],
                    protected raw: OpenAI.Responses.ResponseOutputItem[],
                ) {
                    super(parts);
                }

                public getRaw(): OpenAI.Responses.ResponseOutputItem[] {
                    return this.raw;
                }
            }
        }
    }
}
