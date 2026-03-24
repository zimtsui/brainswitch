import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import OpenAI from 'openai';
import type { OpenAIResponsesToolCodec } from '#@/api-types/openai-responses/tool-codec.ts';
import type { Verbatim } from '#@/verbatim.ts';
import * as VerbatimCodec from '#@/verbatim/codec.ts';

const NOMINAL = Symbol();


export class OpenAIResponsesCompatibleMessageCodec<
    in out fdm extends Function.Declaration.Map.Prototype,
    in out vdm extends Verbatim.Declaration.Map.Prototype,
> {
    public constructor(protected ctx: OpenAIResponsesCompatibleMessageCodec.Context<fdm, vdm>) {}

    /**
     * @throws {@link VerbatimCodec.ChannelNotFound}
     * @throws {@link VerbatimCodec.InvalidSchema}
     */
    public convertToAiMessage(
        output: OpenAI.Responses.ResponseOutputItem[],
    ): OpenAIResponsesCompatibleMessageCodec.Message.Ai.From<fdm, vdm> {
        const parts = output.flatMap(
            (item): RoleMessage.Ai.Part.From<fdm, vdm>[] => {
                if (item.type === 'message') {
                    if (item.content.every(part => part.type === 'output_text')) {} else throw new Error();
                    const text = item.content.map(part => part.text).join('');
                    const vms = VerbatimCodec.decode(text, this.ctx.vdm);
                    return [new RoleMessage.Part.Text(text, vms)];
                } else if (item.type === 'function_call')
                    return [this.ctx.toolCodec.convertToFunctionCall(item)];
                else if (item.type === 'reasoning')
                    return [];
                else throw new Error();
            },
        );
        return new OpenAIResponsesCompatibleMessageCodec.Message.Ai(parts, output);
    }

    public convertFromFunctionCall(
        fc: Function.Call.From<fdm>,
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
                return this.ctx.toolCodec.convertFromFunctionResponse(part);
            else throw new Error();
        });
    }

    public convertFromAiMessage(
        aiMessage: RoleMessage.Ai.From<fdm, vdm>,
    ): OpenAI.Responses.ResponseInput {
        if (aiMessage instanceof OpenAIResponsesCompatibleMessageCodec.Message.Ai)
            return aiMessage.getRaw();
        else {
            return aiMessage.getParts().map(part => {
                if (part instanceof RoleMessage.Part.Text)
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
        chatMessage: Session.ChatMessage.From<fdm, vdm>,
    ): OpenAI.Responses.ResponseInput {
        if (chatMessage instanceof RoleMessage.User)
            return this.convertFromUserMessage(chatMessage);
        else if (chatMessage instanceof RoleMessage.Ai)
            return this.convertFromAiMessage(chatMessage);
        else throw new Error();
    }
}

export namespace OpenAIResponsesCompatibleMessageCodec {
    export interface Context<
        in out fdm extends Function.Declaration.Map.Prototype,
        in out vdm extends Verbatim.Declaration.Map.Prototype,
    > {
        toolCodec: OpenAIResponsesToolCodec<fdm>;
        vdm: vdm;
    }

    export namespace Message {
        export class Ai<
            out fdu extends Function.Declaration.Prototype,
            out vdu extends Verbatim.Declaration.Prototype,
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
                fdm extends Function.Declaration.Map.Prototype,
                vdm extends Verbatim.Declaration.Map.Prototype,
            > = Ai<
                Function.Declaration.From<fdm>,
                Verbatim.Declaration.From<vdm>
            >;
        }
    }
}
