import { ResponseInvalid } from '../../engine.ts';
import { RoleMessage, type ChatMessage } from '../../session.ts';
import { Function } from '../../function.ts';
import * as Google from '@google/genai';
import assert from 'node:assert';
import { CompatibleEngine } from '../../compatible-engine.ts';
import { GoogleEngine } from '../../api-types/google.ts';



export namespace GoogleCompatibleEngine {
    export interface Base<in out fdm extends Function.Declaration.Map> {
        convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Google.Content;
        convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Google.Content;
        convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content;
        convertFromChatMessages(chatMessages: ChatMessage<Function.Declaration.From<fdm>>[]): Google.Content[];
        convertToAiMessage(content: Google.Content): GoogleCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>;
        convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): Google.FunctionCallingConfig;
    }

    export interface Instance<in out fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Instance<fdm>,
        GoogleEngine.Base<fdm>,
        GoogleCompatibleEngine.Base<fdm>
    {}

    export namespace Base {

        export class Constructor<in out fdm extends Function.Declaration.Map> implements GoogleCompatibleEngine.Base<fdm> {
            public constructor(protected instance: GoogleCompatibleEngine.Instance<fdm>) {}


            public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Google.Content {
                const parts = userMessage.getParts().map(part => {
                    if (part instanceof RoleMessage.Part.Text.Constructor)
                        return Google.createPartFromText(part.text);
                    else if (part instanceof Function.Response)
                        return {
                            functionResponse: { id: part.id, name: part.name, response: { returnValue: part.text } },
                        };
                    else throw new Error();
                });
                return Google.createUserContent(parts);
            }

            public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Google.Content {
                if (aiMessage instanceof GoogleCompatibleEngine.Message.Ai.Constructor)
                    return aiMessage.raw;
                else {
                    const parts = aiMessage.getParts().map(part => {
                        if (part instanceof RoleMessage.Part.Text.Constructor)
                            return Google.createPartFromText(part.text);
                        else if (part instanceof Function.Call) {
                            assert(part.args instanceof Object);
                            return Google.createPartFromFunctionCall(part.name, part.args as Record<string, unknown>);
                        } else throw new Error();
                    });
                    return Google.createModelContent(parts);
                }
            }

            public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content {
                const parts = developerMessage.getParts().map(part => Google.createPartFromText(part.text));
                return { parts };
            }

            public convertFromChatMessages(chatMessages: ChatMessage<Function.Declaration.From<fdm>>[]): Google.Content[] {
                return chatMessages.map(chatMessage => {
                    if (chatMessage instanceof RoleMessage.User.Constructor) return this.convertFromUserMessage(chatMessage);
                    else if (chatMessage instanceof RoleMessage.Ai.Constructor) return this.convertFromAiMessage(chatMessage);
                    else throw new Error();
                });
            }

            public convertToAiMessage(content: Google.Content): GoogleCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
                return GoogleCompatibleEngine.convertToAiMessage<fdm>(content, this.instance.fdm);
            }

            public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Google.FunctionDeclaration {
                const json = JSON.stringify(fdentry[1].paraschema);
                const parsed = JSON.parse(json, (key, value) => {
                    if (key === 'type' && typeof value === 'string') {
                        if (value === 'string') return Google.Type.STRING;
                        else if (value === 'number') return Google.Type.NUMBER;
                        else if (value === 'boolean') return Google.Type.BOOLEAN;
                        else if (value === 'object') return Google.Type.OBJECT;
                        else if (value === 'array') return Google.Type.ARRAY;
                        else throw new Error();
                    } else if (key === 'additionalProperties' && typeof value === 'boolean')
                        return;
                    else return value;
                }) as Google.Schema;
                return {
                    name: fdentry[0],
                    description: fdentry[1].description,
                    parameters: parsed,
                };
            }

            public convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): Google.FunctionCallingConfig {
                if (toolChoice === Function.ToolChoice.NONE) return { mode: Google.FunctionCallingConfigMode.NONE };
                else if (toolChoice === Function.ToolChoice.REQUIRED) return { mode: Google.FunctionCallingConfigMode.ANY };
                else if (toolChoice === Function.ToolChoice.AUTO) return { mode: Google.FunctionCallingConfigMode.AUTO };
                else return { mode: Google.FunctionCallingConfigMode.ANY, allowedFunctionNames: [...toolChoice] };
            }
        }
    }


    export function convertToAiMessage<fdm extends Function.Declaration.Map>(
        content: Google.Content,
        fdm: fdm,
    ): GoogleCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
        assert(content.parts);
        return GoogleCompatibleEngine.Message.Ai.create(content.parts.flatMap(part => {
            const parts: RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] = [];
            assert(part.functionCall || part.text, new ResponseInvalid('Unknown content part', { cause: content }));
            if (part.text) parts.push(RoleMessage.Part.Text.create(part.text));
            if (part.functionCall) parts.push(GoogleEngine.convertToFunctionCall(part.functionCall, fdm));
            return parts;
        }), content);
    }

    export namespace Message {
        export type Ai<fdu extends Function.Declaration> = Ai.Constructor<fdu>;
        export namespace Ai {
            export function create<fdu extends Function.Declaration>(parts: RoleMessage.Ai.Part<fdu>[], raw: Google.Content): Ai<fdu> {
                return new Constructor(parts, raw);
            }
            export const NOMINAL = Symbol();
            export class Constructor<out fdu extends Function.Declaration> extends RoleMessage.Ai.Constructor<fdu> {
                public declare readonly [NOMINAL]: void;
                public constructor(parts: RoleMessage.Ai.Part<fdu>[], public raw: Google.Content) {
                    super(parts);
                }
            }
        }
    }
}
