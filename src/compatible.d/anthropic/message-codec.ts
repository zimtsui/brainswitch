import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import Anthropic from '@anthropic-ai/sdk';
import type { AnthropicToolCodec } from '#@/api-types/anthropic/tool-codec.ts';


export class AnthropicCompatibleMessageCodec<in out fdm extends Function.Declaration.Map> {
    public constructor(protected ctx: AnthropicCompatibleMessageCodec.Context<fdm>) {}

    public convertFromUserMessage(
        userMessage: RoleMessage.User<fdm>,
    ): Anthropic.ContentBlockParam[] {
        return userMessage.getParts().map(part => {
            if (part instanceof RoleMessage.Part.Text.Instance)
                return {
                    type: 'text',
                    text: part.text,
                } satisfies Anthropic.TextBlockParam;
            else if (part instanceof Function.Response)
                return this.ctx.toolCodec.convertFromFunctionResponse(part);
            else throw new Error();
        });
    }

    public convertFromAiMessage(
        aiMessage: RoleMessage.Ai<fdm>,
    ): Anthropic.ContentBlockParam[] {
        if (aiMessage instanceof AnthropicCompatibleMessageCodec.Message.Ai.Instance)
            return aiMessage.getRaw();
        else {
            return aiMessage.getParts().map(part => {
                if (part instanceof RoleMessage.Part.Text.Instance)
                    return {
                        type: 'text',
                        text: part.text,
                    } satisfies Anthropic.TextBlockParam;
                else if (part instanceof Function.Call)
                    return this.ctx.toolCodec.convertFromFunctionCall(part);
                else throw new Error();
            });
        }
    }

    public convertFromDeveloperMessage(
        developerMessage: RoleMessage.Developer,
    ): Anthropic.TextBlockParam[] {
        return developerMessage.getParts().map(part => ({ type: 'text', text: part.text }));
    }

    public convertFromChatMessage(
        chatMessage: Session.ChatMessage<fdm>,
    ): Anthropic.MessageParam {
        if (chatMessage instanceof RoleMessage.User.Instance)
            return { role: 'user', content: this.convertFromUserMessage(chatMessage) };
        else if (chatMessage instanceof RoleMessage.Ai.Instance)
            return { role: 'assistant', content: this.convertFromAiMessage(chatMessage) };
        else throw new Error();
    }

    public convertToAiMessage(
        raw: Anthropic.ContentBlock[],
    ): AnthropicCompatibleMessageCodec.Message.Ai<fdm> {
        const parts = raw.flatMap((item): RoleMessage.Ai.Part<fdm>[] => {
            if (item.type === 'text') return [RoleMessage.Part.Text.create(item.text)];
            else if (item.type === 'tool_use') return [this.ctx.toolCodec.convertToFunctionCall(item)];
            else if (item.type === 'thinking') return [];
            else throw new Error();
        });
        return AnthropicCompatibleMessageCodec.Message.Ai.create(parts, raw);
    }
}

export namespace AnthropicCompatibleMessageCodec {
    export interface Context<in out fdm extends Function.Declaration.Map> {
        toolCodec: AnthropicToolCodec<fdm>;
    }

    export namespace Message {
        export type Ai<fdm extends Function.Declaration.Map> = Ai.Instance<fdm>;
        export namespace Ai {
            export function create<fdm extends Function.Declaration.Map>(
                parts: RoleMessage.Ai.Part<fdm>[],
                raw: Anthropic.ContentBlock[],
            ): Ai<fdm> {
                return new Instance(parts, raw);
            }
            export const NOMINAL = Symbol();
            export class Instance<in out fdm extends Function.Declaration.Map> extends RoleMessage.Ai.Instance<fdm> {
                public declare readonly [NOMINAL]: void;

                public constructor(
                    parts: RoleMessage.Ai.Part<fdm>[],
                    protected raw: Anthropic.ContentBlock[],
                ) {
                    super(parts);
                }

                public getRaw(): Anthropic.ContentBlock[] {
                    return this.raw;
                }
            }
        }
    }
}
