import { Function } from '../function.ts';
import { OpenAIChatCompletionsEngine } from '../api-types/openai-chat-completions.ts';
import { OpenAIChatCompletionsCompatibleEngine } from './openai-chatcompletions.ts';
import { CompatibleEngine } from '../compatible-engine.ts';
import { OpenAIChatCompletionsCompatibleStreamEngine } from './openai-chatcompletions.d/stream.ts';
import { type InferenceContext } from '../inference-context.ts';
import { type Session, RoleMessage } from '../session.ts';
import * as Undici from 'undici';
import { Throttle } from '../throttle.ts';
import { Engine } from '../engine.ts';
import OpenAI from 'openai';



export namespace AliyunEngine {
    export interface Options<fdm extends Function.Declaration.Map> extends
        OpenAIChatCompletionsCompatibleStreamEngine.Options<fdm> {}

    export interface ChatCompletionChunkChoiceDelta extends OpenAI.ChatCompletionChunk.Choice.Delta {
        reasoning_content?: string;
    }

    export interface Underhood<in out fdm extends Function.Declaration.Map> extends
        OpenAIChatCompletionsCompatibleStreamEngine.Underhood<fdm>
    {
        getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string;
    }

    export function getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
        return (delta as AliyunEngine.ChatCompletionChunkChoiceDelta).reasoning_content ?? '';
    }

    export class Instance<in out fdm extends Function.Declaration.Map> implements AliyunEngine.Underhood<fdm> {
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

        public client: OpenAI;

        public constructor(options: AliyunEngine.Options<fdm>) {
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

            ({ parallel: this.parallelToolCall } = (OpenAIChatCompletionsEngine.OwnProps.init<fdm>).call(this, options));

            this.client = new OpenAI({
                baseURL: this.baseUrl,
                apiKey: this.apiKey,
                fetchOptions: {
                    dispatcher: this.proxyAgent,
                },
            });
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

        public convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionMessageToolCall {
            return (OpenAIChatCompletionsEngine.convertFromFunctionCall<fdm>).call(this, fc);
        }
        public convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionToolMessageParam {
            return (OpenAIChatCompletionsEngine.convertFromFunctionResponse<fdm>).call(this, fr);
        }
        public convertFromToolChoice(mode: Function.ToolChoice<fdm>): OpenAI.ChatCompletionToolChoiceOption {
            return (OpenAIChatCompletionsEngine.convertFromToolChoice<fdm>).call(this, mode);
        }
        public convertToFunctionCall(apifc: OpenAI.ChatCompletionMessageFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
            return (OpenAIChatCompletionsEngine.convertToFunctionCall<fdm>).call(this, apifc);
        }
        public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.ChatCompletionTool {
            return (OpenAIChatCompletionsEngine.convertFromFunctionDeclarationEntry<fdm>).call(this, fdentry);
        }
        public calcCost(usage: OpenAI.CompletionUsage): number {
            return (OpenAIChatCompletionsEngine.calcCost<fdm>).call(this, usage);
        }
        public extractContent(completionContent: string): string {
            return (OpenAIChatCompletionsEngine.extractContent).call(this, completionContent);
        }
        public handleFinishReason(completion: OpenAI.ChatCompletion, finishReason: OpenAI.ChatCompletion.Choice['finish_reason']): void {
            return (OpenAIChatCompletionsEngine.handleFinishReason).call(this, completion, finishReason);
        }


        public fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal) {
            return (OpenAIChatCompletionsCompatibleEngine.fetch<fdm>).call(this, ctx, session, signal);
        }
        public convertToAiMessage(message: OpenAI.ChatCompletionMessage): RoleMessage.Ai<Function.Declaration.From<fdm>> {
            return (OpenAIChatCompletionsCompatibleEngine.convertToAiMessage<fdm>).call(this, message);
        }
        public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionAssistantMessageParam {
            return (OpenAIChatCompletionsCompatibleEngine.convertFromAiMessage<fdm>).call(this, aiMessage);
        }
        public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): OpenAI.ChatCompletionSystemMessageParam {
            return (OpenAIChatCompletionsCompatibleEngine.convertFromDeveloperMessage).call(this, developerMessage);
        }
        public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): [OpenAI.ChatCompletionUserMessageParam] | OpenAI.ChatCompletionToolMessageParam[] {
            return (OpenAIChatCompletionsCompatibleEngine.convertFromUserMessage<fdm>).call(this, userMessage);
        }
        public convertFromRoleMessage(roleMessage: RoleMessage): OpenAI.ChatCompletionMessageParam[] {
            return (OpenAIChatCompletionsCompatibleEngine.convertFromRoleMessage<fdm>).call(this, roleMessage);
        }
        public validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void {
            return (OpenAIChatCompletionsCompatibleEngine.validateToolCallsByToolChoice<fdm>).call(this, toolCalls);
        }


        public makeParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsStreaming {
            return (OpenAIChatCompletionsCompatibleStreamEngine.makeParams<fdm>).call(this, session);
        }
        public convertToFunctionCallFromDelta(apifc: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
            return (OpenAIChatCompletionsCompatibleStreamEngine.convertToFunctionCallFromDelta<fdm>).call(this, apifc);
        }
        public convertCompletionStockToCompletion(stock: OpenAI.ChatCompletionChunk): OpenAI.ChatCompletion {
            return (OpenAIChatCompletionsCompatibleStreamEngine.convertCompletionStockToCompletion).call(this, stock);
        }
        public fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
            return (OpenAIChatCompletionsCompatibleStreamEngine.fetchRaw<fdm>).call(this, ctx, session, signal);
        }


        public getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
            return (AliyunEngine.getDeltaThoughts).call(this, delta);
        }
    }


    export function create<fdm extends Function.Declaration.Map>(options: CompatibleEngine.Options<fdm>): CompatibleEngine<fdm> {
        return new AliyunEngine.Instance<fdm>(options);
    }
}
