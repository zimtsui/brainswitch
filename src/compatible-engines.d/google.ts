import { CompatibleEngine } from '../compatible-engine.ts';
import { ResponseInvalid, Engine } from '../engine.ts';
import { RoleMessage, type Session, type ChatMessage } from '../session.ts';
import { Function } from '../function.ts';
import * as Google from '@google/genai';
import { fetch } from 'undici';
import { type InferenceContext } from '../inference-context.ts';
import { GoogleEngine } from '../api-types/google.ts';



export namespace GoogleCompatibleEngine {
    export interface Base<in out fdm extends Function.Declaration.Map> {
        convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Google.Content;
        convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Google.Content;
        convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content;
        convertFromChatMessages(chatMessages: ChatMessage<Function.Declaration.From<fdm>>[]): Google.Content[];
        convertToAiMessage(content: Google.Content): GoogleCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>;
        convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): Google.FunctionCallingConfig;
        fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    }

    export interface Instance<in out fdm extends Function.Declaration.Map> extends
        GoogleEngine.Instance<fdm>,
        CompatibleEngine.Instance<fdm>,
        GoogleCompatibleEngine.Base<fdm>
    {}

    export namespace Base {
        export class Instance<in out fdm extends Function.Declaration.Map> implements GoogleCompatibleEngine.Base<fdm> {
            protected apiURL: URL;

            public constructor(protected instance: GoogleCompatibleEngine.Instance<fdm>) {
                this.apiURL = new URL(`${this.instance.baseUrl}/v1beta/models/${this.instance.model}:generateContent`);
            }


            public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Google.Content {
                return GoogleCompatibleEngine.convertFromUserMessage(userMessage);
            }

            public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Google.Content {
                if (aiMessage instanceof GoogleCompatibleEngine.Message.Ai.Instance)
                    return aiMessage.getRaw();
                else {
                    const parts = aiMessage.getParts().map(part => {
                        if (part instanceof RoleMessage.Part.Text.Instance)
                            return Google.createPartFromText(part.text);
                        else if (part instanceof Function.Call) {
                            if (part.args instanceof Object) {} else throw new Error();
                            return Google.createPartFromFunctionCall(part.name, part.args as Record<string, unknown>);
                        } else throw new Error();
                    });
                    return Google.createModelContent(parts);
                }
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

            public convertToAiMessage(content: Google.Content): GoogleCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
                return GoogleCompatibleEngine.convertToAiMessage<fdm>(content, this.instance.fdm);
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
                if (response.usageMetadata?.promptTokenCount) {} else throw new Error('Prompt token count absent', { cause: response });
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


    export function convertFromUserMessage<fdm extends Function.Declaration.Map>(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Google.Content {
        const parts = userMessage.getParts().map(part => {
            if (part instanceof RoleMessage.Part.Text.Instance)
                return Google.createPartFromText(part.text);
            else if (part instanceof Function.Response)
                return {
                    functionResponse: { id: part.id, name: part.name, response: { returnValue: part.text } },
                };
            else throw new Error();
        });
        return Google.createUserContent(parts);
    }

    export function convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content {
        const parts = developerMessage.getParts().map(part => Google.createPartFromText(part.text));
        return { parts };
    }

    export function convertFromToolChoice<fdm extends Function.Declaration.Map>(toolChoice: Function.ToolChoice<fdm>): Google.FunctionCallingConfig {
        if (toolChoice === Function.ToolChoice.NONE) return { mode: Google.FunctionCallingConfigMode.NONE };
        else if (toolChoice === Function.ToolChoice.REQUIRED) return { mode: Google.FunctionCallingConfigMode.ANY };
        else if (toolChoice === Function.ToolChoice.AUTO) return { mode: Google.FunctionCallingConfigMode.AUTO };
        else return { mode: Google.FunctionCallingConfigMode.ANY, allowedFunctionNames: [...toolChoice] };
    }

    export function convertToAiMessage<fdm extends Function.Declaration.Map>(
        content: Google.Content,
        fdm: fdm,
    ): GoogleCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
        if (content.parts) {} else throw new Error();
        return GoogleCompatibleEngine.Message.Ai.create(content.parts.flatMap(part => {
            const parts: RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] = [];
            if (part.functionCall || part.text) {} else throw new ResponseInvalid('Unknown content part', { cause: content });
            if (part.text) parts.push(RoleMessage.Part.Text.create(part.text));
            if (part.functionCall) parts.push(GoogleEngine.convertToFunctionCall(part.functionCall, fdm));
            return parts;
        }), content);
    }

    export namespace Message {
        export type Ai<fdu extends Function.Declaration> = Ai.Instance<fdu>;
        export namespace Ai {
            export function create<fdu extends Function.Declaration>(parts: RoleMessage.Ai.Part<fdu>[], raw: Google.Content): Ai<fdu> {
                return new Instance(parts, raw);
            }
            export const NOMINAL = Symbol();
            export class Instance<out fdu extends Function.Declaration> extends RoleMessage.Ai.Instance<fdu> {
                public declare readonly [NOMINAL]: void;
                public constructor(parts: RoleMessage.Ai.Part<fdu>[], protected raw: Google.Content) {
                    super(parts);
                }
                public getRaw(): Google.Content {
                    return this.raw;
                }
            }
        }
    }


    export class Instance<in out fdm extends Function.Declaration.Map> implements GoogleCompatibleEngine.Instance<fdm> {
        protected engineBase: Engine.Base<fdm>;
        protected compatibleEngineBase: CompatibleEngine.Base<fdm>;
        protected googleEngineBase: GoogleEngine.Base<fdm>;
        protected googleCompatibleEngineBase: GoogleCompatibleEngine.Base<fdm>;

        public constructor(options: GoogleCompatibleEngine.Options<fdm>) {
            this.engineBase = new Engine.Base.Instance<fdm>(this, options);
            this.compatibleEngineBase = new CompatibleEngine.Base.Instance<fdm>(this, options);
            this.googleEngineBase = new GoogleEngine.Base.Instance<fdm>(this, options);
            this.googleCompatibleEngineBase = new GoogleCompatibleEngine.Base.Instance<fdm>(this);
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
            return this.googleCompatibleEngineBase.fetch(ctx, session, signal);
        }

    }

    export interface Options<in out fdm extends Function.Declaration.Map> extends CompatibleEngine.Options<fdm> {}

    export function create<fdm extends Function.Declaration.Map>(options: CompatibleEngine.Options<fdm>): CompatibleEngine<fdm> {
        return new GoogleCompatibleEngine.Instance(options);
    }
}
