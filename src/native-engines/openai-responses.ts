import { Function } from '../function.ts';
import { RoleMessage, type ChatMessage, type Session } from './openai-responses/session.ts';
import { Tool } from './openai-responses/tool.ts';
import { ResponseInvalid, Engine, UserAbortion, InferenceTimeout } from '../engine.ts';
import { type InferenceContext } from '../inference-context.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { fetch } from 'undici';
import { OpenAIResponsesEngine } from '../api-types/openai-responses.ts';


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

    export interface Base<fdm extends Function.Declaration.Map> {
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

    export interface Instance<fdm extends Function.Declaration.Map> extends
        OpenAIResponsesEngine.Instance<fdm>,
        OpenAIResponsesNativeEngine.Base<fdm>,
        OpenAIResponsesNativeEngine<fdm>
    {}

    export namespace Base {
        export class Constructor<in out fdm extends Function.Declaration.Map> implements OpenAIResponsesNativeEngine.Base<fdm> {
            protected apiURL: URL;
            public parallel: boolean;
            public applyPatch: boolean;
            public toolChoice: Tool.Choice<fdm>;

            public constructor(
                protected instance: OpenAIResponsesNativeEngine.Instance<fdm>,
                options: OpenAIResponsesNativeEngine.Options<fdm>,
            ) {
                this.apiURL = new URL(`${this.instance.baseUrl}/responses`);
                this.parallel = options.parallelToolCall ?? false;
                this.applyPatch = options.applyPatch ?? false;
                this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;
            }

            public async stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
                for (let retry = 0;; retry++) {
                    const signalTimeout = this.instance.timeout ? AbortSignal.timeout(this.instance.timeout) : undefined;
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
                        return [this.instance.convertToFunctionCall(item)];
                    else if (item.type === 'reasoning')
                        return [];
                    else if (item.type === 'apply_patch_call')
                        return [Tool.ApplyPatch.Call.create(item)];
                    else throw new Error();
                });
                return RoleMessage.Ai.create(parts, output);
            }

            public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
                return userMessage.getParts().map(part => {
                    if (part instanceof RoleMessage.Part.Text.Constructor)
                        return {
                            type: 'message',
                            role: 'user',
                            content: part.text,
                        } satisfies OpenAI.Responses.EasyInputMessage;
                    else if (part instanceof Function.Response)
                        return this.instance.convertFromFunctionResponse(part);
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

            public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): string {
                return developerMessage.getOnlyText();
            }

            public convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
                if (chatMessage instanceof RoleMessage.User.Constructor)
                    return this.convertFromUserMessage(chatMessage);
                else if (chatMessage instanceof RoleMessage.Ai.Constructor)
                    return chatMessage.getRaw();
                else throw new Error();
            }

            public convertFromToolChoice(toolChoice: Tool.Choice<fdm>): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
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

            public makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseCreateParamsNonStreaming {
                const fdentries = Object.entries(this.instance.fdm) as Function.Declaration.Entry.From<fdm>[];
                const tools: OpenAI.Responses.Tool[] = fdentries.map(fdentry => this.instance.convertFromFunctionDeclarationEntry(fdentry));
                if (this.applyPatch) tools.push({ type: 'apply_patch' });
                return {
                    model: this.instance.model,
                    include: ['reasoning.encrypted_content'],
                    store: false,
                    input: session.chatMessages.flatMap(chatMessage => this.convertFromChatMessage(chatMessage)),
                    instructions: session.developerMessage && this.convertFromDeveloperMessage(session.developerMessage),
                    tools: tools.length ? tools : undefined,
                    tool_choice: tools.length ? this.convertFromToolChoice(this.toolChoice) : undefined,
                    parallel_tool_calls: fdentries.length ? this.parallel : undefined,
                    max_output_tokens: this.instance.maxTokens,
                    ...this.instance.additionalOptions,
                };
            }

            public logAiMessage(ctx: InferenceContext, output: OpenAI.Responses.ResponseOutputItem[]): void {
                for (const item of output)
                    if (item.type === 'message') {
                        assert(item.content.every(part => part.type === 'output_text'));
                        ctx.logger.inference?.debug(item.content.map(part => part.text).join('')+'\n');
                    } else if (item.type === 'function_call')
                        ctx.logger.message?.debug(item);
                    else if (item.type === 'apply_patch_call')
                        ctx.logger.message?.debug(item);
            }

            public async fetch(
                ctx: InferenceContext,
                session: Session<Function.Declaration.From<fdm>>,
                signal?: AbortSignal,
            ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
                return await this.fetchRaw(ctx, session, signal).catch(e => Promise.reject(e instanceof OpenAI.APIError ? new ResponseInvalid(undefined, { cause: e }) : e));
            }

            public async fetchRaw(
                ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal,
            ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
                const params = this.makeMonolithParams(session);
                ctx.logger.message?.trace(params);

                await this.instance.throttle.requests(ctx);
                const res = await fetch(
                    this.apiURL,
                    {
                        method: 'POST',
                        headers: new Headers({
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.instance.apiKey}`,
                        }),
                        body: JSON.stringify(params),
                        dispatcher: this.instance.proxyAgent,
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

                this.logAiMessage(ctx, response.output);

                assert(response.usage);
                const cost = this.instance.calcCost(response.usage);
                ctx.logger.cost?.(cost);
                ctx.logger.message?.debug(response.usage);

                const aiMessage = this.convertToAiMessage(response.output);
                this.validateToolCallsByToolChoice(aiMessage.getToolCalls());

                return aiMessage;
            }

            public validateToolCallsByToolChoice(
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

    export class Constructor<in out fdm extends Function.Declaration.Map> implements OpenAIResponsesNativeEngine.Instance<fdm> {
        protected engineBase: Engine.Base<fdm>;
        protected openAIResponsesEngineBase: OpenAIResponsesEngine.Base<fdm>;
        protected openAIResponsesNativeEngine: OpenAIResponsesNativeEngine.Base<fdm>;

        public constructor(options: OpenAIResponsesNativeEngine.Options<fdm>) {
            this.engineBase = new Engine.Base.Constructor<fdm>(this, options);
            this.openAIResponsesEngineBase = new OpenAIResponsesEngine.Base.Constructor<fdm>(this);
            this.openAIResponsesNativeEngine = new OpenAIResponsesNativeEngine.Base.Constructor<fdm>(this, options);
        }


        public get baseUrl(): string {
            return this.engineBase.baseUrl;
        }
        public set baseUrl(value: string) {
            this.engineBase.baseUrl = value;
        }
        public get apiKey(): string {
            return this.engineBase.apiKey;
        }
        public set apiKey(value: string) {
            this.engineBase.apiKey = value;
        }
        public get model(): string {
            return this.engineBase.model;
        }
        public set model(value: string) {
            this.engineBase.model = value;
        }
        public get name(): string {
            return this.engineBase.name;
        }
        public set name(value: string) {
            this.engineBase.name = value;
        }
        public get inputPrice(): number {
            return this.engineBase.inputPrice;
        }
        public set inputPrice(value: number) {
            this.engineBase.inputPrice = value;
        }
        public get outputPrice(): number {
            return this.engineBase.outputPrice;
        }
        public set outputPrice(value: number) {
            this.engineBase.outputPrice = value;
        }
        public get cachedPrice(): number {
            return this.engineBase.cachedPrice;
        }
        public set cachedPrice(value: number) {
            this.engineBase.cachedPrice = value;
        }
        public get fdm(): fdm {
            return this.engineBase.fdm;
        }
        public set fdm(value: fdm) {
            this.engineBase.fdm = value;
        }
        public get additionalOptions(): Record<string, unknown> | undefined {
            return this.engineBase.additionalOptions;
        }
        public set additionalOptions(value: Record<string, unknown> | undefined) {
            this.engineBase.additionalOptions = value;
        }
        public get throttle() {
            return this.engineBase.throttle;
        }
        public set throttle(value) {
            this.engineBase.throttle = value;
        }
        public get timeout(): number | undefined {
            return this.engineBase.timeout;
        }
        public set timeout(value: number | undefined) {
            this.engineBase.timeout = value;
        }
        public get maxTokens(): number | undefined {
            return this.engineBase.maxTokens;
        }
        public set maxTokens(value: number | undefined) {
            this.engineBase.maxTokens = value;
        }
        public get proxyAgent() {
            return this.engineBase.proxyAgent;
        }
        public set proxyAgent(value) {
            this.engineBase.proxyAgent = value;
        }


        public convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInputItem.FunctionCallOutput {
            return this.openAIResponsesEngineBase.convertFromFunctionResponse(fr);
        }
        public calcCost(usage: OpenAI.Responses.ResponseUsage): number {
            return this.openAIResponsesEngineBase.calcCost(usage);
        }
        public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.Responses.FunctionTool {
            return this.openAIResponsesEngineBase.convertFromFunctionDeclarationEntry(fdentry);
        }
        public convertToFunctionCall(apifc: OpenAI.Responses.ResponseFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
            return this.openAIResponsesEngineBase.convertToFunctionCall(apifc);
        }


        public get toolChoice(): Tool.Choice<fdm> {
            return this.openAIResponsesNativeEngine.toolChoice;
        }
        public set toolChoice(value: Tool.Choice<fdm>) {
            this.openAIResponsesNativeEngine.toolChoice = value;
        }
        public get parallel(): boolean {
            return this.openAIResponsesNativeEngine.parallel;
        }
        public set parallel(value: boolean) {
            this.openAIResponsesNativeEngine.parallel = value;
        }
        public get applyPatch(): boolean {
            return this.openAIResponsesNativeEngine.applyPatch;
        }
        public set applyPatch(value: boolean) {
            this.openAIResponsesNativeEngine.applyPatch = value;
        }
        public stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return this.openAIResponsesNativeEngine.stateless(ctx, session);
        }
        public stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return this.openAIResponsesNativeEngine.stateful(ctx, session);
        }
        public appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return this.openAIResponsesNativeEngine.appendUserMessage(session, message);
        }
        public pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return this.openAIResponsesNativeEngine.pushUserMessage(session, message);
        }
        public async fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal) {
            return this.openAIResponsesNativeEngine.fetch(ctx, session, signal);
        }
        public async fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal) {
            return this.openAIResponsesNativeEngine.fetchRaw(ctx, session, signal);
        }
        public convertToAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): RoleMessage.Ai<Function.Declaration.From<fdm>> {
            return this.openAIResponsesNativeEngine.convertToAiMessage(output);
        }
        public convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            return this.openAIResponsesNativeEngine.convertFromChatMessage(chatMessage);
        }
        public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            return this.openAIResponsesNativeEngine.convertFromUserMessage(userMessage);
        }
        public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): string {
            return this.openAIResponsesNativeEngine.convertFromDeveloperMessage(developerMessage);
        }
        public convertFromToolChoice(toolChoice: Tool.Choice<fdm>): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
            return this.openAIResponsesNativeEngine.convertFromToolChoice(toolChoice);
        }
        public makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseCreateParamsNonStreaming {
            return this.openAIResponsesNativeEngine.makeMonolithParams(session);
        }
        public logAiMessage(ctx: InferenceContext, output: OpenAI.Responses.ResponseOutputItem[]): void {
            return this.openAIResponsesNativeEngine.logAiMessage(ctx, output);
        }
        public validateToolCallsByToolChoice(toolCalls: Tool.Call<Function.Declaration.From<fdm>>[]): void {
            return this.openAIResponsesNativeEngine.validateToolCallsByToolChoice(toolCalls);
        }
    }

    export function create<fdm extends Function.Declaration.Map>(
        options: OpenAIResponsesNativeEngine.Options<fdm>,
    ): OpenAIResponsesNativeEngine<fdm> {
        return new OpenAIResponsesNativeEngine.Constructor<fdm>(options);
    }
}
