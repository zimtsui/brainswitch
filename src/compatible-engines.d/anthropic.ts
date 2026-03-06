import { CompatibleEngine } from '../compatible-engine.ts';
import { Function } from '../function.ts';
import { RoleMessage, type ChatMessage, type Session } from '../session.ts';
import { Engine, ResponseInvalid } from '../engine.ts';
import { type InferenceContext } from '../inference-context.ts';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicEngine } from '../api-types/anthropic.ts';
import * as Undici from 'undici';
import { Throttle } from '../throttle.ts';


export namespace AnthropicCompatibleEngine {
    export interface Options<fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Options<fdm>,
        AnthropicEngine.Options<fdm>
    {}

    export interface Underhood<fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Underhood<fdm>,
        AnthropicEngine.Underhood<fdm>
    {
        convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Anthropic.ContentBlockParam[];
        convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Anthropic.ContentBlockParam[];
        convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Anthropic.TextBlockParam[];
        convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): Anthropic.MessageParam;
        makeParams(session: Session<Function.Declaration.From<fdm>>): Anthropic.MessageCreateParamsStreaming;
        convertToAiMessage(raw: Anthropic.ContentBlock[]): AnthropicCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>;
        fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    }


    export function convertFromUserMessage<fdm extends Function.Declaration.Map>(
        this: AnthropicEngine.Underhood<fdm>,
        userMessage: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): Anthropic.ContentBlockParam[] {
        return userMessage.getParts().map(part => {
            if (part instanceof RoleMessage.Part.Text.Instance)
                return {
                    type: 'text',
                    text: part.text,
                } satisfies Anthropic.TextBlockParam;
            else if (part instanceof Function.Response)
                return this.convertFromFunctionResponse(part);
            else throw new Error();
        });
    }

    export function convertFromAiMessage<fdm extends Function.Declaration.Map>(
        this: AnthropicEngine.Underhood<fdm>,
        aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>,
    ): Anthropic.ContentBlockParam[] {
        if (aiMessage instanceof AnthropicCompatibleEngine.Message.Ai.Instance)
            return aiMessage.raw;
        else {
            return aiMessage.getParts().map(part => {
                if (part instanceof RoleMessage.Part.Text.Instance)
                    return {
                        type: 'text',
                        text: part.text,
                    } satisfies Anthropic.TextBlockParam;
                else if (part instanceof Function.Call)
                    return this.convertFromFunctionCall(part);
                else throw new Error();
            });
        }
    }

    export function convertFromDeveloperMessage(
        developerMessage: RoleMessage.Developer,
    ): Anthropic.TextBlockParam[] {
        return developerMessage.getParts().map(part => ({ type: 'text', text: part.text}));
    }

    export function convertFromChatMessage<fdm extends Function.Declaration.Map>(
        this: AnthropicCompatibleEngine.Underhood<fdm>,
        chatMessage: ChatMessage<Function.Declaration.From<fdm>>,
    ): Anthropic.MessageParam {
        if (chatMessage instanceof RoleMessage.User.Instance)
            return { role: 'user', content: this.convertFromUserMessage(chatMessage) };
        else if (chatMessage instanceof RoleMessage.Ai.Instance)
            return { role: 'assistant', content: this.convertFromAiMessage(chatMessage) };
        else throw new Error();
    }

    export function makeParams<fdm extends Function.Declaration.Map>(
        this: AnthropicCompatibleEngine.Underhood<fdm>,
        session: Session<Function.Declaration.From<fdm>>,
    ): Anthropic.MessageCreateParamsStreaming {
        const fdentries = Object.entries(this.fdm) as Function.Declaration.Entry.From<fdm>[];
        const tools = fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry));
        return {
            model: this.model,
            stream: true,
            messages: session.chatMessages.map(chatMessage => this.convertFromChatMessage(chatMessage)),
            system: session.developerMessage && this.convertFromDeveloperMessage(session.developerMessage),
            tools: tools.length ? tools : undefined,
            max_tokens: this.maxTokens ?? 64 * 1024,
            ...this.additionalOptions,
        };
    }

    export function convertToAiMessage<fdm extends Function.Declaration.Map>(
        this: AnthropicEngine.Underhood<fdm>,
        raw: Anthropic.ContentBlock[],
    ): AnthropicCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
        const parts = raw.flatMap((item): RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] => {
            if (item.type === 'text') {
                return [RoleMessage.Part.Text.create(item.text)];
            } else if (item.type === 'tool_use')
                return [this.convertToFunctionCall(item)];
            else if (item.type === 'thinking')
                return [];
            else throw new Error();
        });
        return AnthropicCompatibleEngine.Message.Ai.create(parts, raw);
    }

    export async function fetch<fdm extends Function.Declaration.Map>(
        this: AnthropicCompatibleEngine.Underhood<fdm>,
        ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        const params = this.makeParams(session);
        ctx.logger.message?.trace(params);

        await this.throttle.requests(ctx);
        const stream = this.anthropic.messages.stream(params, { signal });

        let response: Anthropic.Message | null = null;
        for await (const event of stream) {
            if (event.type === 'message_start') {
                ctx.logger.message?.trace(event);
                response = structuredClone(event.message);
            } else {
                if (response) {} else throw new Error();
                if (event.type === 'message_delta') {
                    ctx.logger.message?.trace(event);
                    response.stop_sequence = event.delta.stop_sequence ?? response.stop_sequence;
                    response.stop_reason = event.delta.stop_reason ?? response.stop_reason;
                    response.usage.input_tokens = event.usage.input_tokens ?? response.usage.input_tokens;
                    response.usage.output_tokens = event.usage.output_tokens;
                    response.usage.cache_read_input_tokens = event.usage.cache_read_input_tokens ?? response.usage.cache_read_input_tokens;
                    response.usage.cache_creation_input_tokens = event.usage.cache_creation_input_tokens ?? response.usage.cache_creation_input_tokens;
                    response.usage.server_tool_use = event.usage.server_tool_use ?? response.usage.server_tool_use;
                } else if (event.type === 'message_stop') {
                    ctx.logger.message?.trace(event);
                } else if (event.type === 'content_block_start') {
                    ctx.logger.message?.trace(event);
                    const contentBlock = structuredClone(event.content_block);
                    response.content.push(contentBlock);
                    if (contentBlock.type === 'tool_use') contentBlock.input = '';
                } else if (event.type === 'content_block_delta') {
                    const contentBlock = response.content[event.index];
                    if (event.delta.type === 'text_delta'){
                        ctx.logger.inference?.debug(event.delta.text);
                        if (contentBlock?.type === 'text') {} else throw new Error();
                        contentBlock.text += event.delta.text;
                    } else if (event.delta.type === 'thinking_delta') {
                        ctx.logger.inference?.trace(event.delta.thinking);
                        if (contentBlock?.type === 'thinking') {} else throw new Error();
                        contentBlock.thinking += event.delta.thinking;
                    } else if (event.delta.type === 'signature_delta') {
                        if (contentBlock?.type === 'thinking') {} else throw new Error();
                        contentBlock.signature += event.delta.signature;
                    } else if (event.delta.type === 'input_json_delta') {
                        ctx.logger.inference?.trace(event.delta.partial_json);
                        if (contentBlock?.type === 'tool_use') {} else throw new Error();
                        if (typeof contentBlock.input === 'string') {} else throw new Error();
                        contentBlock.input += event.delta.partial_json;
                    } else throw new Error('Unknown type of content block delta', { cause: event.delta });
                } else if (event.type === 'content_block_stop') {
                    const contentBlock = response.content[event.index];
                    if (contentBlock?.type === 'text') ctx.logger.inference?.debug('\n');
                    else if (contentBlock?.type === 'thinking') ctx.logger.inference?.trace('\n');
                    else if (contentBlock?.type === 'tool_use') ctx.logger.inference?.debug('\n');
                    ctx.logger.message?.trace(event);
                    if (contentBlock?.type === 'tool_use') {
                        if (typeof contentBlock.input === 'string') {} else throw new Error();
                        ctx.logger.message?.debug(contentBlock);
                    }
                } else throw new Error('Unknown stream event', { cause: event });
            }
        }
        if (response) {} else throw new Error();
        if (response.stop_reason === 'max_tokens')
            throw new ResponseInvalid('Token limit exceeded.', { cause: response });
        if (response.stop_reason === 'end_turn' || response.stop_reason === 'tool_use') {}
        else throw new ResponseInvalid('Abnormal stop reason', { cause: response });

        const cost = this.calcCost(response.usage);
        ctx.logger.cost?.(cost);
        ctx.logger.message?.debug(response.usage);

        const aiMessage = this.convertToAiMessage(response.content);
        this.validateToolCallsByToolChoice(aiMessage.getFunctionCalls());

        return aiMessage;
    }




    export namespace Message {
        export type Ai<fdu extends Function.Declaration> = Ai.Instance<fdu>;
        export namespace Ai {
            export function create<fdu extends Function.Declaration>(
                parts: RoleMessage.Ai.Part<fdu>[],
                raw: Anthropic.ContentBlock[],
            ): Ai<fdu> {
                return new Instance(parts, raw);
            }
            export const NOMINAL = Symbol();
            export class Instance<out fdu extends Function.Declaration> extends RoleMessage.Ai.Instance<fdu> {
                public declare readonly [NOMINAL]: void;
                public constructor(
                    parts: RoleMessage.Ai.Part<fdu>[],
                    public raw: Anthropic.ContentBlock[],
                ) {
                    super(parts);
                }
            }
        }
    }


    export class Instance<in out fdm extends Function.Declaration.Map> implements AnthropicCompatibleEngine.Underhood<fdm> {
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

        public anthropic: Anthropic;
        public parallelToolCall: boolean;

        public constructor(options: AnthropicCompatibleEngine.Options<fdm>) {
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

            ({
                parallel: this.parallelToolCall,
                anthropic: this.anthropic,
            } = (AnthropicEngine.OwnProps.init<fdm>).call(this, options));
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


        public convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Anthropic.ToolUseBlock {
            return (AnthropicEngine.convertFromFunctionCall<fdm>).call(this, fc);
        }
        public convertToFunctionCall(apifc: Anthropic.ToolUseBlock): Function.Call.Distributive<Function.Declaration.From<fdm>> {
            return (AnthropicEngine.convertToFunctionCall<fdm>).call(this, apifc);
        }
        public convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): Anthropic.ToolResultBlockParam {
            return (AnthropicEngine.convertFromFunctionResponse<fdm>).call(this, fr);
        }
        public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Anthropic.Tool {
            return (AnthropicEngine.convertFromFunctionDeclarationEntry<fdm>).call(this, fdentry);
        }
        public convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>, parallel: boolean): Anthropic.ToolChoice {
            return (AnthropicEngine.convertFromToolChoice<fdm>).call(this, toolChoice, parallel);
        }
        public calcCost(usage: Anthropic.Usage): number {
            return (AnthropicEngine.calcCost<fdm>).call(this, usage);
        }


        public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Anthropic.ContentBlockParam[] {
            return (AnthropicCompatibleEngine.convertFromUserMessage<fdm>).call(this, userMessage);
        }
        public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Anthropic.ContentBlockParam[] {
            return (AnthropicCompatibleEngine.convertFromAiMessage<fdm>).call(this, aiMessage);
        }
        public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Anthropic.TextBlockParam[] {
            return (AnthropicCompatibleEngine.convertFromDeveloperMessage).call(this, developerMessage);
        }
        public convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): Anthropic.MessageParam {
            return (AnthropicCompatibleEngine.convertFromChatMessage<fdm>).call(this, chatMessage);
        }
        public makeParams(session: Session<Function.Declaration.From<fdm>>): Anthropic.MessageCreateParamsStreaming {
            return (AnthropicCompatibleEngine.makeParams<fdm>).call(this, session);
        }
        public convertToAiMessage(raw: Anthropic.ContentBlock[]): AnthropicCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
            return (AnthropicCompatibleEngine.convertToAiMessage<fdm>).call(this, raw);
        }
        public fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
            return (AnthropicCompatibleEngine.fetch<fdm>).call(this, ctx, session, signal);
        }

    }

    export function create<fdm extends Function.Declaration.Map>(options: AnthropicCompatibleEngine.Options<fdm>): CompatibleEngine<fdm> {
        return new AnthropicCompatibleEngine.Instance<fdm>(options);
    }

}
