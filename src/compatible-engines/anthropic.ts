import { CompatibleEngine } from '../compatible-engine.ts';
import { Function } from '../function.ts';
import { RoleMessage, type ChatMessage, type Session } from '../session.ts';
import { Engine, ResponseInvalid } from '../engine.ts';
import { type InferenceContext } from '../inference-context.ts';
import Anthropic from '@anthropic-ai/sdk';
import assert from 'node:assert';
import { AnthropicEngine } from '../api-types/anthropic.ts';




export namespace AnthropicCompatibleEngine {
    export interface Base<fdm extends Function.Declaration.Map> {
        convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Anthropic.ContentBlockParam[];
        convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Anthropic.ContentBlockParam[];
        convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Anthropic.TextBlockParam[];
        convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): Anthropic.MessageParam;
        makeParams(session: Session<Function.Declaration.From<fdm>>): Anthropic.MessageCreateParamsStreaming;
        convertToAiMessage(raw: Anthropic.ContentBlock[]): AnthropicCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>;
        fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    }

    export interface Instance<fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Instance<fdm>,
        AnthropicEngine.Instance<fdm>
    {}

    export namespace Base {

        export class Constructor<in out fdm extends Function.Declaration.Map = {}> implements AnthropicCompatibleEngine.Base<fdm> {
            public constructor(protected instance: AnthropicCompatibleEngine.Instance<fdm>) {}

            public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Anthropic.ContentBlockParam[] {
                return userMessage.getParts().map(part => {
                    if (part instanceof RoleMessage.Part.Text.Constructor)
                        return {
                            type: 'text',
                            text: part.text,
                        } satisfies Anthropic.TextBlockParam;
                    else if (part instanceof Function.Response)
                        return this.instance.convertFromFunctionResponse(part);
                    else throw new Error();
                });
            }

            public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Anthropic.ContentBlockParam[] {
                if (aiMessage instanceof AnthropicCompatibleEngine.Message.Ai.Constructor)
                    return aiMessage.raw;
                else {
                    return aiMessage.getParts().map(part => {
                        if (part instanceof RoleMessage.Part.Text.Constructor)
                            return {
                                type: 'text',
                                text: part.text,
                            } satisfies Anthropic.TextBlockParam;
                        else if (part instanceof Function.Call)
                            return this.instance.convertFromFunctionCall(part);
                        else throw new Error();
                    });
                }
            }

            public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Anthropic.TextBlockParam[] {
                return developerMessage.getParts().map(part => ({ type: 'text', text: part.text}));
            }

            public convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): Anthropic.MessageParam {
                if (chatMessage instanceof RoleMessage.User.Constructor)
                    return { role: 'user', content: this.convertFromUserMessage(chatMessage) };
                else if (chatMessage instanceof RoleMessage.Ai.Constructor)
                    return { role: 'assistant', content: this.convertFromAiMessage(chatMessage) };
                else throw new Error();
            }

            public makeParams(session: Session<Function.Declaration.From<fdm>>): Anthropic.MessageCreateParamsStreaming {
                const fdentries = Object.entries(this.instance.fdm) as Function.Declaration.Entry.From<fdm>[];
                const tools = fdentries.map(fdentry => this.instance.convertFromFunctionDeclarationEntry(fdentry));
                return {
                    model: this.instance.model,
                    stream: true,
                    messages: session.chatMessages.map(chatMessage => this.convertFromChatMessage(chatMessage)),
                    system: session.developerMessage && this.convertFromDeveloperMessage(session.developerMessage),
                    tools: tools.length ? tools : undefined,
                    max_tokens: this.instance.maxTokens ?? 64 * 1024,
                    ...this.instance.additionalOptions,
                };
            }

            public convertToAiMessage(raw: Anthropic.ContentBlock[]): AnthropicCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
                const parts = raw.flatMap((item): RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] => {
                    if (item.type === 'text') {
                        return [RoleMessage.Part.Text.create(item.text)];
                    } else if (item.type === 'tool_use')
                        return [this.instance.convertToFunctionCall(item)];
                    else if (item.type === 'thinking')
                        return [];
                    else throw new Error();
                });
                return AnthropicCompatibleEngine.Message.Ai.create(parts, raw);
            }

            public async fetch(
                ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal,
            ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
                const params = this.makeParams(session);
                ctx.logger.message?.trace(params);

                await this.instance.throttle.requests(ctx);
                const stream = this.instance.anthropic.messages.stream(params, { signal });

                let response: Anthropic.Message | null = null;
                for await (const event of stream) {
                    if (event.type === 'message_start') {
                        ctx.logger.message?.trace(event);
                        response = structuredClone(event.message);
                    } else {
                        assert(response);
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
                                assert(contentBlock?.type === 'text');
                                contentBlock.text += event.delta.text;
                            } else if (event.delta.type === 'thinking_delta') {
                                ctx.logger.inference?.trace(event.delta.thinking);
                                assert(contentBlock?.type === 'thinking');
                                contentBlock.thinking += event.delta.thinking;
                            } else if (event.delta.type === 'signature_delta') {
                                assert(contentBlock?.type === 'thinking');
                                contentBlock.signature += event.delta.signature;
                            } else if (event.delta.type === 'input_json_delta') {
                                ctx.logger.inference?.trace(event.delta.partial_json);
                                assert(contentBlock?.type === 'tool_use');
                                assert(typeof contentBlock.input === 'string');
                                contentBlock.input += event.delta.partial_json;
                            } else throw new Error('Unknown type of content block delta', { cause: event.delta });
                        } else if (event.type === 'content_block_stop') {
                            const contentBlock = response.content[event.index];
                            if (contentBlock?.type === 'text') ctx.logger.inference?.debug('\n');
                            else if (contentBlock?.type === 'thinking') ctx.logger.inference?.trace('\n');
                            else if (contentBlock?.type === 'tool_use') ctx.logger.inference?.debug('\n');
                            ctx.logger.message?.trace(event);
                            if (contentBlock?.type === 'tool_use') {
                                assert(typeof contentBlock.input === 'string');
                                ctx.logger.message?.debug(contentBlock);
                            }
                        } else throw new Error('Unknown stream event', { cause: event });
                    }
                }
                assert(response);
                if (response.stop_reason === 'max_tokens')
                    throw new ResponseInvalid('Token limit exceeded.', { cause: response });
                assert(
                    response.stop_reason === 'end_turn' || response.stop_reason === 'tool_use',
                    new ResponseInvalid('Abnormal stop reason', { cause: response }),
                );

                const cost = this.instance.calcCost(response.usage);
                ctx.logger.cost?.(cost);
                ctx.logger.message?.debug(response.usage);

                const aiMessage = this.convertToAiMessage(response.content);
                this.instance.validateToolCallsByToolChoice(aiMessage.getFunctionCalls());

                return aiMessage;
            }
        }
    }

    export namespace Message {
        export type Ai<fdu extends Function.Declaration> = Ai.Constructor<fdu>;
        export namespace Ai {
            export function create<fdu extends Function.Declaration>(
                parts: RoleMessage.Ai.Part<fdu>[],
                raw: Anthropic.ContentBlock[],
            ): Ai<fdu> {
                return new Constructor(parts, raw);
            }
            export const NOMINAL = Symbol();
            export class Constructor<out fdu extends Function.Declaration> extends RoleMessage.Ai.Constructor<fdu> {
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


    export class Constructor<in out fdm extends Function.Declaration.Map> implements AnthropicCompatibleEngine.Instance<fdm> {
        protected engineBase: Engine.Base<fdm>;
        protected compatibleEngineBase: CompatibleEngine.Base<fdm>;
        protected anthropicEngineBase: AnthropicEngine.Base<fdm>;
        protected anthropicCompatibleEngineBase: AnthropicCompatibleEngine.Base<fdm>;

        public constructor(options: AnthropicCompatibleEngine.Options<fdm>) {
            this.engineBase = new Engine.Base.Constructor<fdm>(this, options);
            this.compatibleEngineBase = new CompatibleEngine.Base.Constructor<fdm>(this, options);
            this.anthropicEngineBase = new AnthropicEngine.Base.Constructor<fdm>(this, options);
            this.anthropicCompatibleEngineBase = new AnthropicCompatibleEngine.Base.Constructor<fdm>(this);
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


        public get anthropic(): Anthropic {
            return this.anthropicEngineBase.anthropic;
        }
        public set anthropic(value: Anthropic) {
            this.anthropicEngineBase.anthropic = value;
        }
        public get parallel(): boolean {
            return this.anthropicEngineBase.parallel;
        }
        public set parallel(value: boolean) {
            this.anthropicEngineBase.parallel = value;
        }
        public convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Anthropic.ToolUseBlock {
            return this.anthropicEngineBase.convertFromFunctionCall(fc);
        }
        public convertToFunctionCall(apifc: Anthropic.ToolUseBlock): Function.Call.Distributive<Function.Declaration.From<fdm>> {
            return this.anthropicEngineBase.convertToFunctionCall(apifc);
        }
        public convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): Anthropic.ToolResultBlockParam {
            return this.anthropicEngineBase.convertFromFunctionResponse(fr);
        }
        public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Anthropic.Tool {
            return this.anthropicEngineBase.convertFromFunctionDeclarationEntry(fdentry);
        }
        public convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>, parallel: boolean): Anthropic.ToolChoice {
            return this.anthropicEngineBase.convertFromToolChoice(toolChoice, parallel);
        }
        public calcCost(usage: Anthropic.Usage): number {
            return this.anthropicEngineBase.calcCost(usage);
        }


        public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): Anthropic.ContentBlockParam[] {
            return this.anthropicCompatibleEngineBase.convertFromUserMessage(userMessage);
        }
        public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): Anthropic.ContentBlockParam[] {
            return this.anthropicCompatibleEngineBase.convertFromAiMessage(aiMessage);
        }
        public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): Anthropic.TextBlockParam[] {
            return this.anthropicCompatibleEngineBase.convertFromDeveloperMessage(developerMessage);
        }
        public convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): Anthropic.MessageParam {
            return this.anthropicCompatibleEngineBase.convertFromChatMessage(chatMessage);
        }
        public makeParams(session: Session<Function.Declaration.From<fdm>>): Anthropic.MessageCreateParamsStreaming {
            return this.anthropicCompatibleEngineBase.makeParams(session);
        }
        public convertToAiMessage(raw: Anthropic.ContentBlock[]): AnthropicCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
            return this.anthropicCompatibleEngineBase.convertToAiMessage(raw);
        }
        public fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
            return this.anthropicCompatibleEngineBase.fetch(ctx, session, signal);
        }

    }

    export function create<fdm extends Function.Declaration.Map>(options: AnthropicCompatibleEngine.Options<fdm>): CompatibleEngine<fdm> {
        return new AnthropicCompatibleEngine.Constructor<fdm>(options);
    }

    export interface Options<fdm extends Function.Declaration.Map> extends CompatibleEngine.Options<fdm> {}
}
