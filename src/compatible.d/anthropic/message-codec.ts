import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import Anthropic from '@anthropic-ai/sdk';
import type { ToolCodec } from '#@/api-types/anthropic/tool-codec.ts';
import type { Verbatim } from '#@/verbatim.ts';
import * as VerbatimCodec from '#@/verbatim/codec.ts';

const NOMINAL = Symbol();


export class MessageCodec<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> {
    public constructor(protected ctx: MessageCodec.Context<fdm, vdm>) {}

    public convertFromUserMessage(
        userMessage: RoleMessage.User.From<fdm>,
    ): Anthropic.ContentBlockParam[] {
        return userMessage.getParts().map(part => {
            if (part instanceof RoleMessage.Part.Text)
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
        aiMessage: RoleMessage.Ai.From<fdm, vdm>,
    ): Anthropic.ContentBlockParam[] {
        if (aiMessage instanceof MessageCodec.Message.Ai)
            return aiMessage.getRaw();
        else {
            return aiMessage.getParts().map(part => {
                if (part instanceof RoleMessage.Part.Text)
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
        chatMessage: Session.ChatMessage.From<fdm, vdm>,
    ): Anthropic.MessageParam {
        if (chatMessage instanceof RoleMessage.User)
            return { role: 'user', content: this.convertFromUserMessage(chatMessage) };
        else if (chatMessage instanceof RoleMessage.Ai)
            return { role: 'assistant', content: this.convertFromAiMessage(chatMessage) };
        else throw new Error();
    }

    /**
     * @throws {@link VerbatimCodec.Request.Invalid}
     */
    public convertToAiMessage(
        raw: Anthropic.ContentBlock[],
    ): MessageCodec.Message.Ai.From<fdm, vdm> {
        const parts = raw.flatMap((item): RoleMessage.Ai.Part.From<fdm, vdm>[] => {
            if (item.type === 'text') {
                const vrs = VerbatimCodec.Request.decode(item.text, this.ctx.vdm);
                return [new RoleMessage.Part.Text(item.text, vrs)];
            } else if (item.type === 'tool_use') return [this.ctx.toolCodec.convertToFunctionCall(item)];
            else if (item.type === 'thinking') return [];
            else throw new Error();
        });
        return new MessageCodec.Message.Ai(parts, raw);
    }
}

export namespace MessageCodec {
    export interface Context<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > {
        toolCodec: ToolCodec<fdm>;
        vdm: vdm;
    }

    export namespace Message {
        export class Ai<
            in out fdu extends Function.Decl.Proto,
            in out vdu extends Verbatim.Decl.Proto,
        > extends RoleMessage.Ai<fdu, vdu> {
            protected declare [NOMINAL]: never;

            public constructor(
                parts: RoleMessage.Ai.Part<fdu, vdu>[],
                protected raw: Anthropic.ContentBlock[],
            ) {
                super(parts);
            }

            public getRaw(): Anthropic.ContentBlock[] {
                return this.raw;
            }
        }
        export namespace Ai {
            export type From<
                fdm extends Function.Decl.Map.Proto,
                vdm extends Verbatim.Decl.Map.Proto,
            > = Ai<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>;
        }
    }
}
