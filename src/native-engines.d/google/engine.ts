import { Function } from '../../function.ts';
import { RoleMessage, type ChatMessage, type Session } from './session.ts';
import { ResponseInvalid, Engine, UserAbortion, InferenceTimeout } from '../../engine.ts';
import { type InferenceContext } from '../../inference-context.ts';
import * as Google from '@google/genai';
import assert from 'node:assert';
import { fetch } from 'undici';
import { GoogleEngine } from '../../api-types/google.ts';
import { GoogleCompatibleEngine } from '../../compatible-engines.d/google.ts';
import { CompatibleEngine } from '../../compatible-engine.ts';


export interface GoogleNativeEngine<fdm extends Function.Declaration.Map> extends Engine {
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

export namespace GoogleNativeEngine {
    export interface Options<fdm extends Function.Declaration.Map> extends Engine.Options<fdm>, CompatibleEngine.Options<fdm> {
        codeExecution?: boolean;
        urlContext?: boolean;
        googleSearch?: boolean;
    }

    export interface Base<fdm extends Function.Declaration.Map> {
        toolChoice: Function.ToolChoice<fdm>;
        codeExecution: boolean;
        urlContext: boolean;
        googleSearch: boolean;
        parallel: boolean;
        stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Google.Content;
        convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Google.Content;
        convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content;
        convertFromChatMessages(chatMessages: ChatMessage<Function.Declaration.From<fdm>>[]): Google.Content[];
        convertToAiMessage(content: Google.Content): RoleMessage.Ai<Function.Declaration.From<fdm>>;
        convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): Google.FunctionCallingConfig;
        appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>>;
        pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>>;
        fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void;
    }



    export interface Instance<fdm extends Function.Declaration.Map> extends
        GoogleEngine.Instance<fdm>,
        GoogleNativeEngine.Base<fdm>,
        GoogleNativeEngine<fdm>
    {}

    export namespace Base {
        export class Instance<in out fdm extends Function.Declaration.Map> implements GoogleNativeEngine.Base<fdm> {
            protected apiURL: URL;
            public parallel: boolean;
            public codeExecution: boolean;
            public urlContext: boolean;
            public googleSearch: boolean;
            public toolChoice: Function.ToolChoice<fdm>;

            public constructor(
                protected instance: GoogleNativeEngine.Instance<fdm>,
                options: GoogleNativeEngine.Options<fdm>,
            ) {
                this.apiURL = new URL(`${this.instance.baseUrl}/responses`);
                this.parallel = options.parallelToolCall ?? false;
                this.codeExecution = options.codeExecution ?? false;
                this.urlContext = options.urlContext ?? false;
                this.googleSearch = options.googleSearch ?? false;
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

            public convertToAiMessage(content: Google.Content): RoleMessage.Ai<Function.Declaration.From<fdm>> {
                assert(content.parts);
                return RoleMessage.Ai.create(content.parts.flatMap(part => {
                    const parts: RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] = [];
                    let payload = false;
                    if (part.text) {
                        payload = true;
                        parts.push(RoleMessage.Part.Text.create(part.text));
                    }
                    if (part.functionCall) {
                        payload = true;
                        parts.push(this.instance.convertToFunctionCall(part.functionCall));
                    }
                    if (this.instance.codeExecution && part.executableCode) {
                        payload = true;
                        assert(part.executableCode.code);
                        assert(part.executableCode.language);
                        parts.push(RoleMessage.Ai.Part.ExecutableCode.create(part.executableCode.code, part.executableCode.language));
                    }
                    if (this.instance.codeExecution && part.codeExecutionResult) {
                        payload = true;
                        assert(part.codeExecutionResult.outcome);
                        parts.push(RoleMessage.Ai.Part.CodeExecutionResult.create(part.codeExecutionResult.outcome, part.codeExecutionResult.output));
                    }
                    assert(payload, new ResponseInvalid('Unknown content part', { cause: content }));
                    return parts;
                }), content);
            }

            public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Google.Content {
                return aiMessage.getRaw();
            }

            public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Google.Content {
                return GoogleCompatibleEngine.convertFromUserMessage(userMessage);
            }

            public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content {
                return GoogleCompatibleEngine.convertFromDeveloperMessage(developerMessage);
            }

            public convertFromChatMessages(chatMessages: ChatMessage<Function.Declaration.From<fdm>>[]): Google.Content[] {
                return chatMessages.map(chatMessage => {
                    if (chatMessage instanceof RoleMessage.User.Instance) return this.convertFromUserMessage(chatMessage);
                    else if (chatMessage instanceof RoleMessage.Ai.Instance) return this.convertFromAiMessage(chatMessage);
                    else throw new Error();
                });
            }

            public convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): Google.FunctionCallingConfig {
                return GoogleCompatibleEngine.convertFromToolChoice(toolChoice);
            }

            public async fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
                const systemInstruction = session.developerMessage && this.instance.convertFromDeveloperMessage(session.developerMessage);
                const contents = this.instance.convertFromChatMessages(session.chatMessages);

                await this.instance.throttle.requests(ctx);

                const fdentries = Object.entries(this.instance.fdm) as Function.Declaration.Entry.From<fdm>[];
                const tools = fdentries.map(fdentry => this.instance.convertFromFunctionDeclarationEntry(fdentry));
                const reqbody: GoogleEngine.RestfulRequest = {
                    contents,
                    tools: tools.length ? [{
                        functionDeclarations: tools,
                    }] : undefined,
                    toolConfig: tools.length ? {
                        functionCallingConfig: this.instance.convertFromToolChoice(this.instance.toolChoice),
                    } : undefined,
                    systemInstruction,
                    generationConfig: this.instance.maxTokens || this.instance.additionalOptions ? {
                        maxOutputTokens: this.instance.maxTokens ?? undefined,
                        ...this.instance.additionalOptions,
                    } : undefined,
                };

                ctx.logger.message?.trace(reqbody);

                const res = await fetch(this.apiURL, {
                    method: 'POST',
                    headers: new Headers({
                        'Content-Type': 'application/json',
                        'x-goog-api-key': this.instance.apiKey,
                    }),
                    body: JSON.stringify(reqbody),
                    dispatcher: this.instance.proxyAgent,
                    signal,
                });
                ctx.logger.message?.trace(res);
                assert(res.ok, new Error(undefined, { cause: res }));
                const response = await res.json() as Google.GenerateContentResponse;

                assert(response.candidates?.[0]?.content?.parts?.length, new ResponseInvalid('Content missing', { cause: response }));
                if (response.candidates[0].finishReason === Google.FinishReason.MAX_TOKENS)
                    throw new ResponseInvalid('Token limit exceeded.', { cause: response });
                assert(
                    response.candidates[0].finishReason === Google.FinishReason.STOP,
                    new ResponseInvalid('Abnormal finish reason', { cause: response }),
                );


                for (const part of response.candidates[0].content.parts) {
                    if (part.text) ctx.logger.inference?.debug(part.text+'\n');
                    if (part.functionCall) ctx.logger.message?.debug(part.functionCall);
                }
                assert(response.usageMetadata?.promptTokenCount, new Error('Prompt token count absent', { cause: response }));
                ctx.logger.message?.debug(response.usageMetadata);

                const candidatesTokenCount = response.usageMetadata.candidatesTokenCount ?? 0;
                const cacheHitTokenCount = response.usageMetadata.cachedContentTokenCount ?? 0;
                const cacheMissTokenCount = response.usageMetadata.promptTokenCount - cacheHitTokenCount;
                const thinkingTokenCount = response.usageMetadata.thoughtsTokenCount ?? 0;
                const cost =
                    this.instance.inputPrice * cacheMissTokenCount / 1e6 +
                    this.instance.cachedPrice * cacheHitTokenCount / 1e6 +
                    this.instance.outputPrice * candidatesTokenCount / 1e6 +
                    this.instance.outputPrice * thinkingTokenCount / 1e6;
                ctx.logger.cost?.(cost);

                const aiMessage = this.instance.convertToAiMessage(response.candidates[0].content);
                this.instance.validateToolCallsByToolChoice(aiMessage.getFunctionCalls());
                return aiMessage;
            }

            public validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void {
                return CompatibleEngine.validateToolCallsByToolChoice(toolCalls, this.toolChoice);
            }
        }
    }

    export class Instance<in out fdm extends Function.Declaration.Map> implements GoogleNativeEngine.Instance<fdm> {
        protected engineBase: Engine.Base<fdm>;
        protected googleEngineBase: GoogleEngine.Base<fdm>;
        protected googleNativeEngineBase: GoogleNativeEngine.Base<fdm>;

        public constructor(options: GoogleNativeEngine.Options<fdm>) {
            this.engineBase = new Engine.Base.Instance<fdm>(this, options);
            this.googleEngineBase = new GoogleEngine.Base.Instance<fdm>(this, options);
            this.googleNativeEngineBase = new GoogleNativeEngine.Base.Instance<fdm>(this, options);
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


        public get toolChoice(): Function.ToolChoice<fdm> {
            return this.googleNativeEngineBase.toolChoice;
        }
        public set toolChoice(value: Function.ToolChoice<fdm>) {
            this.googleNativeEngineBase.toolChoice = value;
        }
        public stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return this.googleNativeEngineBase.stateless(ctx, session);
        }
        public stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return this.googleNativeEngineBase.stateful(ctx, session);
        }
        public appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return this.googleNativeEngineBase.appendUserMessage(session, message);
        }
        public pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return this.googleNativeEngineBase.pushUserMessage(session, message);
        }
        public validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void {
            return this.googleNativeEngineBase.validateToolCallsByToolChoice(toolCalls);
        }


        public get parallel(): boolean {
            return this.googleEngineBase.parallel;
        }
        public set parallel(value: boolean) {
            this.googleEngineBase.parallel = value;
        }
        public convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Google.FunctionCall {
            return this.googleEngineBase.convertFromFunctionCall(fc);
        }
        public convertToFunctionCall(googlefc: Google.FunctionCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
            return this.googleEngineBase.convertToFunctionCall(googlefc);
        }
        public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Google.FunctionDeclaration {
            return this.googleEngineBase.convertFromFunctionDeclarationEntry(fdentry);
        }


        public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Google.Content {
            return this.googleNativeEngineBase.convertFromUserMessage(userMessage);
        }
        public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Google.Content {
            return this.googleNativeEngineBase.convertFromAiMessage(aiMessage);
        }
        public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content {
            return this.googleNativeEngineBase.convertFromDeveloperMessage(developerMessage);
        }
        public convertFromChatMessages(chatMessages: ChatMessage<Function.Declaration.From<fdm>>[]): Google.Content[] {
            return this.googleNativeEngineBase.convertFromChatMessages(chatMessages);
        }
        public convertToAiMessage(content: Google.Content): RoleMessage.Ai<Function.Declaration.From<fdm>> {
            return this.googleNativeEngineBase.convertToAiMessage(content);
        }
        public convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): Google.FunctionCallingConfig {
            return this.googleNativeEngineBase.convertFromToolChoice(toolChoice);
        }


        public fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
            return this.googleNativeEngineBase.fetch(ctx, session, signal);
        }

    }

    export function create<fdm extends Function.Declaration.Map>(
        options: GoogleNativeEngine.Options<fdm>,
    ): GoogleNativeEngine<fdm> {
        return new GoogleNativeEngine.Instance<fdm>(options);
    }
}
