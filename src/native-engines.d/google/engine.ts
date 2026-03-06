import { Function } from '../../function.ts';
import { RoleMessage, type ChatMessage, type Session } from './session.ts';
import { ResponseInvalid, Engine, UserAbortion, InferenceTimeout } from '../../engine.ts';
import { type InferenceContext } from '../../inference-context.ts';
import * as Google from '@google/genai';
import * as Undici from 'undici';
import { GoogleEngine } from '../../api-types/google.ts';
import { GoogleCompatibleEngine } from '../../compatible-engines.d/google.ts';
import { CompatibleEngine } from '../../compatible-engine.ts';
import { Throttle } from '../../throttle.ts';


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
    export interface Options<fdm extends Function.Declaration.Map> extends
        Engine.Options<fdm>,
        CompatibleEngine.Options.Tools<fdm>,
        GoogleEngine.Options<fdm>
    {
        codeExecution?: boolean;
        urlContext?: boolean;
        googleSearch?: boolean;
    }

    export interface Underhood<fdm extends Function.Declaration.Map> extends
        GoogleEngine.Underhood<fdm>,
        GoogleNativeEngine<fdm>
    {
        toolChoice: Function.ToolChoice<fdm>;
        codeExecution: boolean;
        urlContext: boolean;
        googleSearch: boolean;
        parallelToolCall: boolean;
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
        apiURL: URL;
    }

    export async function stateless<fdm extends Function.Declaration.Map>(
        this: GoogleNativeEngine.Underhood<fdm>,
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
        this: GoogleNativeEngine.Underhood<fdm>,
        ctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        const response = await this.stateless(ctx, session);
        session.chatMessages.push(response);
        return response;
    }

    export function appendUserMessage<fdm extends Function.Declaration.Map>(
        this: GoogleNativeEngine.Underhood<fdm>,
        session: Session<Function.Declaration.From<fdm>>,
        message: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): Session<Function.Declaration.From<fdm>> {
        return {
            ...session,
            chatMessages: [...session.chatMessages, message],
        };
    }

    export function pushUserMessage<fdm extends Function.Declaration.Map>(
        this: GoogleNativeEngine.Underhood<fdm>,
        session: Session<Function.Declaration.From<fdm>>,
        message: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): Session<Function.Declaration.From<fdm>> {
        session.chatMessages.push(message);
        return session;
    }

    export function convertToAiMessage<fdm extends Function.Declaration.Map>(
        this: GoogleNativeEngine.Underhood<fdm>,
        content: Google.Content,
    ): RoleMessage.Ai<Function.Declaration.From<fdm>> {
        if (content.parts) {} else throw new Error();
        return RoleMessage.Ai.create(content.parts.flatMap(part => {
            const parts: RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] = [];
            let payload = false;
            if (part.text) {
                payload = true;
                parts.push(RoleMessage.Part.Text.create(part.text));
            }
            if (part.functionCall) {
                payload = true;
                parts.push(this.convertToFunctionCall(part.functionCall));
            }
            if (this.codeExecution && part.executableCode) {
                payload = true;
                if (part.executableCode.code) {} else throw new Error();
                if (part.executableCode.language) {} else throw new Error();
                parts.push(RoleMessage.Ai.Part.ExecutableCode.create(part.executableCode.code, part.executableCode.language));
            }
            if (this.codeExecution && part.codeExecutionResult) {
                payload = true;
                if (part.codeExecutionResult.outcome) {} else throw new Error();
                parts.push(RoleMessage.Ai.Part.CodeExecutionResult.create(part.codeExecutionResult.outcome, part.codeExecutionResult.output));
            }
            if (payload) {} else throw new ResponseInvalid('Unknown content part', { cause: content });
            return parts;
        }), content);
    }

    export function convertFromAiMessage<fdm extends Function.Declaration.Map>(
        this: GoogleNativeEngine.Underhood<fdm>,
        aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>,
    ): Google.Content {
        return aiMessage.getRaw();
    }

    export function convertFromUserMessage<fdm extends Function.Declaration.Map>(
        this: GoogleNativeEngine.Underhood<fdm>,
        userMessage: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): Google.Content {
        return (GoogleCompatibleEngine.convertFromUserMessage<fdm>).call(this, userMessage);
    }

    export function convertFromDeveloperMessage<fdm extends Function.Declaration.Map>(
        this: GoogleNativeEngine.Underhood<fdm>,
        developerMessage: RoleMessage.Developer,
    ): Google.Content {
        return (GoogleCompatibleEngine.convertFromDeveloperMessage<fdm>).call(this, developerMessage);
    }

    export function convertFromChatMessages<fdm extends Function.Declaration.Map>(
        this: GoogleNativeEngine.Underhood<fdm>,
        chatMessages: ChatMessage<Function.Declaration.From<fdm>>[],
    ): Google.Content[] {
        return chatMessages.map(chatMessage => {
            if (chatMessage instanceof RoleMessage.User.Instance) return this.convertFromUserMessage(chatMessage);
            else if (chatMessage instanceof RoleMessage.Ai.Instance) return this.convertFromAiMessage(chatMessage);
            else throw new Error();
        });
    }

    export function convertFromToolChoice<fdm extends Function.Declaration.Map>(
        this: GoogleNativeEngine.Underhood<fdm>,
        toolChoice: Function.ToolChoice<fdm>,
    ): Google.FunctionCallingConfig {
        return (GoogleCompatibleEngine.convertFromToolChoice<fdm>).call(this, toolChoice);
    }

    export async function fetch<fdm extends Function.Declaration.Map>(
        this: GoogleNativeEngine.Underhood<fdm>,
        ctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        const systemInstruction = session.developerMessage && this.convertFromDeveloperMessage(session.developerMessage);
        const contents = this.convertFromChatMessages(session.chatMessages);

        await this.throttle.requests(ctx);

        const fdentries = Object.entries(this.fdm) as Function.Declaration.Entry.From<fdm>[];
        const functionDeclarations = fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry));
        const tools: Google.Tool[] = [];
        if (functionDeclarations.length) tools.push({ functionDeclarations });
        if (this.urlContext) tools.push({ urlContext: {} });
        if (this.googleSearch) tools.push({ googleSearch: {} });
        if (this.codeExecution) tools.push({ codeExecution: {} });
        const reqbody: GoogleEngine.RestfulRequest = {
            contents,
            tools: tools.length ? tools : undefined,
            toolConfig: functionDeclarations.length ? {
                functionCallingConfig: this.convertFromToolChoice(this.toolChoice),
            } : undefined,
            systemInstruction,
            generationConfig: this.maxTokens || this.additionalOptions ? {
                maxOutputTokens: this.maxTokens ?? undefined,
                ...this.additionalOptions,
            } : undefined,
        };

        ctx.logger.message?.trace(reqbody);

        const res = await Undici.fetch(this.apiURL, {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/json',
                'x-goog-api-key': this.apiKey,
            }),
            body: JSON.stringify(reqbody),
            dispatcher: this.proxyAgent,
            signal,
        });
        ctx.logger.message?.trace(res);
        if (res.ok) {} else throw new Error(undefined, { cause: res });
        const response = await res.json() as Google.GenerateContentResponse;

        if (response.candidates?.[0]?.content?.parts?.length) {} else throw new ResponseInvalid('Content missing', { cause: response });
        if (response.candidates[0].finishReason === Google.FinishReason.MAX_TOKENS)
            throw new ResponseInvalid('Token limit exceeded.', { cause: response });
        if (response.candidates[0].finishReason === Google.FinishReason.STOP) {}
        else throw new ResponseInvalid('Abnormal finish reason', { cause: response });


        for (const part of response.candidates[0].content.parts) {
            if (part.text) ctx.logger.inference?.debug(part.text+'\n');
            if (part.functionCall) ctx.logger.message?.debug(part.functionCall);
        }
        if (response.usageMetadata?.promptTokenCount) {}
        else throw new Error('Prompt token count absent', { cause: response });
        ctx.logger.message?.debug(response.usageMetadata);

        const candidatesTokenCount = response.usageMetadata.candidatesTokenCount ?? 0;
        const cacheHitTokenCount = response.usageMetadata.cachedContentTokenCount ?? 0;
        const cacheMissTokenCount = response.usageMetadata.promptTokenCount - cacheHitTokenCount;
        const thinkingTokenCount = response.usageMetadata.thoughtsTokenCount ?? 0;
        const cost =
            this.inputPrice * cacheMissTokenCount / 1e6 +
            this.cachePrice * cacheHitTokenCount / 1e6 +
            this.outputPrice * candidatesTokenCount / 1e6 +
            this.outputPrice * thinkingTokenCount / 1e6;
        ctx.logger.cost?.(cost);

        const aiMessage = this.convertToAiMessage(response.candidates[0].content);
        this.validateToolCallsByToolChoice(aiMessage.getFunctionCalls());
        return aiMessage;
    }

    export function validateToolCallsByToolChoice<fdm extends Function.Declaration.Map>(
        this: GoogleNativeEngine.Underhood<fdm>,
        toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[],
    ): void {
        Function.Call.validate<fdm>(
            toolCalls,
            this.toolChoice,
            new ResponseInvalid('Invalid function call', { cause: toolCalls }),
        );
    }

    export class Instance<in out fdm extends Function.Declaration.Map> implements GoogleNativeEngine.Underhood<fdm> {
        public baseUrl: string;
        public apiKey: string;
        public model: string;
        public name: string;
        public inputPrice: number;
        public outputPrice: number;
        public cachePrice: number;
        public fdm: fdm;
        public additionalOptions?: Record<string, unknown>;
        public throttle: Throttle;
        public timeout?: number;
        public maxTokens?: number;
        public proxyAgent?: Undici.ProxyAgent;

        public parallelToolCall: boolean;

        public apiURL: URL;
        public codeExecution: boolean;
        public urlContext: boolean;
        public googleSearch: boolean;
        public toolChoice: Function.ToolChoice<fdm>;

        public constructor(options: GoogleNativeEngine.Options<fdm>) {
            ({
                baseUrl: this.baseUrl,
                apiKey: this.apiKey,
                model: this.model,
                name: this.name,
                inputPrice: this.inputPrice,
                outputPrice: this.outputPrice,
                cachePrice: this.cachePrice,
                fdm: this.fdm,
                additionalOptions: this.additionalOptions,
                throttle: this.throttle,
                timeout: this.timeout,
                maxTokens: this.maxTokens,
                proxyAgent: this.proxyAgent,
            } = (Engine.OwnProps.init<fdm>).call(this, options));

            ({ parallel: this.parallelToolCall } = (GoogleEngine.OwnProps.init<fdm>).call(this, options));

            this.apiURL = new URL(`${this.baseUrl}/v1beta/models/${this.model}:generateContent`);
            this.codeExecution = options.codeExecution ?? false;
            this.urlContext = options.urlContext ?? false;
            this.googleSearch = options.googleSearch ?? false;
            this.toolChoice = options.toolChoice ?? Function.ToolChoice.AUTO;
        }


        public stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return (GoogleNativeEngine.stateless<fdm>).call(this, ctx, session);
        }
        public stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return (GoogleNativeEngine.stateful<fdm>).call(this, ctx, session);
        }
        public appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return (GoogleNativeEngine.appendUserMessage<fdm>).call(this, session, message);
        }
        public pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return (GoogleNativeEngine.pushUserMessage<fdm>).call(this, session, message);
        }
        public validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void {
            return (GoogleNativeEngine.validateToolCallsByToolChoice<fdm>).call(this, toolCalls);
        }


        public convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Google.FunctionCall {
            return (GoogleEngine.convertFromFunctionCall<fdm>).call(this, fc);
        }
        public convertToFunctionCall(googlefc: Google.FunctionCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
            return (GoogleEngine.convertToFunctionCall<fdm>).call(this, googlefc);
        }
        public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Google.FunctionDeclaration {
            return (GoogleEngine.convertFromFunctionDeclarationEntry<fdm>).call(this, fdentry);
        }


        public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Google.Content {
            return (GoogleNativeEngine.convertFromUserMessage<fdm>).call(this, userMessage);
        }
        public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Google.Content {
            return (GoogleNativeEngine.convertFromAiMessage<fdm>).call(this, aiMessage);
        }
        public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content {
            return (GoogleNativeEngine.convertFromDeveloperMessage).call(this, developerMessage);
        }
        public convertFromChatMessages(chatMessages: ChatMessage<Function.Declaration.From<fdm>>[]): Google.Content[] {
            return (GoogleNativeEngine.convertFromChatMessages<fdm>).call(this, chatMessages);
        }
        public convertToAiMessage(content: Google.Content): RoleMessage.Ai<Function.Declaration.From<fdm>> {
            return (GoogleNativeEngine.convertToAiMessage<fdm>).call(this, content);
        }
        public convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): Google.FunctionCallingConfig {
            return (GoogleNativeEngine.convertFromToolChoice<fdm>).call(this, toolChoice);
        }


        public fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
            return (GoogleNativeEngine.fetch<fdm>).call(this, ctx, session, signal);
        }

    }

    export function create<fdm extends Function.Declaration.Map>(
        options: GoogleNativeEngine.Options<fdm>,
    ): GoogleNativeEngine<fdm> {
        return new GoogleNativeEngine.Instance<fdm>(options);
    }
}
