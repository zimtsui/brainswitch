import { ResponseInvalid } from '#@/engine.ts';
import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import * as Google from '@google/genai';
import { type GoogleToolCodec } from '#@/api-types/google/tool-codec.ts';
import type { Verbatim } from '#@/verbatim.ts';

const NOMINAL = Symbol();

export class GoogleCompatibleMessageCodec<
    fdm extends Function.Declaration.Map.Prototype,
    vdm extends Verbatim.Declaration.Map.Prototype,
> {
    public constructor(protected ctx: GoogleCompatibleMessageCodec.Context<fdm>) {}

    public convertFromAiMessage(
        aiMessage: RoleMessage.Ai.From<fdm, vdm>,
    ): Google.Content {
        if (aiMessage instanceof GoogleCompatibleMessageCodec.Message.Ai)
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

    public convertFromChatMessages(
        chatMessages: Session.ChatMessage.From<fdm, vdm>[],
    ): Google.Content[] {
        return chatMessages.map(chatMessage => {
            if (chatMessage instanceof RoleMessage.User) return this.convertFromUserMessage(chatMessage);
            else if (chatMessage instanceof RoleMessage.Ai) return this.convertFromAiMessage(chatMessage);
            else throw new Error();
        });
    }

    public convertFromUserMessage(
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

    public convertFromDeveloperMessage(
        developerMessage: RoleMessage.Developer,
    ): Google.Content {
        const parts = developerMessage.getParts().map(part => Google.createPartFromText(part.text));
        return { parts };
    }

    public convertToAiMessage(
        content: Google.Content,
    ): GoogleCompatibleMessageCodec.Message.Ai.From<fdm, vdm> {
        if (content.parts) {} else throw new Error();
        return new GoogleCompatibleMessageCodec.Message.Ai(content.parts.flatMap(part => {
            const parts: RoleMessage.Ai.Part.From<fdm, vdm>[] = [];
            if (part.functionCall || part.text) {} else throw new ResponseInvalid('Unknown content part', { cause: content });
            if (part.text) parts.push(new RoleMessage.Part.Text(part.text));
            if (part.functionCall) parts.push(this.ctx.toolCodec.convertToFunctionCall(part.functionCall));
            return parts;
        }), content);
    }
}


export namespace GoogleCompatibleMessageCodec {
    export interface Context<in out fdm extends Function.Declaration.Map.Prototype> {
        toolCodec: GoogleToolCodec<fdm>;
    }

    export namespace Message {
        export class Ai<
            out fdu extends Function.Declaration.Prototype,
            out vdu extends Verbatim.Declaration.Prototype,
        > extends RoleMessage.Ai<fdu, vdu> {
            protected declare [NOMINAL]: void;
            public constructor(parts: RoleMessage.Ai.Part<fdu, vdu>[], protected raw: Google.Content) {
                super(parts);
            }
            public getRaw(): Google.Content {
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
