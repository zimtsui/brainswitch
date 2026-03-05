import { Function } from '../../function.ts';
import { RoleMessage, type ChatMessage, type Session } from './session.ts';
import { Tool } from './tool.ts';
import { ResponseInvalid, Engine, UserAbortion, InferenceTimeout } from '../../engine.ts';
import { type InferenceContext } from '../../inference-context.ts';
import OpenAI from 'openai';
import * as Undici from 'undici';
import { OpenAIResponsesEngine } from '../../api-types/openai-responses.ts';
import { Throttle } from '../../throttle.ts';


export interface OpenAIResponsesNativeEngine<fdm extends Function.Declaration.Map> extends Engine {
    /**
     * @throws {@link UserAbortion} 用户中止
     * @throws {@link InferenceTimeout} 推理超时
     * @throws {@link ResponseInvalid} 模型抽风
     * @throws {TypeError} 网络故障
     */
    stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    /**
     * @param session mutable
     */
    stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>>;
    /**
     * @param session mutable
     */
    pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>>;
}

export namespace OpenAIResponsesNativeEngine {
    export interface Options<fdm extends Function.Declaration.Map> extends Engine.Options<fdm> {
        applyPatch?: boolean;
        toolChoice?: Tool.Choice<fdm>;
    }

    export interface Abstract<fdm extends Function.Declaration.Map> extends
        OpenAIResponsesEngine.Abstract<fdm>,
        OpenAIResponsesNativeEngine<fdm>
    {
        apiURL: URL;
        toolChoice: Tool.Choice<fdm>;
        applyPatch: boolean;
        parallel: boolean;
        stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>>;
        pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>>;
        convertToAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): RoleMessage.Ai<Function.Declaration.From<fdm>>;
        convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput;
        convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): string;
        convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput;
        convertFromToolChoice(toolChoice: Tool.Choice<fdm>): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed;
        makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseCreateParamsNonStreaming;
        logAiMessage(ctx: InferenceContext, output: OpenAI.Responses.ResponseOutputItem[]): void;
        fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        validateToolCallsByToolChoice(toolCalls: Tool.Call<Function.Declaration.From<fdm>>[]): void;
    }


    export async function stateless<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesNativeEngine.Abstract<fdm>,
        ctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
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
    export async function stateful<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesNativeEngine.Abstract<fdm>,
        ctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        const response = await this.stateless(ctx, session);
        session.chatMessages.push(response);
        return response;
    }

    export function appendUserMessage<fdm extends Function.Declaration.Map>(
        session: Session<Function.Declaration.From<fdm>>,
        message: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): Session<Function.Declaration.From<fdm>> {
        return {
            ...session,
            chatMessages: [...session.chatMessages, message],
        };
    }

    export function pushUserMessage<fdm extends Function.Declaration.Map>(
        session: Session<Function.Declaration.From<fdm>>,
        message: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): Session<Function.Declaration.From<fdm>> {
        session.chatMessages.push(message);
        return session;
    }

    export function convertToAiMessage<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesEngine.Abstract<fdm>,
        output: OpenAI.Responses.ResponseOutputItem[],
    ): RoleMessage.Ai<Function.Declaration.From<fdm>> {
        const parts = output.flatMap((item): RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] => {
            if (item.type === 'message') {
                if (item.content.every(part => part.type === 'output_text')) {} else throw new Error();
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

    export function convertFromUserMessage<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesEngine.Abstract<fdm>,
        userMessage: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseInput {
        return userMessage.getParts().map(part => {
            if (part instanceof RoleMessage.Part.Text.Instance)
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

    export function convertFromDeveloperMessage(
        developerMessage: RoleMessage.Developer,
    ): string {
        return developerMessage.getOnlyText();
    }

    export function convertFromChatMessage<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesNativeEngine.Abstract<fdm>,
        chatMessage: ChatMessage<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseInput {
        if (chatMessage instanceof RoleMessage.User.Instance)
            return this.convertFromUserMessage(chatMessage);
        else if (chatMessage instanceof RoleMessage.Ai.Instance)
            return chatMessage.getRaw();
        else throw new Error();
    }

    export function convertFromToolChoice<fdm extends Function.Declaration.Map>(
        toolChoice: Tool.Choice<fdm>,
    ): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
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

    export function makeMonolithParams<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesNativeEngine.Abstract<fdm>,
        session: Session<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseCreateParamsNonStreaming {
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

    export function logAiMessage(
        ctx: InferenceContext,
        output: OpenAI.Responses.ResponseOutputItem[],
    ): void {
        for (const item of output)
            if (item.type === 'message') {
                if (item.content.every(part => part.type === 'output_text')) {} else throw new Error();
                ctx.logger.inference?.debug(item.content.map(part => part.text).join('')+'\n');
            } else if (item.type === 'function_call')
                ctx.logger.message?.debug(item);
            else if (item.type === 'apply_patch_call')
                ctx.logger.message?.debug(item);
    }

    export async function fetch<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesNativeEngine.Abstract<fdm>,
        ctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        return await this.fetchRaw(ctx, session, signal).catch(e => Promise.reject(e instanceof OpenAI.APIError ? new ResponseInvalid(undefined, { cause: e }) : e));
    }

    export async function fetchRaw<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesNativeEngine.Abstract<fdm>,
        ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        const params = this.makeMonolithParams(session);
        ctx.logger.message?.trace(params);

        await this.throttle.requests(ctx);
        const res = await Undici.fetch(
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
        if (res.ok) {} else throw new Error(undefined, { cause: res });
        const response = await res.json() as OpenAI.Responses.Response;
        ctx.logger.message?.trace(response);
        if (response.status === 'incomplete' && response.incomplete_details?.reason === 'max_output_tokens')
            throw new ResponseInvalid('Token limit exceeded.', { cause: response });
        if (response.status === 'completed') {}
        else throw new ResponseInvalid('Abnormal response status', { cause: response });

        this.logAiMessage(ctx, response.output);

        if (response.usage) {} else throw new Error();
        const cost = this.calcCost(response.usage);
        ctx.logger.cost?.(cost);
        ctx.logger.message?.debug(response.usage);

        const aiMessage = this.convertToAiMessage(response.output);
        this.validateToolCallsByToolChoice(aiMessage.getToolCalls());

        return aiMessage;
    }

    export function validateToolCallsByToolChoice<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesNativeEngine.Abstract<fdm>,
        toolCalls: Tool.Call<Function.Declaration.From<fdm>>[],
    ): void {
        if (this.toolChoice === Function.ToolChoice.REQUIRED)
            if (toolCalls.length) {} else throw new ResponseInvalid('Invalid function call', { cause: toolCalls });
        else if (this.toolChoice instanceof Array) for (const tc of toolCalls) {
            if (tc instanceof Function.Call)
                if (this.toolChoice.includes(tc.name)) {} else throw new ResponseInvalid('Invalid function call', { cause: toolCalls });
            else if (tc instanceof Tool.ApplyPatch.Call)
                if (this.toolChoice.includes(Tool.Choice.APPLY_PATCH)) {} else throw new ResponseInvalid('Invalid function call', { cause: toolCalls });
            else throw new Error();
        } else if (this.toolChoice === Function.ToolChoice.NONE)
            if (!toolCalls.length) {} else throw new ResponseInvalid('Invalid function call', { cause: toolCalls });
    }


    export class Instance<in out fdm extends Function.Declaration.Map> implements OpenAIResponsesNativeEngine.Abstract<fdm> {
        public baseUrl: string;
        public apiKey: string;
        public model: string;
        public name: string;
        public inputPrice: number;
        public outputPrice: number;
        public cachedPrice: number;
        public fdm: fdm;
        public additionalOptions?: Record<string, unknown>;
        public throttle: Throttle;
        public timeout?: number;
        public maxTokens?: number;
        public proxyAgent?: Undici.ProxyAgent;

        public apiURL: URL;
        public parallel: boolean;
        public applyPatch: boolean;
        public toolChoice: Tool.Choice<fdm>;

        public constructor(options: OpenAIResponsesNativeEngine.Options<fdm>) {
            ({
                baseUrl: this.baseUrl,
                apiKey: this.apiKey,
                model: this.model,
                name: this.name,
                inputPrice: this.inputPrice,
                outputPrice: this.outputPrice,
                cachedPrice: this.cachedPrice,
                fdm: this.fdm,
                additionalOptions: this.additionalOptions,
                throttle: this.throttle,
                timeout: this.timeout,
                maxTokens: this.maxTokens,
                proxyAgent: this.proxyAgent,
            } = (Engine.Base.create<fdm>).call(this, options));

            this.apiURL = new URL(`${this.baseUrl}/responses`);
            this.parallel = options.parallelToolCall ?? false;
            this.applyPatch = options.applyPatch ?? false;
            this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;

        }

        public convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInputItem.FunctionCallOutput {
            return (OpenAIResponsesEngine.convertFromFunctionResponse<fdm>).call(this, fr);
        }
        public calcCost(usage: OpenAI.Responses.ResponseUsage): number {
            return (OpenAIResponsesEngine.calcCost<fdm>).call(this, usage);
        }
        public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.Responses.FunctionTool {
            return (OpenAIResponsesEngine.convertFromFunctionDeclarationEntry<fdm>).call(this, fdentry);
        }
        public convertToFunctionCall(apifc: OpenAI.Responses.ResponseFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
            return (OpenAIResponsesEngine.convertToFunctionCall<fdm>).call(this, apifc);
        }


        public stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return (OpenAIResponsesNativeEngine.stateless<fdm>).call(this, ctx, session);
        }
        public stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return (OpenAIResponsesNativeEngine.stateful<fdm>).call(this, ctx, session);
        }
        public appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return (OpenAIResponsesNativeEngine.appendUserMessage<fdm>).call(this, session, message);
        }
        public pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return (OpenAIResponsesNativeEngine.pushUserMessage<fdm>).call(this, session, message);
        }
        public async fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal) {
            return (OpenAIResponsesNativeEngine.fetch<fdm>).call(this, ctx, session, signal);
        }
        public async fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal) {
            return (OpenAIResponsesNativeEngine.fetchRaw<fdm>).call(this, ctx, session, signal);
        }
        public convertToAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): RoleMessage.Ai<Function.Declaration.From<fdm>> {
            return (OpenAIResponsesNativeEngine.convertToAiMessage<fdm>).call(this, output);
        }
        public convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            return (OpenAIResponsesNativeEngine.convertFromChatMessage<fdm>).call(this, chatMessage);
        }
        public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            return (OpenAIResponsesNativeEngine.convertFromUserMessage<fdm>).call(this, userMessage);
        }
        public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): string {
            return (OpenAIResponsesNativeEngine.convertFromDeveloperMessage).call(this, developerMessage);
        }
        public convertFromToolChoice(toolChoice: Tool.Choice<fdm>): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
            return (OpenAIResponsesNativeEngine.convertFromToolChoice<fdm>).call(this, toolChoice);
        }
        public makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseCreateParamsNonStreaming {
            return (OpenAIResponsesNativeEngine.makeMonolithParams<fdm>).call(this, session);
        }
        public logAiMessage(ctx: InferenceContext, output: OpenAI.Responses.ResponseOutputItem[]): void {
            return (OpenAIResponsesNativeEngine.logAiMessage).call(this, ctx, output);
        }
        public validateToolCallsByToolChoice(toolCalls: Tool.Call<Function.Declaration.From<fdm>>[]): void {
            return (OpenAIResponsesNativeEngine.validateToolCallsByToolChoice<fdm>).call(this, toolCalls);
        }
    }

    export function create<fdm extends Function.Declaration.Map>(
        options: OpenAIResponsesNativeEngine.Options<fdm>,
    ): OpenAIResponsesNativeEngine<fdm> {
        return new OpenAIResponsesNativeEngine.Instance<fdm>(options);
    }
}
