import { ResponseInvalid } from '../../engine.ts';
import { RoleMessage, type ChatMessage } from '../../session.ts';
import { Function } from '../../function.ts';
import * as Google from '@google/genai';
import { type GoogleToolCodec } from '../../api-types/google/tool-codec.ts';



export class GoogleCompatibleMessageCodec<fdm extends Function.Declaration.Map> {
    public constructor(protected ctx: GoogleCompatibleMessageCodec.Context<fdm>) {}


    public convertFromAiMessage(
        aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>,
    ): Google.Content {
        if (aiMessage instanceof GoogleCompatibleMessageCodec.Message.Ai.Instance)
            return aiMessage.getRaw();
        else {
            const parts = aiMessage.getParts().map(part => {
                if (part instanceof RoleMessage.Part.Text.Instance)
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
        chatMessages: ChatMessage<Function.Declaration.From<fdm>>[],
    ): Google.Content[] {
        return chatMessages.map(chatMessage => {
            if (chatMessage instanceof RoleMessage.User.Instance) return this.convertFromUserMessage(chatMessage);
            else if (chatMessage instanceof RoleMessage.Ai.Instance) return this.convertFromAiMessage(chatMessage);
            else throw new Error();
        });
    }

    public convertFromUserMessage(
        userMessage: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): Google.Content {
        const parts = userMessage.getParts().map(part => {
            if (part instanceof RoleMessage.Part.Text.Instance)
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
    ): GoogleCompatibleMessageCodec.Message.Ai<Function.Declaration.From<fdm>> {
        if (content.parts) {} else throw new Error();
        return GoogleCompatibleMessageCodec.Message.Ai.create(content.parts.flatMap(part => {
            const parts: RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] = [];
            if (part.functionCall || part.text) {} else throw new ResponseInvalid('Unknown content part', { cause: content });
            if (part.text) parts.push(RoleMessage.Part.Text.create(part.text));
            if (part.functionCall) parts.push(this.ctx.toolCodec.convertToFunctionCall(part.functionCall));
            return parts;
        }), content);
    }
}


export namespace GoogleCompatibleMessageCodec {
    export interface Context<fdm extends Function.Declaration.Map> {
        toolCodec: GoogleToolCodec<fdm>;
    }

    export namespace Message {
        export type Ai<fdu extends Function.Declaration> = Ai.Instance<fdu>;
        export namespace Ai {
            export function create<fdu extends Function.Declaration>(parts: RoleMessage.Ai.Part<fdu>[], raw: Google.Content): Ai<fdu> {
                return new Instance(parts, raw);
            }
            export const NOMINAL = Symbol();
            export class Instance<out fdu extends Function.Declaration> extends RoleMessage.Ai.Instance<fdu> {
                public declare readonly [NOMINAL]: void;
                public constructor(parts: RoleMessage.Ai.Part<fdu>[], protected raw: Google.Content) {
                    super(parts);
                }
                public getRaw(): Google.Content {
                    return this.raw;
                }
            }
        }
    }

}
