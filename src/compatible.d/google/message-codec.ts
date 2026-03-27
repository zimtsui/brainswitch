import { ResponseInvalid } from '#@/engine.ts';
import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import * as Google from '@google/genai';
import { type ToolCodec } from '#@/api-types/google/tool-codec.ts';
import type { Verbatim } from '#@/verbatim.ts';
import * as VerbatimCodec from '#@/verbatim/codec.ts';

const NOMINAL = Symbol();

export class MessageCodec<
    fdm extends Function.Decl.Map.Proto,
    vdm extends Verbatim.Decl.Map.Proto,
> {
    public constructor(protected ctx: MessageCodec.Context<fdm, vdm>) {}

    public encodeAiMessage(
        aiMessage: RoleMessage.Ai.From<fdm, vdm>,
    ): Google.Content {
        if (aiMessage instanceof MessageCodec.Message.Ai)
            return aiMessage.getRaw();
        else {
            const parts = aiMessage.getParts().map(part => {
                if (part instanceof RoleMessage.Part.Text)
                    return Google.createPartFromText(part.text);
                else if (part instanceof Function.Call) {
                    if (part.args instanceof Object) {} else throw new Error();
                    return Google.createPartFromFunctionCall(part.name, part.args as Record<string, unknown>);
                } else throw new Error();
            });
            return Google.createModelContent(parts);
        }
    }

    public encodeChatMessages(
        chatMessages: Session.ChatMessage.From<fdm, vdm>[],
    ): Google.Content[] {
        return chatMessages.map(chatMessage => {
            if (chatMessage instanceof RoleMessage.User) return this.encodeUserMessage(chatMessage);
            else if (chatMessage instanceof RoleMessage.Ai) return this.encodeAiMessage(chatMessage);
            else throw new Error();
        });
    }

    public encodeUserMessage(
        userMessage: RoleMessage.User.From<fdm>,
    ): Google.Content {
        const parts = userMessage.getParts().map(part => {
            if (part instanceof RoleMessage.Part.Text)
                return Google.createPartFromText(part.text);
            else if (part instanceof Function.Response)
                return {
                    functionResponse: { id: part.id, name: part.name, response: { returnValue: part.text } },
                };
            else throw new Error();
        });
        return Google.createUserContent(parts);
    }

    public encodeDeveloperMessage(
        developerMessage: RoleMessage.Developer,
    ): Google.Content {
        const parts = developerMessage.getParts().map(part => Google.createPartFromText(part.text));
        return { parts };
    }

    /**
     * @throws {@link VerbatimCodec.Request.Invalid}
     */
    public decodeAiMessage(
        content: Google.Content,
    ): MessageCodec.Message.Ai.From<fdm, vdm> {
        if (content.parts) {} else throw new Error();
        return new MessageCodec.Message.Ai(content.parts.flatMap(part => {
            const parts: RoleMessage.Ai.Part.From<fdm, vdm>[] = [];
            if (part.functionCall || part.text) {} else throw new ResponseInvalid('Unknown content part', { cause: content });
            if (part.text) {
                const vrs = VerbatimCodec.Request.decode(part.text, this.ctx.vdm);
                parts.push(new RoleMessage.Part.Text(part.text, vrs));
            }
            if (part.functionCall) parts.push(this.ctx.toolCodec.convertToFunctionCall(part.functionCall));
            return parts;
        }), content);
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
            protected declare [NOMINAL]: never;
            public constructor(parts: RoleMessage.Ai.Part<fdu, vdu>[], protected raw: Google.Content) {
                super(parts);
            }
            public getRaw(): Google.Content {
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
