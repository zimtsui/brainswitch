import { type CompatibleEngine } from '../compatible-engine.ts';
import { ResponseInvalid } from '../engine.ts';
import { RoleMessage, type ChatMessage } from '../session.ts';
import { Function } from '../function.ts';
import * as Google from '@google/genai';
import assert from 'node:assert';
import { CompatibleEngineBase } from './compatible-base.ts';
import Ajv from 'ajv';

const ajv = new Ajv();

export abstract class GoogleEngineBase<in out fdm extends Function.Declaration.Map = {}> extends CompatibleEngineBase<fdm> {
    protected parallel: boolean;

    protected constructor(options: CompatibleEngine.Options<fdm>) {
        super(options);
        this.parallel = options.parallelToolCall ?? true;
        assert(this.parallel, new Error('Google API requires parallel tool calls.'));
    }

    protected convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Google.FunctionCall {
        return {
            id: fc.id,
            name: fc.name,
            args: fc.args as Record<string, unknown>,
        };
    }

    protected convertToFunctionCall(googlefc: Google.FunctionCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
        return GoogleEngineBase.convertToFunctionCall<fdm>(googlefc, this.fdm);
    }
    protected static convertToFunctionCall<fdm extends Function.Declaration.Map = {}>(
        googlefc: Google.FunctionCall,
        fdm?: fdm,
    ): Function.Call.Distributive<Function.Declaration.From<fdm>> {
        if (fdm) {
            assert(googlefc.name);
            const fditem = fdm[googlefc.name] as Function.Declaration.Item.From<fdm> | undefined;
            assert(fditem, new ResponseInvalid('Unknown function call', { cause: googlefc }));
            assert(
                ajv.validate(fditem.paraschema, googlefc.args),
                new ResponseInvalid('Function call not conforming to schema', { cause: googlefc }),
            );
            return Function.Call.create({
                id: googlefc.id,
                name: googlefc.name,
                args: googlefc.args,
            } as Function.Call.create.Options<Function.Declaration.From<fdm>>);
        } else {
            assert(googlefc.name);
            return Function.Call.create({
                id: googlefc.id,
                name: googlefc.name,
                args: googlefc.args,
            } as Function.Call.create.Options<Function.Declaration.From<fdm>>);
        }
    }

    protected convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Google.Content {
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
    protected convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Google.Content {
        if (aiMessage instanceof GoogleMessage.Ai.Constructor)
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
    protected convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content {
        const parts = developerMessage.getParts().map(part => Google.createPartFromText(part.text));
        return { parts };
    }
    protected convertFromChatMessages(chatMessages: ChatMessage<Function.Declaration.From<fdm>>[]): Google.Content[] {
        return chatMessages.map(chatMessage => {
            if (chatMessage instanceof RoleMessage.User.Constructor) return this.convertFromUserMessage(chatMessage);
            else if (chatMessage instanceof RoleMessage.Ai.Constructor) return this.convertFromAiMessage(chatMessage);
            else throw new Error();
        });
    }

    public convertToAiMessage(content: Google.Content): GoogleMessage.Ai<Function.Declaration.From<fdm>> {
        return GoogleEngineBase.convertToAiMessage<fdm>(content);
    }
    public static convertToAiMessage<fdm extends Function.Declaration.Map = {}>(
        content: Google.Content,
        fdm?: fdm,
    ): GoogleMessage.Ai<Function.Declaration.From<fdm>> {
        assert(content.parts);
        return GoogleMessage.Ai.create(content.parts.flatMap(part => {
            const parts: RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] = [];
            assert(part.functionCall || part.text, new ResponseInvalid('Unknown content part', { cause: content }));
            if (part.text) parts.push(RoleMessage.Part.Text.create(part.text));
            if (part.functionCall) parts.push(GoogleEngineBase.convertToFunctionCall(part.functionCall, fdm));
            return parts;
        }), content);
    }

    protected convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Google.FunctionDeclaration {
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

    protected convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): Google.FunctionCallingConfig {
        if (toolChoice === Function.ToolChoice.NONE) return { mode: Google.FunctionCallingConfigMode.NONE };
        else if (toolChoice === Function.ToolChoice.REQUIRED) return { mode: Google.FunctionCallingConfigMode.ANY };
        else if (toolChoice === Function.ToolChoice.AUTO) return { mode: Google.FunctionCallingConfigMode.AUTO };
        else return { mode: Google.FunctionCallingConfigMode.ANY, allowedFunctionNames: [...toolChoice] };
    }
}


export namespace GoogleMessage {
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
