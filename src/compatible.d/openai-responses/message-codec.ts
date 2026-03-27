import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import OpenAI from 'openai';
import type { ToolCodec } from '#@/api-types/openai-responses/tool-codec.ts';
import type { Verbatim } from '#@/verbatim.ts';
import * as VerbatimCodec from '#@/verbatim/codec.ts';

const NOMINAL = Symbol();


export class MessageCodec<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> {
    public constructor(protected ctx: MessageCodec.Context<fdm, vdm>) {}

    /**
     * @throws {@link VerbatimCodec.Request.Invalid}
     */
    public decodeAiMessage(
        output: OpenAI.Responses.ResponseOutputItem[],
    ): MessageCodec.Message.Ai.From<fdm, vdm> {
        const parts = output.flatMap(
            (item): RoleMessage.Ai.Part.From<fdm, vdm>[] => {
                if (item.type === 'message') {
                    if (item.content.every(part => part.type === 'output_text')) {} else throw new Error();
                    const text = item.content.map(part => part.text).join('');
                    const vrs = VerbatimCodec.Request.decode(text, this.ctx.vdm);
                    return [new RoleMessage.Part.Text(text, vrs)];
                } else if (item.type === 'function_call')
                    return [this.ctx.toolCodec.decodeFunctionCall(item)];
                else if (item.type === 'reasoning')
                    return [];
                else throw new Error();
            },
        );
        return new MessageCodec.Message.Ai(parts, output);
    }

    public encodeUserMessage(
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
                return this.ctx.toolCodec.encodeFunctionResponse(part);
            else throw new Error();
        });
    }

    public encodeAiMessage(
        aiMessage: RoleMessage.Ai.From<fdm, vdm>,
    ): OpenAI.Responses.ResponseInput {
        if (aiMessage instanceof MessageCodec.Message.Ai)
            return aiMessage.getRaw();
        else {
            return aiMessage.getParts().map(part => {
                if (part instanceof RoleMessage.Part.Text)
                    return {
                        role: 'assistant',
                        content: part.text,
                    } satisfies OpenAI.Responses.EasyInputMessage;
                else if (part instanceof Function.Call)
                    return this.ctx.toolCodec.encodeFunctionCall(part);
                else throw new Error();
            });
        }
    }

    public encodeDeveloperMessage(developerMessage: RoleMessage.Developer): string {
        return developerMessage.getText();
    }

    public encodeChatMessage(
        chatMessage: Session.ChatMessage.From<fdm, vdm>,
    ): OpenAI.Responses.ResponseInput {
        if (chatMessage instanceof RoleMessage.User)
            return this.encodeUserMessage(chatMessage);
        else if (chatMessage instanceof RoleMessage.Ai)
            return this.encodeAiMessage(chatMessage);
        else throw new Error();
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
            out fdu extends Function.Decl.Proto,
            out vdu extends Verbatim.Decl.Proto,
        > extends RoleMessage.Ai<fdu, vdu> {
            public declare [NOMINAL]: void;
            public constructor(
                parts: RoleMessage.Ai.Part<fdu, vdu>[],
                protected raw: OpenAI.Responses.ResponseOutputItem[],
            ) {
                super(parts);
            }

            public getRaw(): OpenAI.Responses.ResponseOutputItem[] {
                return this.raw;
            }
        }
        export namespace Ai {
            export type From<
                fdm extends Function.Decl.Map.Proto,
                vdm extends Verbatim.Decl.Map.Proto,
            > = Ai<
                Function.Decl.From<fdm>,
                Verbatim.Decl.From<vdm>
            >;
        }
    }
}
