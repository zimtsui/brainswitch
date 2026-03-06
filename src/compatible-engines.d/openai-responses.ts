import { CompatibleEngine } from '../compatible-engine.ts';
import { Function } from '../function.ts';
import { RoleMessage, type ChatMessage, type Session } from '../session.ts';
import { Engine, ResponseInvalid } from '../engine.ts';
import { type InferenceContext } from '../inference-context.ts';
import OpenAI from 'openai';
import * as Undici from 'undici';
import { OpenAIResponsesEngine } from '../api-types/openai-responses.ts';
import { Throttle } from '../throttle.ts';



export namespace OpenAIResponsesCompatibleEngine {

    export interface Options<in out fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Options<fdm>,
        OpenAIResponsesEngine.Options<fdm>
    {}


    export interface OwnProps {
        apiURL: URL;
    }

    export interface Underhood<in out fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Underhood<fdm>,
        OpenAIResponsesEngine.Underhood<fdm>,
        OwnProps
    {
        convertToAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): OpenAIResponsesCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>;
        convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseFunctionToolCall;
        convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput;
        convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput;
        convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): string;
        convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput;
        convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed;
        makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseCreateParamsNonStreaming;
        logAiMessage(ctx: InferenceContext, output: OpenAI.Responses.ResponseOutputItem[]): void;
        fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<OpenAIResponsesCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>>;
    }


    export function convertToAiMessage<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesEngine.Underhood<fdm>,
        output: OpenAI.Responses.ResponseOutputItem[],
    ): OpenAIResponsesCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
        const parts = output.flatMap((item): RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] => {
            if (item.type === 'message') {
                if (item.content.every(part => part.type === 'output_text')) {} else throw new Error();
                return [RoleMessage.Part.Text.create(item.content.map(part => part.text).join(''))];
            } else if (item.type === 'function_call')
                return [this.convertToFunctionCall(item)];
            else if (item.type === 'reasoning')
                return [];
            else throw new Error();
        });
        return OpenAIResponsesCompatibleEngine.Message.Ai.create(parts, output);
    }

    export function convertFromFunctionCall<fdm extends Function.Declaration.Map>(
        fc: Function.Call.Distributive<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseFunctionToolCall {
        if (fc.id) {} else throw new Error();
        return {
            type: 'function_call',
            call_id: fc.id,
            name: fc.name,
            arguments: JSON.stringify(fc.args),
        };
    }


    export function convertFromUserMessage<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesEngine.Underhood<fdm>,
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
            else throw new Error();
        });
    }

    export function convertFromAiMessage<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesCompatibleEngine.Underhood<fdm>,
        aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseInput {
        if (aiMessage instanceof OpenAIResponsesCompatibleEngine.Message.Ai.Instance)
            return aiMessage.getRaw();
        else {
            return aiMessage.getParts().map(part => {
                if (part instanceof RoleMessage.Part.Text.Instance)
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

    export function convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): string {
        return developerMessage.getOnlyText();
    }

    export function convertFromChatMessage<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesCompatibleEngine.Underhood<fdm>,
        chatMessage: ChatMessage<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseInput {
        if (chatMessage instanceof RoleMessage.User.Instance)
            return this.convertFromUserMessage(chatMessage);
        else if (chatMessage instanceof RoleMessage.Ai.Instance)
            return this.convertFromAiMessage(chatMessage);
        else throw new Error();
    }


    export function convertFromToolChoice<fdm extends Function.Declaration.Map>(
        toolChoice: Function.ToolChoice<fdm>,
    ): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
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

    export function makeMonolithParams<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesCompatibleEngine.Underhood<fdm>,
        session: Session<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseCreateParamsNonStreaming {
        const fdentries = Object.entries(this.fdm) as Function.Declaration.Entry.From<fdm>[];
        const tools: OpenAI.Responses.Tool[] = fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry));
        return {
            model: this.model,
            include: ['reasoning.encrypted_content'],
            store: false,
            input: session.chatMessages.flatMap(chatMessage => this.convertFromChatMessage(chatMessage)),
            instructions: session.developerMessage && this.convertFromDeveloperMessage(session.developerMessage),
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? this.convertFromToolChoice(this.toolChoice) : undefined,
            parallel_tool_calls: fdentries.length ? this.parallelToolCall : undefined,
            max_output_tokens: this.maxTokens,
            ...this.additionalOptions,
        };
    }

    export function logAiMessage(ctx: InferenceContext, output: OpenAI.Responses.ResponseOutputItem[]): void {
        for (const item of output)
            if (item.type === 'message') {
                if (item.content.every(part => part.type === 'output_text')) {} else throw new Error();
                ctx.logger.inference?.debug(item.content.map(part => part.text).join('')+'\n');
            } else if (item.type === 'function_call')
                ctx.logger.message?.debug(item);
    }

    export async function fetch<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesCompatibleEngine.Underhood<fdm>,
        ctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<OpenAIResponsesCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>> {
        return await this.fetchRaw(ctx, session, signal).catch(e => Promise.reject(e instanceof OpenAI.APIError ? new ResponseInvalid(undefined, { cause: e }) : e));
    }

    export async function fetchRaw<fdm extends Function.Declaration.Map>(
        this: OpenAIResponsesCompatibleEngine.Underhood<fdm>,
        ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal,
    ): Promise<OpenAIResponsesCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>> {
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
        this.validateToolCallsByToolChoice(aiMessage.getFunctionCalls());

        return aiMessage;
    }




    export class Instance<in out fdm extends Function.Declaration.Map> implements OpenAIResponsesCompatibleEngine.Underhood<fdm> {
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

        public apiURL: URL;
        public parallelToolCall: boolean;

        public toolChoice: Function.ToolChoice<fdm>;

        public constructor(options: OpenAIResponsesCompatibleEngine.Options<fdm>) {
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
            ({ parallelToolCall: this.parallelToolCall } = (OpenAIResponsesEngine.OwnProps.init<fdm>).call(this, options));
            this.apiURL = new URL(`${this.baseUrl}/responses`);
        }


        public stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return (CompatibleEngine.stateless<fdm>).call(this, ctx, session);
        }
        public stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return (CompatibleEngine.stateful<fdm>).call(this, ctx, session);
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


        public convertToAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): OpenAIResponsesCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
            return (OpenAIResponsesCompatibleEngine.convertToAiMessage<fdm>).call(this, output);
        }
        public convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseFunctionToolCall {
            return (OpenAIResponsesCompatibleEngine.convertFromFunctionCall<fdm>).call(this, fc);
        }
        public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            return (OpenAIResponsesCompatibleEngine.convertFromUserMessage<fdm>).call(this, userMessage);
        }
        public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            return (OpenAIResponsesCompatibleEngine.convertFromAiMessage<fdm>).call(this, aiMessage);
        }
        public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): string {
            return (OpenAIResponsesCompatibleEngine.convertFromDeveloperMessage).call(this, developerMessage);
        }
        public convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            return (OpenAIResponsesCompatibleEngine.convertFromChatMessage<fdm>).call(this, chatMessage);
        }
        public convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
            return (OpenAIResponsesCompatibleEngine.convertFromToolChoice<fdm>).call(this, toolChoice);
        }
        public makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseCreateParamsNonStreaming {
            return (OpenAIResponsesCompatibleEngine.makeMonolithParams<fdm>).call(this, session);
        }
        public logAiMessage(ctx: InferenceContext, output: OpenAI.Responses.ResponseOutputItem[]): void {
            return (OpenAIResponsesCompatibleEngine.logAiMessage).call(this, ctx, output);
        }
        public fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal) {
            return (OpenAIResponsesCompatibleEngine.fetch<fdm>).call(this, ctx, session, signal);
        }
        public fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<OpenAIResponsesCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>> {
            return (OpenAIResponsesCompatibleEngine.fetchRaw<fdm>).call(this, ctx, session, signal);
        }
    }


    export function create<fdm extends Function.Declaration.Map>(
        options: OpenAIResponsesCompatibleEngine.Options<fdm>,
    ): CompatibleEngine<fdm> {
        return new OpenAIResponsesCompatibleEngine.Instance<fdm>(options);
    }

    export namespace Message {
        export type Ai<fdu extends Function.Declaration> = Ai.Instance<fdu>;
        export namespace Ai {
            export function create<fdu extends Function.Declaration>(
                parts: RoleMessage.Ai.Part<fdu>[],
                raw: OpenAI.Responses.ResponseOutputItem[],
            ): Ai<fdu> {
                return new Instance(parts, raw);
            }
            export const NOMINAL = Symbol();
            export class Instance<out fdu extends Function.Declaration> extends RoleMessage.Ai.Instance<fdu> {
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
}
