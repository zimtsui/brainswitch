import { CompatibleEngine } from '../compatible-engine.ts';
import { Engine, ResponseInvalid } from '../engine.ts';
import { RoleMessage, type Session, type ChatMessage } from '../session.ts';
import { Function } from '../function.ts';
import * as Google from '@google/genai';
import * as Undici from 'undici';
import { type InferenceContext } from '../inference-context.ts';
import { GoogleEngine } from '../api-types/google.ts';
import { Throttle } from '../throttle.ts';
import { logger } from '../telemetry.ts';



export namespace GoogleCompatibleEngine {

    export interface Options<in out fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Options<fdm>,
        GoogleEngine.Options<fdm>
    {}

    export interface OwnProps<in out fdm extends Function.Declaration.Map> {
        apiURL: URL;
    }
    export namespace OwnProps {
        export function init<fdm extends Function.Declaration.Map>(
            this: Engine.Underhood<fdm>,
            options: Options<fdm>,
        ): OwnProps<fdm> {
            return {
                apiURL: new URL(`${this.baseUrl}/v1beta/models/${this.model}:generateContent`),
            };
        }
    }

    export interface Underhood<in out fdm extends Function.Declaration.Map> extends
        GoogleEngine.Underhood<fdm>,
        CompatibleEngine.Underhood<fdm>,
        OwnProps<fdm>
    {
        convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Google.Content;
        convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Google.Content;
        convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content;
        convertFromChatMessages(chatMessages: ChatMessage<Function.Declaration.From<fdm>>[]): Google.Content[];
        convertToAiMessage(content: Google.Content): GoogleCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>;
        convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): Google.FunctionCallingConfig;
        fetch(wfctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    }

    export function convertFromAiMessage<fdm extends Function.Declaration.Map>(
        this: GoogleCompatibleEngine.Underhood<fdm>,
        aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>,
    ): Google.Content {
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

    export function convertFromChatMessages<fdm extends Function.Declaration.Map>(
        this: GoogleCompatibleEngine.Underhood<fdm>,
        chatMessages: ChatMessage<Function.Declaration.From<fdm>>[],
    ): Google.Content[] {
        return chatMessages.map(chatMessage => {
            if (chatMessage instanceof RoleMessage.User.Instance) return this.convertFromUserMessage(chatMessage);
            else if (chatMessage instanceof RoleMessage.Ai.Instance) return this.convertFromAiMessage(chatMessage);
            else throw new Error();
        });
    }

    export async function fetch<fdm extends Function.Declaration.Map>(
        this: GoogleCompatibleEngine.Underhood<fdm>,
        wfctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        const systemInstruction = session.developerMessage && this.convertFromDeveloperMessage(session.developerMessage);
        const contents = this.convertFromChatMessages(session.chatMessages);

        await this.throttle.requests(wfctx);

        const fdentries = Object.entries(this.fdm) as Function.Declaration.Entry.From<fdm>[];
        const tools = fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry));
        const reqbody: GoogleEngine.RestfulRequest = {
            contents,
            tools: tools.length ? [{
                functionDeclarations: tools,
            }] : undefined,
            toolConfig: tools.length ? {
                functionCallingConfig: this.convertFromToolChoice(this.toolChoice),
            } : undefined,
            systemInstruction,
            generationConfig: this.maxTokens || this.additionalOptions ? {
                maxOutputTokens: this.maxTokens ?? undefined,
                ...this.additionalOptions,
            } : undefined,
        };

        logger.message.trace(reqbody);

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
        logger.message.trace(res);
        if (res.ok) {} else throw new Error(undefined, { cause: res });
        const response = await res.json() as Google.GenerateContentResponse;

        if (response.candidates?.[0]?.content?.parts?.length) {} else throw new ResponseInvalid('Content missing', { cause: response });
        if (response.candidates[0].finishReason === Google.FinishReason.MAX_TOKENS)
            throw new ResponseInvalid('Token limit exceeded.', { cause: response });
        if (response.candidates[0].finishReason === Google.FinishReason.STOP) {}
        else throw new ResponseInvalid('Abnormal finish reason', { cause: response });


        for (const part of response.candidates[0].content.parts) {
            if (part.text) logger.inference.debug(part.text);
            if (part.functionCall) logger.message.debug(part.functionCall);
        }
        if (response.usageMetadata?.promptTokenCount) {} else throw new Error('Prompt token count absent', { cause: response });
        logger.message.debug(response.usageMetadata);

        const candidatesTokenCount = response.usageMetadata.candidatesTokenCount ?? 0;
        const cacheHitTokenCount = response.usageMetadata.cachedContentTokenCount ?? 0;
        const cacheMissTokenCount = response.usageMetadata.promptTokenCount - cacheHitTokenCount;
        const thinkingTokenCount = response.usageMetadata.thoughtsTokenCount ?? 0;
        const cost =
            this.inputPrice * cacheMissTokenCount / 1e6 +
            this.cachePrice * cacheHitTokenCount / 1e6 +
            this.outputPrice * candidatesTokenCount / 1e6 +
            this.outputPrice * thinkingTokenCount / 1e6;
        wfctx.cost?.(cost);

        const aiMessage = this.convertToAiMessage(response.candidates[0].content);
        this.validateToolCallsByToolChoice(aiMessage.getFunctionCalls());
        return aiMessage;
    }

    export function convertFromUserMessage<fdm extends Function.Declaration.Map>(
        userMessage: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): Google.Content {
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

    export function convertFromDeveloperMessage(
        developerMessage: RoleMessage.Developer,
    ): Google.Content {
        const parts = developerMessage.getParts().map(part => Google.createPartFromText(part.text));
        return { parts };
    }

    export function convertFromToolChoice<fdm extends Function.Declaration.Map>(
        toolChoice: Function.ToolChoice<fdm>,
    ): Google.FunctionCallingConfig {
        if (toolChoice === Function.ToolChoice.NONE) return { mode: Google.FunctionCallingConfigMode.NONE };
        else if (toolChoice === Function.ToolChoice.REQUIRED) return { mode: Google.FunctionCallingConfigMode.ANY };
        else if (toolChoice === Function.ToolChoice.AUTO) return { mode: Google.FunctionCallingConfigMode.AUTO };
        else return { mode: Google.FunctionCallingConfigMode.ANY, allowedFunctionNames: [...toolChoice] };
    }

    export function convertToAiMessage<fdm extends Function.Declaration.Map>(
        this: GoogleCompatibleEngine.Underhood<fdm>,
        content: Google.Content,
    ): GoogleCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
        if (content.parts) {} else throw new Error();
        return GoogleCompatibleEngine.Message.Ai.create(content.parts.flatMap(part => {
            const parts: RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] = [];
            if (part.functionCall || part.text) {} else throw new ResponseInvalid('Unknown content part', { cause: content });
            if (part.text) parts.push(RoleMessage.Part.Text.create(part.text));
            if (part.functionCall) parts.push(this.convertToFunctionCall(part.functionCall));
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


    export class Instance<in out fdm extends Function.Declaration.Map> implements GoogleCompatibleEngine.Underhood<fdm> {
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

        public toolChoice: Function.ToolChoice<fdm>;

        public parallelToolCall: boolean;

        public apiURL: URL;

        public constructor(options: GoogleCompatibleEngine.Options<fdm>) {
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
            ({ toolChoice: this.toolChoice } = (CompatibleEngine.OwnProps.init<fdm>).call(this, options));
            ({ parallelToolCall: this.parallelToolCall } = (GoogleEngine.OwnProps.init<fdm>).call(this, options));
            ({ apiURL: this.apiURL } = (GoogleCompatibleEngine.OwnProps.init<fdm>).call(this, options));
        }

        public stateless(wfctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return (CompatibleEngine.stateless<fdm>).call(this, wfctx, session);
        }
        public stateful(wfctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return (CompatibleEngine.stateful<fdm>).call(this, wfctx, session);
        }
        public appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return (CompatibleEngine.appendUserMessage<fdm>).call(this, session, message);
        }
        public pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return (CompatibleEngine.pushUserMessage<fdm>).call(this, session, message);
        }
        public validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void {
            return (CompatibleEngine.validateToolCallsByToolChoice<fdm>).call(this, toolCalls);
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
            return (GoogleCompatibleEngine.convertFromUserMessage<fdm>).call(this, userMessage);
        }
        public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Google.Content {
            return (GoogleCompatibleEngine.convertFromAiMessage<fdm>).call(this, aiMessage);
        }
        public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Google.Content {
            return (GoogleCompatibleEngine.convertFromDeveloperMessage).call(this, developerMessage);
        }
        public convertFromChatMessages(chatMessages: ChatMessage<Function.Declaration.From<fdm>>[]): Google.Content[] {
            return (GoogleCompatibleEngine.convertFromChatMessages<fdm>).call(this, chatMessages);
        }
        public convertToAiMessage(content: Google.Content): GoogleCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
            return (GoogleCompatibleEngine.convertToAiMessage<fdm>).call(this, content);
        }
        public convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): Google.FunctionCallingConfig {
            return (GoogleCompatibleEngine.convertFromToolChoice<fdm>).call(this, toolChoice);
        }
        public fetch(wfctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
            return (GoogleCompatibleEngine.fetch<fdm>).call(this, wfctx, session, signal);
        }

    }

    export function create<fdm extends Function.Declaration.Map>(options: CompatibleEngine.Options<fdm>): CompatibleEngine<fdm> {
        return new GoogleCompatibleEngine.Instance(options);
    }
}
