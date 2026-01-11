import { EngineBase } from '../engine-base.ts';
import { Function } from '../function.ts';
import { RoleMessage, type ChatMessage, type Session } from './openai-responses/session.ts';
import { Tool } from './openai-responses/tool.ts';
import { ResponseInvalid, type Engine, UserAbortion, InferenceTimeout } from '../engine.ts';
import { type InferenceContext } from '../inference-context.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { fetch } from 'undici';
import Ajv from 'ajv';

const ajv = new Ajv();


export type OpenAIResponsesNativeEngine<fdm extends Function.Declaration.Map = {}> = OpenAIResponsesNativeEngine.Constructor<fdm>;
export namespace OpenAIResponsesNativeEngine {
    export interface Options<fdm extends Function.Declaration.Map = {}> extends Engine.Options<fdm> {
        applyPatch?: boolean;
        toolChoice?: Tool.Choice<fdm>;
    }

    export function create<fdm extends Function.Declaration.Map = {}>(options: Options<fdm>): OpenAIResponsesNativeEngine<fdm> {
        return new Constructor<fdm>(options);
    }


    export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends EngineBase<fdm> {
        protected apiURL: URL;
        protected parallel: boolean;
        protected applyPatch: boolean;
        protected toolChoice: Tool.Choice<fdm>;

        public constructor(options: Options<fdm>) {
            super(options);
            this.apiURL = new URL(`${this.baseUrl}/responses`);
            this.parallel = options.parallelToolCall ?? false;
            this.applyPatch = options.applyPatch ?? false;
            this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;
        }

        public override async stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
            for (let retry = 0;; retry++) {
                const signalTimeout = this.timeout ? AbortSignal.timeout(this.timeout) : undefined;
                const signal = ctx.signal && signalTimeout ? AbortSignal.any([
                    ctx.signal,
                    signalTimeout,
                ]) : ctx.signal || signalTimeout;
                try {
                    return await this.fetch(ctx, session, signal);
                } catch (e) {
                    if (ctx.signal?.aborted) throw new UserAbortion();                                  // 用户中止
                    else if (signalTimeout?.aborted) e = new InferenceTimeout(undefined, { cause: e }); // 推理超时
                    else if (e instanceof ResponseInvalid) {}			                                // 模型抽风
                    else if (e instanceof TypeError) {}         		                                // 网络故障
                    else throw e;
                    if (retry < 3) ctx.logger.message?.warn(e); else throw e;
                }
            }
        }
        public async stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
            const response = await this.stateless(ctx, session);
            session.chatMessages.push(response);
            return response;
        }
        public appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>> {
            return {
                ...session,
                chatMessages: [...session.chatMessages, message],
            };
        }
        public pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>> {
            session.chatMessages.push(message);
            return session;
        }


        public convertToAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): RoleMessage.Ai<Function.Declaration.From<fdm>> {
            const parts = output.flatMap((item): RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] => {
                if (item.type === 'message') {
                    assert(item.content.every(part => part.type === 'output_text'));
                    return [RoleMessage.Part.Text.create(item.content.map(part => part.text).join(''))];
                } else if (item.type === 'function_call')
                    return [this.convertToFunctionCall(item)];
                else if (item.type === 'reasoning')
                    return [];
                else if (item.type === 'apply_patch_call')
                    return [Tool.ApplyPatch.Call.create(item)];
                else throw new Error();
            });
            return RoleMessage.Ai.create(parts, output);
        }

        public convertToFunctionCall(
            apifc: OpenAI.Responses.ResponseFunctionToolCall,
        ): Function.Call.Distributive<Function.Declaration.From<fdm>> {
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

        protected convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseFunctionToolCall {
            assert(fc.id);
            return {
                type: 'function_call',
                call_id: fc.id,
                name: fc.name,
                arguments: JSON.stringify(fc.args),
            };
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
            return userMessage.getParts().map(part => {
                if (part instanceof RoleMessage.Part.Text.Constructor)
                    return {
                        type: 'message',
                        role: 'user',
                        content: part.text,
                    } satisfies OpenAI.Responses.EasyInputMessage;
                else if (part instanceof Function.Response)
                    return this.convertFromFunctionResponse(part);
                else if (part instanceof Tool.ApplyPatch.Response)
                    return {
                        type: 'apply_patch_call_output',
                        call_id: part.id,
                        status: part.failure ? 'failed' : 'completed',
                        output: part.failure || undefined,
                    } satisfies OpenAI.Responses.ResponseInputItem.ApplyPatchCallOutput;
                else throw new Error();
            });
        }

        protected convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): string {
            return developerMessage.getOnlyText();
        }

        protected convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            if (chatMessage instanceof RoleMessage.User.Constructor)
                return this.convertFromUserMessage(chatMessage);
            else if (chatMessage instanceof RoleMessage.Ai.Constructor)
                return chatMessage.getRaw();
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

        protected convertFromToolChoice(toolChoice: Tool.Choice<fdm>): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
            if (toolChoice === Function.ToolChoice.NONE) return 'none';
            else if (toolChoice === Function.ToolChoice.REQUIRED) return 'required';
            else if (toolChoice === Function.ToolChoice.AUTO) return 'auto';
            else {
                return {
                    type: 'allowed_tools',
                    mode: 'required',
                    tools: toolChoice.map(
                        name => {
                            if (name === Tool.Choice.APPLY_PATCH)
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

        protected calcCost(usage: OpenAI.Responses.ResponseUsage): number {
            const cacheHitTokenCount = usage.input_tokens_details.cached_tokens;
            const cacheMissTokenCount = usage.input_tokens - cacheHitTokenCount;
            return	this.inputPrice * cacheMissTokenCount / 1e6 +
                    this.cachedPrice * cacheHitTokenCount / 1e6 +
                    this.outputPrice * usage.output_tokens / 1e6;
        }

        protected async fetch(
            ctx: InferenceContext,
            session: Session<Function.Declaration.From<fdm>>,
            signal?: AbortSignal,
        ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
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
            this.validateToolCallsByToolChoice(aiMessage.getToolCalls());

            return aiMessage;
        }

        protected validateToolCallsByToolChoice(
            toolCalls: Tool.Call<Function.Declaration.From<fdm>>[],
        ): void {
            if (this.toolChoice === Function.ToolChoice.REQUIRED)
                assert(toolCalls.length, new ResponseInvalid('Invalid function call', { cause: toolCalls }));
            else if (this.toolChoice instanceof Array) for (const tc of toolCalls) {
                if (tc instanceof Function.Call)
                    assert(this.toolChoice.includes(tc.name), new ResponseInvalid('Invalid function call', { cause: toolCalls }));
                else if (tc instanceof Tool.ApplyPatch.Call)
                    assert(this.toolChoice.includes(Tool.Choice.APPLY_PATCH), new ResponseInvalid('Invalid function call', { cause: toolCalls }));
                else throw new Error();
            } else if (this.toolChoice === Function.ToolChoice.NONE)
                assert(!toolCalls.length, new ResponseInvalid('Invalid function call', { cause: toolCalls }));
        }
    }

}
