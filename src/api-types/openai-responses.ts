import { EngineBase } from './base.ts';
import { Function } from '../function.ts';
import { RoleMessage, type ChatMessage, type Session } from '../session.ts';
import { type Engine, ResponseInvalid } from '../engine.ts';
import { type InferenceContext } from '../inference-context.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { fetch } from 'undici';
import Ajv from 'ajv';

const ajv = new Ajv();


export namespace OpenAIResponsesEngine {
    export function create<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
        return new Constructor<fdm>(options);
    }

    export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends EngineBase<fdm> {
        protected apiURL: URL;
        protected parallel: boolean;

        public constructor(options: Engine.Options<fdm>) {
            super(options);
            this.apiURL = new URL(`${this.baseUrl}/responses`);
            this.parallel = options.parallelFunctionCall ?? false;
        }

        protected convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseFunctionToolCall {
            assert(fc.id);
            return {
                type: 'function_call',
                call_id: fc.id,
                name: fc.name,
                arguments: JSON.stringify(fc.args),
            };
        }
        protected convertToFunctionCall(apifc: OpenAI.Responses.ResponseFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
            const fditem = this.fdm[apifc.name] as Function.Declaration.Item.From<fdm> | undefined;
            assert(fditem, new ResponseInvalid('Unknown function call', { cause: apifc }));
            const args = (() => {
                try {
                    return JSON.parse(apifc.arguments);
                } catch (e) {
                    return new ResponseInvalid('Invalid JSON of function call', { cause: apifc });
                }
            })();
            assert(
                ajv.validate(fditem.paraschema, args),
                new ResponseInvalid('Function call not conforming to schema', { cause: apifc }),
            );
            return Function.Call.create({
                id: apifc.call_id,
                name: apifc.name,
                args,
            } as Function.Call.create.Options<Function.Declaration.From<fdm>>);
        }

        protected convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInputItem.FunctionCallOutput {
            assert(fr.id);
            return {
                type: 'function_call_output',
                call_id: fr.id,
                output: fr.text,
            };
        }

        protected convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            return userMessage.parts.map(part => {
                if (part instanceof RoleMessage.Part.Text.Constructor)
                    return {
                        type: 'message',
                        role: 'user',
                        content: part.text,
                    } satisfies OpenAI.Responses.EasyInputMessage;
                else if (part instanceof Function.Response)
                    return this.convertFromFunctionResponse(part);
                else throw new Error();
            });
        }

        protected convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            if (aiMessage instanceof OpenAIResponsesAiMessage.Constructor)
                return aiMessage.raw;
            else {
                return aiMessage.parts.map(part => {
                    if (part instanceof RoleMessage.Part.Text.Constructor)
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

        protected convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            if (chatMessage instanceof RoleMessage.User.Constructor)
                return this.convertFromUserMessage(chatMessage);
            else if (chatMessage instanceof RoleMessage.Ai.Constructor)
                return this.convertFromAiMessage(chatMessage);
            else throw new Error();
        }

        protected convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.Responses.FunctionTool {
            return {
                name: fdentry[0],
                description: fdentry[1].description,
                parameters: fdentry[1].paraschema,
                strict: true,
                type: 'function',
            };
        }

        protected convertFromToolChoice(mode: Function.ToolChoice<fdm>): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
            if (mode === Function.ToolChoice.NONE) return 'none';
            else if (mode === Function.ToolChoice.REQUIRED) return 'required';
            else if (mode === Function.ToolChoice.AUTO) return 'auto';
            else {
                return {
                    type: 'allowed_tools',
                    mode: 'required',
                    tools: mode.map(name => ({ type: 'function', name })),
                };
            }
        }

        protected makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseCreateParamsNonStreaming {
            const fdentries = Object.entries(this.fdm);
            const tools = fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry as Function.Declaration.Entry.From<fdm>));
            return {
                model: this.model,
                include: ['reasoning.encrypted_content'],
                store: false,
                input: session.chatMessages.flatMap(chatMessage => this.convertFromChatMessage(chatMessage)),
                instructions: session.developerMessage?.getOnlyText(),
                tools: tools.length ? tools : undefined,
                tool_choice: fdentries.length ? this.convertFromToolChoice(this.toolChoice) : undefined,
                parallel_tool_calls: fdentries.length ? this.parallel : undefined,
                max_output_tokens: this.maxTokens,
                ...this.additionalOptions,
            };
        }


        protected logApiAiMessage(ctx: InferenceContext, output: OpenAI.Responses.ResponseOutputItem[]): void {
            for (const item of output)
                if (item.type === 'message') {
                    assert(item.content.every(part => part.type === 'output_text'));
                    ctx.logger.inference?.debug(item.content.map(part => part.text).join('')+'\n');
                } else if (item.type === 'function_call')
                    ctx.logger.message?.debug(item);
        }

        protected convertToAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): OpenAIResponsesAiMessage<Function.Declaration.From<fdm>> {
            const parts = output.flatMap((item): RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] => {
                if (item.type === 'message') {
                    assert(item.content.every(part => part.type === 'output_text'));
                    return [RoleMessage.Part.Text.create(item.content.map(part => part.text).join(''))];
                } else if (item.type === 'function_call')
                    return [this.convertToFunctionCall(item)];
                else if (item.type === 'reasoning')
                    return [];
                else throw new Error();
            });
            return OpenAIResponsesAiMessage.create(parts, output);
        }

        protected calcCost(usage: OpenAI.Responses.ResponseUsage): number {
            const cacheHitTokenCount = usage.input_tokens_details.cached_tokens;
            const cacheMissTokenCount = usage.input_tokens - cacheHitTokenCount;
            return	this.inputPrice * cacheMissTokenCount / 1e6 +
                    this.cachedPrice * cacheHitTokenCount / 1e6 +
                    this.outputPrice * usage.output_tokens / 1e6;
        }

        protected async fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
            return await this.fetchRaw(ctx, session, signal).catch(e => Promise.reject(e instanceof OpenAI.APIError ? new ResponseInvalid(undefined, { cause: e }) : e));
        }

        protected async fetchRaw(
            ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal,
        ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
            const params = this.makeMonolithParams(session);
            ctx.logger.message?.trace(params);

            await this.throttle.requests(ctx);
            const res = await fetch(this.apiURL, {
                method: 'POST',
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                }),
                body: JSON.stringify(params),
                dispatcher: this.proxyAgent,
                signal,
            });
            assert(res.ok, new Error(undefined, { cause: res }));
            const response = await res.json() as OpenAI.Responses.Response;
            ctx.logger.message?.trace(response);
            if (response.status === 'incomplete' && response.incomplete_details?.reason === 'max_output_tokens')
                throw new ResponseInvalid('Token limit exceeded.', { cause: response });
            assert(
                response.status === 'completed',
                new ResponseInvalid('Abnormal response status', { cause: response }),
            );

            this.logApiAiMessage(ctx, response.output);

            assert(response.usage);
            const cost = this.calcCost(response.usage);
            ctx.logger.cost?.(cost);
            ctx.logger.message?.debug(response.usage);

            const aiMessage = this.convertToAiMessage(response.output);
            this.validateFunctionCallByToolChoice(aiMessage.getFunctionCalls());

            return aiMessage;
        }
    }
}


export type OpenAIResponsesAiMessage<fdu extends Function.Declaration> = OpenAIResponsesAiMessage.Constructor<fdu>;
export namespace OpenAIResponsesAiMessage {
    export function create<fdu extends Function.Declaration>(parts: RoleMessage.Ai.Part<fdu>[], raw: OpenAI.Responses.ResponseOutputItem[]): OpenAIResponsesAiMessage<fdu> {
        return new Constructor(parts, raw);
    }
    export const NOMINAL = Symbol();
    export class Constructor<out fdu extends Function.Declaration> extends RoleMessage.Ai.Constructor<fdu> {
        public declare readonly [NOMINAL]: void;
        public constructor(
            parts: RoleMessage.Ai.Part<fdu>[],
            public raw: OpenAI.Responses.ResponseOutputItem[],
        ) {
            super(parts);
        }
    }
    export interface Snapshot<in out fdu extends Function.Declaration = never> {
        parts: RoleMessage.Ai.Part.Snapshot<fdu>[];
        raw: OpenAI.Responses.ResponseOutputItem[];
    }
    export function restore<fdu extends Function.Declaration>(snapshot: Snapshot<fdu>): OpenAIResponsesAiMessage<fdu> {
        return new Constructor(RoleMessage.Ai.restore<fdu>(snapshot.parts).parts, snapshot.raw);
    }
    export function capture<fdu extends Function.Declaration>(message: OpenAIResponsesAiMessage<fdu>): Snapshot<fdu> {
        return {
            parts: RoleMessage.Ai.capture(message),
            raw: message.raw,
        };
    }
}
