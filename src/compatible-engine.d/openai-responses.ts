import { CompatibleEngineBase } from './compatible-base.ts';
import { Function } from '../function.ts';
import { RoleMessage, type ChatMessage, type Session } from '../session.ts';
import { type CompatibleEngine } from '../compatible-engine.ts';
import { ResponseInvalid } from '../engine.ts';
import { type InferenceContext } from '../inference-context.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { fetch } from 'undici';
import { OpenAIResponsesUtilities } from '../api-types/openai-responses.ts';


export namespace OpenAIResponsesEngine {
    export interface Options<fdm extends Function.Declaration.Map = {}> extends CompatibleEngine.Options<fdm> {
        applyPatch?: boolean;
    }

    export function create<fdm extends Function.Declaration.Map = {}>(options: Options<fdm>): CompatibleEngine<Function.Declaration.From<fdm>> {
        return new Constructor<fdm>(options);
    }

    export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends CompatibleEngineBase<fdm> {
        protected apiURL: URL;
        protected parallel: boolean;
        protected utilities: OpenAIResponsesUtilities<fdm>;

        public constructor(options: Options<fdm>) {
            super(options);
            this.apiURL = new URL(`${this.baseUrl}/responses`);
            this.parallel = options.parallelToolCall ?? false;
            this.utilities = new OpenAIResponsesUtilities<fdm>(options);
        }

        protected convertToAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): OpenAIResponsesMessage.Ai<Function.Declaration.From<fdm>> {
            const parts = output.flatMap((item): RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] => {
                if (item.type === 'message') {
                    assert(item.content.every(part => part.type === 'output_text'));
                    return [RoleMessage.Part.Text.create(item.content.map(part => part.text).join(''))];
                } else if (item.type === 'function_call')
                    return [this.utilities.convertToFunctionCall(item)];
                else if (item.type === 'reasoning')
                    return [];
                else throw new Error();
            });
            return OpenAIResponsesMessage.Ai.create(parts, output);
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


        protected convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            return userMessage.getParts().map(part => {
                if (part instanceof RoleMessage.Part.Text.Constructor)
                    return {
                        type: 'message',
                        role: 'user',
                        content: part.text,
                    } satisfies OpenAI.Responses.EasyInputMessage;
                else if (part instanceof Function.Response)
                    return this.utilities.convertFromFunctionResponse(part);
                else throw new Error();
            });
        }

        protected convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            if (aiMessage instanceof OpenAIResponsesMessage.Ai.Constructor)
                return aiMessage.getRaw();
            else {
                return aiMessage.getParts().map(part => {
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

        protected convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): string {
            return developerMessage.getOnlyText();
        }

        protected convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            if (chatMessage instanceof RoleMessage.User.Constructor)
                return this.convertFromUserMessage(chatMessage);
            else if (chatMessage instanceof RoleMessage.Ai.Constructor)
                return this.convertFromAiMessage(chatMessage);
            else throw new Error();
        }


        protected convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
            if (toolChoice === Function.ToolChoice.NONE) return 'none';
            else if (toolChoice === Function.ToolChoice.REQUIRED) return 'required';
            else if (toolChoice === Function.ToolChoice.AUTO) return 'auto';
            else {
                return {
                    type: 'allowed_tools',
                    mode: 'required',
                    tools: toolChoice.map(name => ({ type: 'function', name }) satisfies OpenAI.Responses.ToolChoiceFunction),
                };
            }
        }

        protected makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseCreateParamsNonStreaming {
            const fdentries = Object.entries(this.fdm) as Function.Declaration.Entry.From<fdm>[];
            const tools: OpenAI.Responses.Tool[] = fdentries.map(fdentry => this.utilities.convertFromFunctionDeclarationEntry(fdentry));
            return {
                model: this.model,
                include: ['reasoning.encrypted_content'],
                store: false,
                input: session.chatMessages.flatMap(chatMessage => this.convertFromChatMessage(chatMessage)),
                instructions: session.developerMessage && this.convertFromDeveloperMessage(session.developerMessage),
                tools: tools.length ? tools : undefined,
                tool_choice: tools.length ? this.convertFromToolChoice(this.toolChoice) : undefined,
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


        protected async fetch(
            ctx: InferenceContext,
            session: Session<Function.Declaration.From<fdm>>,
            signal?: AbortSignal,
        ): Promise<OpenAIResponsesMessage.Ai<Function.Declaration.From<fdm>>> {
            return await this.fetchRaw(ctx, session, signal).catch(e => Promise.reject(e instanceof OpenAI.APIError ? new ResponseInvalid(undefined, { cause: e }) : e));
        }

        protected async fetchRaw(
            ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal,
        ): Promise<OpenAIResponsesMessage.Ai<Function.Declaration.From<fdm>>> {
            const params = this.makeMonolithParams(session);
            ctx.logger.message?.trace(params);

            await this.throttle.requests(ctx);
            const res = await fetch(
                this.apiURL,
                {
                    method: 'POST',
                    headers: new Headers({
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`,
                    }),
                    body: JSON.stringify(params),
                    dispatcher: this.proxyAgent,
                    signal,
                },
            );
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
            const cost = this.utilities.calcCost(response.usage);
            ctx.logger.cost?.(cost);
            ctx.logger.message?.debug(response.usage);

            const aiMessage = this.convertToAiMessage(response.output);
            this.validateToolCallsByToolChoice(aiMessage.getFunctionCalls());

            return aiMessage;
        }

    }
}


export namespace OpenAIResponsesMessage {
    export type Ai<fdu extends Function.Declaration> = Ai.Constructor<fdu>;
    export namespace Ai {
        export function create<fdu extends Function.Declaration>(
            parts: RoleMessage.Ai.Part<fdu>[],
            raw: OpenAI.Responses.ResponseOutputItem[],
        ): Ai<fdu> {
            return new Constructor(parts, raw);
        }
        export const NOMINAL = Symbol();
        export class Constructor<out fdu extends Function.Declaration> extends RoleMessage.Ai.Constructor<fdu> {
            public declare readonly [NOMINAL]: void;
            public constructor(
                parts: RoleMessage.Ai.Part<fdu>[],
                protected raw: OpenAI.Responses.ResponseOutputItem[],
            ) {
                super(parts);
            }
            public getRaw(): OpenAI.Responses.ResponseOutputItem[] {
                return this.raw;
            }
        }
    }
}
