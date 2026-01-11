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


export type OpenAIResponsesEngine<fdm extends Function.Declaration.Map = {}> = OpenAIResponsesEngine.Constructor<fdm>;
export namespace OpenAIResponsesEngine {
    export interface Options<fdm extends Function.Declaration.Map = {}> extends Engine.Options<fdm> {
        applyPatch?: boolean;
    }

    export type ToolChoice<fdm extends Function.Declaration.Map = {}> =
        | Function.ToolChoice<fdm>
        | (Function.Declaration.Map.NameOf<fdm> | typeof ToolChoice.APPLY_PATCH)[];
    export namespace ToolChoice {
        export const APPLY_PATCH = Symbol();
    }

    export function create<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): OpenAIResponsesEngine<fdm> {
        return new Constructor<fdm>(options);
    }

    export function convertToFunctionCall<fdm extends Function.Declaration.Map = {}>(
        apifc: OpenAI.Responses.ResponseFunctionToolCall,
        fdm?: fdm,
    ): Function.Call.Distributive<Function.Declaration.From<fdm>> {
        if (fdm) {
            const fditem = fdm[apifc.name] as Function.Declaration.Item.From<fdm> | undefined;
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
        } else {
            const args = (() => {
                try {
                    return JSON.parse(apifc.arguments);
                } catch (e) {
                    return new ResponseInvalid('Invalid JSON of function call', { cause: apifc });
                }
            })();
            return Function.Call.create({
                id: apifc.call_id,
                name: apifc.name,
                args,
            } as Function.Call.create.Options<Function.Declaration.From<fdm>>);
        }
    }

    export function convertToAiMessage<fdm extends Function.Declaration.Map = {}>(
        output: OpenAI.Responses.ResponseOutputItem[],
        fdm?: fdm,
    ): OpenAIResponsesAiMessage<Function.Declaration.From<fdm>> {
        const specificParts = output.flatMap((item): OpenAIResponsesAiMessage.Part<Function.Declaration.From<fdm>>[] => {
            if (item.type === 'message') {
                assert(item.content.every(part => part.type === 'output_text'));
                return [RoleMessage.Part.Text.create(item.content.map(part => part.text).join(''))];
            } else if (item.type === 'function_call')
                return [convertToFunctionCall(item, fdm)];
            else if (item.type === 'reasoning')
                return [];
            else if (item.type === 'apply_patch_call')
                return [OpenAIResponsesAiMessage.Part.ApplyPatchCall.create(item)];
            else throw new Error();
        });
        if (output.some(item => item.type === 'apply_patch_call'))
            return OpenAIResponsesAiMessage.create([], specificParts, output, true);
        const parts = output.flatMap((item): RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] => {
            if (item.type === 'message') {
                assert(item.content.every(part => part.type === 'output_text'));
                return [RoleMessage.Part.Text.create(item.content.map(part => part.text).join(''))];
            } else if (item.type === 'function_call')
                return [convertToFunctionCall(item, fdm)];
            else if (item.type === 'reasoning')
                return [];
            else throw new Error();
        });
        return OpenAIResponsesAiMessage.create(parts, specificParts, output);
    }

    export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends EngineBase<fdm> {
        protected apiURL: URL;
        protected parallel: boolean;
        protected applyPatch: boolean;

        public constructor(options: Options<fdm>) {
            super(options);
            this.apiURL = new URL(`${this.baseUrl}/responses`);
            this.parallel = options.parallelFunctionCall ?? false;
            this.applyPatch = options.applyPatch ?? false;
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
            return OpenAIResponsesEngine.convertToFunctionCall<fdm>(apifc, this.fdm);
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

        protected convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.Responses.FunctionTool {
            return {
                name: fdentry[0],
                description: fdentry[1].description,
                parameters: fdentry[1].paraschema,
                strict: true,
                type: 'function',
            };
        }

        protected convertFromToolChoice(toolChoice: ToolChoice<fdm>): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
            if (toolChoice === Function.ToolChoice.NONE) return 'none';
            else if (toolChoice === Function.ToolChoice.REQUIRED) return 'required';
            else if (toolChoice === Function.ToolChoice.AUTO) return 'auto';
            else {
                return {
                    type: 'allowed_tools',
                    mode: 'required',
                    tools: toolChoice.map(
                        name => {
                            if (name === ToolChoice.APPLY_PATCH)
                                return { type: 'apply_patch' } satisfies OpenAI.Responses.ToolChoiceApplyPatch;
                            else
                                return { type: 'function', name } satisfies OpenAI.Responses.ToolChoiceFunction;
                        },
                    ),
                };
            }
        }

        protected makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseCreateParamsNonStreaming {
            const fdentries = Object.entries(this.fdm) as Function.Declaration.Entry.From<fdm>[];
            const tools: OpenAI.Responses.Tool[] = fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry));
            if (this.applyPatch) tools.push({ type: 'apply_patch' });
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

        public convertToAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): OpenAIResponsesAiMessage<Function.Declaration.From<fdm>> {
            return OpenAIResponsesEngine.convertToAiMessage<fdm>(output, this.fdm);
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
    export function create<fdu extends Function.Declaration>(
        parts: RoleMessage.Ai.Part<fdu>[],
        partsSpecific: Part<fdu>[],
        raw: OpenAI.Responses.ResponseOutputItem[],
        specific = false,
    ): OpenAIResponsesAiMessage<fdu> {
        return new Constructor(parts, partsSpecific, raw, specific);
    }
    export const NOMINAL = Symbol();
    export class Constructor<out fdu extends Function.Declaration> extends RoleMessage.Ai.Constructor<fdu> {
        public declare readonly [NOMINAL]: void;
        public constructor(
            parts: RoleMessage.Ai.Part<fdu>[],
            public specificParts: Part<fdu>[],
            public raw: OpenAI.Responses.ResponseOutputItem[],
            specific: boolean,
        ) {
            super(parts);
            this.specific = specific;
        }
        public getSpecificText(): string {
            return this.specificParts.filter(part => part instanceof RoleMessage.Part.Text.Constructor).map(part => part.text).join('');
        }
        public getSpecificOnlyText(): string {
            assert(this.specificParts.every(part => part instanceof RoleMessage.Part.Text.Constructor));
            return this.getSpecificText();
        }
        public getSpecificOnlyFunctionCall(): Function.Call.Distributive<fdu> {
            const tcs = this.getSpecificToolCalls();
            assert(tcs.length === 1);
            const tc = tcs[0]!;
            assert(tc instanceof Function.Call);
            return tc;
        }
        public getSpecificOnlyApplyPatchCall(): Part.ApplyPatchCall.Constructor {
            const tcs = this.getSpecificToolCalls();
            assert(tcs.length === 1);
            const tc = tcs[0]!;
            assert(tc instanceof Part.ApplyPatchCall.Constructor);
            return tc;
        }
        public getSpecificToolCalls(): ToolCall<fdu>[] {
            return this.specificParts.filter(part => part instanceof Function.Call || part instanceof Part.ApplyPatchCall.Constructor);
        }
        public getSpecificFunctionCalls(): Function.Call.Distributive<fdu>[] {
            return this.specificParts.filter(part => part instanceof Function.Call);
        }
        public getSpecificOnlyFunctionCalls(): Function.Call.Distributive<fdu>[] {
            const tcs = this.getSpecificToolCalls();
            assert(tcs.every(tc => tc instanceof Function.Call));
            return tcs;
        }
    }

    export type ToolCall<fdu extends Function.Declaration = never> =
        | Function.Call.Distributive<fdu>
        | Part.ApplyPatchCall.Constructor
    ;

    export type Part<fdu extends Function.Declaration = never> = RoleMessage.Ai.Part<fdu> | Part.ApplyPatchCall;
    export namespace Part {
        export type ApplyPatchCall = ApplyPatchCall.Constructor;
        export namespace ApplyPatchCall {
            export function create(raw: OpenAI.Responses.ResponseApplyPatchToolCall): ApplyPatchCall {
                return new Constructor(raw);
            }
            export class Constructor {
                public constructor(public raw: OpenAI.Responses.ResponseApplyPatchToolCall) {}
            }
        }
    }

    export type Snapshot = OpenAI.Responses.ResponseOutputItem[];
    export function restore<fdm extends Function.Declaration.Map>(snapshot: Snapshot): OpenAIResponsesAiMessage<Function.Declaration.From<fdm>> {
        return OpenAIResponsesEngine.convertToAiMessage<fdm>(snapshot);
    }
    export function capture<fdu extends Function.Declaration>(message: OpenAIResponsesAiMessage<fdu>): Snapshot {
        return message.raw;
    }
}
