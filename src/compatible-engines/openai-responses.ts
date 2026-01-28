import { CompatibleEngine } from '../compatible-engine.ts';
import { Function } from '../function.ts';
import { RoleMessage, type ChatMessage, type Session } from '../session.ts';
import { ResponseInvalid, Engine } from '../engine.ts';
import { type InferenceContext } from '../inference-context.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { fetch } from 'undici';
import { OpenAIResponsesEngine } from '../api-types/openai-responses-engine.ts';



export namespace OpenAIResponsesCompatibleEngine {

    export interface Base<in out fdm extends Function.Declaration.Map> {
        parallel: boolean;
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
    export interface Instance<in out fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Instance<fdm>,
        OpenAIResponsesEngine.Instance<fdm>,
        OpenAIResponsesCompatibleEngine.Base<fdm>
    {}

    export namespace Base {
        export class Constructor<in out fdm extends Function.Declaration.Map> implements OpenAIResponsesCompatibleEngine.Base<fdm> {
            protected apiURL: URL;
            public parallel: boolean;

            public constructor(
                protected instance: OpenAIResponsesCompatibleEngine.Instance<fdm>,
                options: OpenAIResponsesCompatibleEngine.Options<fdm>,
            ) {
                this.apiURL = new URL(`${this.instance.baseUrl}/responses`);
                this.parallel = options.parallelToolCall ?? false;
            }

            public convertToAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): OpenAIResponsesCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
                const parts = output.flatMap((item): RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] => {
                    if (item.type === 'message') {
                        assert(item.content.every(part => part.type === 'output_text'));
                        return [RoleMessage.Part.Text.create(item.content.map(part => part.text).join(''))];
                    } else if (item.type === 'function_call')
                        return [this.instance.convertToFunctionCall(item)];
                    else if (item.type === 'reasoning')
                        return [];
                    else throw new Error();
                });
                return OpenAIResponsesCompatibleEngine.Message.Ai.create(parts, output);
            }

            public convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseFunctionToolCall {
                assert(fc.id);
                return {
                    type: 'function_call',
                    call_id: fc.id,
                    name: fc.name,
                    arguments: JSON.stringify(fc.args),
                };
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
                    else throw new Error();
                });
            }

            public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
                if (aiMessage instanceof OpenAIResponsesCompatibleEngine.Message.Ai.Constructor)
                    return aiMessage.getRaw();
                else {
                    return aiMessage.getParts().map(part => {
                        if (part instanceof RoleMessage.Part.Text.Constructor)
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

            public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): string {
                return developerMessage.getOnlyText();
            }

            public convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
                if (chatMessage instanceof RoleMessage.User.Constructor)
                    return this.convertFromUserMessage(chatMessage);
                else if (chatMessage instanceof RoleMessage.Ai.Constructor)
                    return this.convertFromAiMessage(chatMessage);
                else throw new Error();
            }


            public convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
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

            public makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseCreateParamsNonStreaming {
                const fdentries = Object.entries(this.instance.fdm) as Function.Declaration.Entry.From<fdm>[];
                const tools: OpenAI.Responses.Tool[] = fdentries.map(fdentry => this.instance.convertFromFunctionDeclarationEntry(fdentry));
                return {
                    model: this.instance.model,
                    include: ['reasoning.encrypted_content'],
                    store: false,
                    input: session.chatMessages.flatMap(chatMessage => this.convertFromChatMessage(chatMessage)),
                    instructions: session.developerMessage && this.convertFromDeveloperMessage(session.developerMessage),
                    tools: tools.length ? tools : undefined,
                    tool_choice: tools.length ? this.convertFromToolChoice(this.instance.toolChoice) : undefined,
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
            }

            public async fetch(
                ctx: InferenceContext,
                session: Session<Function.Declaration.From<fdm>>,
                signal?: AbortSignal,
            ): Promise<OpenAIResponsesCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>> {
                return await this.fetchRaw(ctx, session, signal).catch(e => Promise.reject(e instanceof OpenAI.APIError ? new ResponseInvalid(undefined, { cause: e }) : e));
            }

            public async fetchRaw(
                ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal,
            ): Promise<OpenAIResponsesCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>> {
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
                this.instance.validateToolCallsByToolChoice(aiMessage.getFunctionCalls());

                return aiMessage;
            }

        }
    }


    export class Constructor<in out fdm extends Function.Declaration.Map> implements OpenAIResponsesCompatibleEngine.Instance<fdm> {
        protected engineBase: Engine.Base<fdm>;
        protected compatibleEngineBase: CompatibleEngine.Base<fdm>;
        protected openAIResponsesEngineBase: OpenAIResponsesEngine.Base<fdm>;
        protected openAIResponsesCompatibleEngineBase: OpenAIResponsesCompatibleEngine.Base<fdm>;

        public constructor(options: OpenAIResponsesCompatibleEngine.Options<fdm>) {
            this.engineBase = new Engine.Base.Constructor<fdm>(this, options);
            this.compatibleEngineBase = new CompatibleEngine.Base.Constructor<fdm>(this, options);
            this.openAIResponsesEngineBase = new OpenAIResponsesEngine.Base.Constructor<fdm>(this);
            this.openAIResponsesCompatibleEngineBase = new OpenAIResponsesCompatibleEngine.Base.Constructor<fdm>(this, options);
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


        public get parallel(): boolean {
            return this.openAIResponsesCompatibleEngineBase.parallel;
        }
        public set parallel(value: boolean) {
            this.openAIResponsesCompatibleEngineBase.parallel = value;
        }
        public convertToAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): OpenAIResponsesCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>> {
            return this.openAIResponsesCompatibleEngineBase.convertToAiMessage(output);
        }
        public convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseFunctionToolCall {
            return this.openAIResponsesCompatibleEngineBase.convertFromFunctionCall(fc);
        }
        public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            return this.openAIResponsesCompatibleEngineBase.convertFromUserMessage(userMessage);
        }
        public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            return this.openAIResponsesCompatibleEngineBase.convertFromAiMessage(aiMessage);
        }
        public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): string {
            return this.openAIResponsesCompatibleEngineBase.convertFromDeveloperMessage(developerMessage);
        }
        public convertFromChatMessage(chatMessage: ChatMessage<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInput {
            return this.openAIResponsesCompatibleEngineBase.convertFromChatMessage(chatMessage);
        }
        public convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
            return this.openAIResponsesCompatibleEngineBase.convertFromToolChoice(toolChoice);
        }
        public makeMonolithParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseCreateParamsNonStreaming {
            return this.openAIResponsesCompatibleEngineBase.makeMonolithParams(session);
        }
        public logAiMessage(ctx: InferenceContext, output: OpenAI.Responses.ResponseOutputItem[]): void {
            return this.openAIResponsesCompatibleEngineBase.logAiMessage(ctx, output);
        }
        public fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal) {
            return this.openAIResponsesCompatibleEngineBase.fetch(ctx, session, signal);
        }
        public fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<OpenAIResponsesCompatibleEngine.Message.Ai<Function.Declaration.From<fdm>>> {
            return this.openAIResponsesCompatibleEngineBase.fetchRaw(ctx, session, signal);
        }
    }


    export interface Options<fdm extends Function.Declaration.Map> extends CompatibleEngine.Options<fdm> {}

    export function create<fdm extends Function.Declaration.Map>(
        options: OpenAIResponsesCompatibleEngine.Options<fdm>,
    ): CompatibleEngine<fdm> {
        return new OpenAIResponsesCompatibleEngine.Constructor<fdm>(options);
    }

    export namespace Message {
        export type Ai<fdu extends Function.Declaration> = Ai.Constructor<fdu>;
        export namespace Ai {
            export function create<fdu extends Function.Declaration>(
                parts: RoleMessage.Ai.Part<fdu>[],
                raw: OpenAI.Responses.ResponseOutputItem[],
            ): Ai<fdu> {
                return new Constructor(parts, raw);
            }
            export const NOMINAL = Symbol();
            export class Constructor<out fdu extends Function.Declaration> extends RoleMessage.Ai.Constructor<fdu> {
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
