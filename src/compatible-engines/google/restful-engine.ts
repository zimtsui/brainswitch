import { CompatibleEngine } from '../../compatible-engine.ts';
import { ResponseInvalid, Engine } from '../../engine.ts';
import { RoleMessage, type Session, type ChatMessage } from '../../session.ts';
import { Function } from '../../function.ts';
import * as Google from '@google/genai';
import assert from 'node:assert';
import { GoogleCompatibleEngine } from './engine.ts';
import { fetch } from 'undici';
import { type InferenceContext } from '../../inference-context.ts';
import { GoogleEngine } from '../../api-types/google.ts';



export namespace GoogleCompatibleRestfulEngine {
    export interface Base<in out fdm extends Function.Declaration.Map> {
        fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    }

    export interface Instance<in out fdm extends Function.Declaration.Map> extends
        GoogleCompatibleEngine.Instance<fdm>,
        GoogleCompatibleRestfulEngine.Base<fdm>
    {}

    export namespace Base {
        export class Instance<in out fdm extends Function.Declaration.Map> implements GoogleCompatibleRestfulEngine.Base<fdm> {
            protected apiURL: URL;

            public constructor(protected instance: GoogleCompatibleEngine.Instance<fdm>) {
                this.apiURL = new URL(`${this.instance.baseUrl}/v1beta/models/${this.instance.model}:generateContent`);
            }

            public async fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
                const systemInstruction = session.developerMessage && this.instance.convertFromDeveloperMessage(session.developerMessage);
                const contents = this.instance.convertFromChatMessages(session.chatMessages);

                await this.instance.throttle.requests(ctx);

                const fdentries = Object.entries(this.instance.fdm) as Function.Declaration.Entry.From<fdm>[];
                const tools = fdentries.map(fdentry => this.instance.convertFromFunctionDeclarationEntry(fdentry));
                const reqbody: GoogleCompatibleRestfulEngine.Request = {
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
        }

    }

    export interface Request {
        contents: Google.Content[];
        tools?: Google.Tool[];
        toolConfig?: Google.ToolConfig;
        systemInstruction?: Google.Content;
        generationConfig?: Google.GenerationConfig;
    }


    export class Instance<in out fdm extends Function.Declaration.Map> implements GoogleCompatibleRestfulEngine.Instance<fdm> {
        protected engineBase: Engine.Base<fdm>;
        protected compatibleEngineBase: CompatibleEngine.Base<fdm>;
        protected googleEngineBase: GoogleEngine.Base<fdm>;
        protected googleCompatibleEngineBase: GoogleCompatibleEngine.Base<fdm>;
        protected googleCompatibleRestfulEngineBase: GoogleCompatibleRestfulEngine.Base<fdm>;

        public constructor(options: GoogleCompatibleRestfulEngine.Options<fdm>) {
            this.engineBase = new Engine.Base.Instance<fdm>(this, options);
            this.compatibleEngineBase = new CompatibleEngine.Base.Instance<fdm>(this, options);
            this.googleEngineBase = new GoogleEngine.Base.Instance<fdm>(this, options);
            this.googleCompatibleEngineBase = new GoogleCompatibleEngine.Base.Instance<fdm>(this);
            this.googleCompatibleRestfulEngineBase = new GoogleCompatibleRestfulEngine.Base.Instance<fdm>(this);
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
            return this.compatibleEngineBase.toolChoice;
        }
        public set toolChoice(value: Function.ToolChoice<fdm>) {
            this.compatibleEngineBase.toolChoice = value;
        }
        public stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return this.compatibleEngineBase.stateless(ctx, session);
        }
        public stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return this.compatibleEngineBase.stateful(ctx, session);
        }
        public appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return this.compatibleEngineBase.appendUserMessage(session, message);
        }
        public pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return this.compatibleEngineBase.pushUserMessage(session, message);
        }
        public validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void {
            return this.compatibleEngineBase.validateToolCallsByToolChoice(toolCalls);
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
            return this.googleCompatibleEngineBase.convertFromUserMessage(userMessage);
        }
        public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Google.Content {
            return this.googleCompatibleEngineBase.convertFromAiMessage(aiMessage);
        }
        public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content {
            return this.googleCompatibleEngineBase.convertFromDeveloperMessage(developerMessage);
        }
        public convertFromChatMessages(chatMessages: ChatMessage<Function.Declaration.From<fdm>>[]): Google.Content[] {
            return this.googleCompatibleEngineBase.convertFromChatMessages(chatMessages);
        }
        public convertToAiMessage(content: Google.Content): GoogleCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
            return this.googleCompatibleEngineBase.convertToAiMessage(content);
        }
        public convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): Google.FunctionCallingConfig {
            return this.googleCompatibleEngineBase.convertFromToolChoice(toolChoice);
        }


        public fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
            return this.googleCompatibleRestfulEngineBase.fetch(ctx, session, signal);
        }

    }

    export interface Options<in out fdm extends Function.Declaration.Map> extends CompatibleEngine.Options<fdm> {}

    export function create<fdm extends Function.Declaration.Map>(options: CompatibleEngine.Options<fdm>): CompatibleEngine<fdm> {
        return new GoogleCompatibleRestfulEngine.Instance(options);
    }
}
