import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import OpenAI from 'openai';
import { OpenAIChatCompletionsCompatibleTransport } from '#@/compatible.d/openai-chatcompletions/transport.ts';
import { type InferenceContext } from '#@/inference-context.ts';
import { ResponseInvalid, type InferenceParams, type ProviderSpec } from '#@/engine.ts';
import { logger } from '#@/telemetry.ts';
import type { ToolCallValidator } from '#@/compatible/tool-call-validator.ts';
import type { OpenAIChatCompletionsBilling } from '#@/api-types/openai-chatcompletion/billing.ts';
import type { OpenAIChatCompletionsToolCodec } from '#@/api-types/openai-chatcompletion/tool-codec.ts';
import { Throttle } from '#@/throttle.ts';
import * as Undici from 'undici';
import { type OpenAIChatCompletionsCompatibleMessageCodec } from '#@/compatible.d/openai-chatcompletions/message-codec.ts';



export abstract class OpenAIChatCompletionsCompatibleStream<in out fdm extends Function.Declaration.Map> extends
    OpenAIChatCompletionsCompatibleTransport<fdm>
{
    protected client: OpenAI;
    public constructor(protected ctx: OpenAIChatCompletionsCompatibleStream.Context<fdm>) {
        super();
        this.client = new OpenAI({
            baseURL: this.ctx.providerSpec.baseUrl,
            apiKey: this.ctx.providerSpec.apiKey,
            fetchOptions: {
                dispatcher: this.ctx.providerSpec.proxyAgent,
            },
        })
    }

    protected makeParams(
        session: Session<fdm>,
    ): OpenAI.ChatCompletionCreateParamsStreaming {
        const tools = this.ctx.toolCodec.convertFromFunctionDeclarationMap(this.ctx.fdm);
        return {
            model: this.ctx.inferenceParams.model,
            messages: [
                ...(session.developerMessage ? this.ctx.messageCodec.convertFromRoleMessage(session.developerMessage) : []),
                ...this.ctx.messageCodec.convertFromChatMessages(session.chatMessages),
            ],
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? this.ctx.toolCodec.convertFromToolChoice(this.ctx.toolChoice) : undefined,
            parallel_tool_calls: tools.length ? this.ctx.parallelToolCall : undefined,
            stream: true,
            stream_options: {
                include_usage: true
            },
            max_completion_tokens: this.ctx.inferenceParams.maxTokens ?? undefined,
            ...this.ctx.inferenceParams.additionalOptions,
        };
    }

    public convertToFunctionCallFromDelta(
        apifc: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall,
    ): Function.Call.From<fdm> {
        if (apifc.id) {} else throw new Error();
        if (apifc.function?.name) {} else throw new Error();
        if (apifc.function?.arguments) {} else throw new Error();
        return this.ctx.toolCodec.convertToFunctionCall(apifc as OpenAI.ChatCompletionMessageFunctionToolCall);
    }

    public convertCompletionStockToCompletion(
        stock: OpenAI.ChatCompletionChunk,
    ): OpenAI.ChatCompletion {
        const stockChoice = stock?.choices[0];
        if (stockChoice?.finish_reason) {} else throw new ResponseInvalid('Finish reason missing', { cause: stock });

        const completion: OpenAI.ChatCompletion = {
            id: stock.id,
            object: 'chat.completion',
            created: stock.created,
            model: stock.model,
            choices: [{
                index: 0,
                finish_reason: stockChoice.finish_reason,
                message: {
                    role: 'assistant',
                    content: stockChoice.delta.content ?? null,
                    tool_calls: stockChoice.delta.tool_calls?.map(
                        apifc => {
                            if (apifc.id) {} else throw new Error();
                            if (apifc.function?.name) {} else throw new Error();
                            if (apifc.function?.arguments) {} else throw new Error();
                            return {
                                id: apifc.id,
                                function: {
                                    name: apifc.function.name,
                                    arguments: apifc.function.arguments,
                                },
                                type: 'function',
                            };
                        },
                    ),
                    refusal: stockChoice.delta.refusal ?? null,
                },
                logprobs: stockChoice.logprobs ?? null,
            }],
            usage: stock.usage ?? undefined,
        };
        return completion;
    }

    public async fetchRaw(
        wfctx: InferenceContext, session: Session<fdm>, signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<fdm>> {
        const params = this.makeParams(session);
        logger.message.trace(params);

        await this.ctx.throttle.requests(wfctx);

        const stream = await this.client.chat.completions.create(params, { signal });
        let stock: OpenAI.ChatCompletionChunk | null = null;
        let thoughts: string | null = null, thinking = false;

        for await (const chunk of stream) {
            stock ??= {
                id: chunk.id,
                created: chunk.created,
                model: chunk.model,
                choices: [],
                object: 'chat.completion.chunk',
            };

            // choice
            const deltaChoice = chunk.choices[0];
            if (deltaChoice) {
                if (!stock.choices.length)
                    stock.choices.push({
                        index: 0,
                        finish_reason: null,
                        delta: {},
                    });

                // thoughts
                const deltaThoughts = this.getDeltaThoughts(deltaChoice.delta);
                if (deltaThoughts) {
                    if (!thinking) {
                        thinking = true;
                        logger.inference.trace('<think>\n');
                    }
                    logger.inference.trace(deltaThoughts);
                    thoughts ??= '';
                    thoughts += deltaThoughts;
                }

                // content
                if (deltaChoice.delta.content) {
                    if (thinking) {
                        thinking = false;
                        logger.inference.trace('\n</think>\n');
                    }
                    logger.inference.debug(deltaChoice.delta.content);
                    stock.choices[0]!.delta.content ??= '';
                    stock.choices[0]!.delta.content! += deltaChoice.delta.content;
                }

                // function calls
                if (deltaChoice.delta.tool_calls) {
                    if (thinking) {
                        thinking = false;
                        logger.inference.trace('\n</think>\n');
                    }
                    stock.choices[0]!.delta.tool_calls ??= [];
                    for (const deltaToolCall of deltaChoice.delta.tool_calls) {
                        const toolCalls = stock.choices[0]!.delta.tool_calls!;
                        toolCalls[deltaToolCall.index] ??= { index: deltaToolCall.index };
                        toolCalls[deltaToolCall.index]!.id ??= deltaToolCall.id;
                        if (deltaToolCall.function) {
                            toolCalls[deltaToolCall.index]!.function ??= {};
                            toolCalls[deltaToolCall.index]!.function!.name ??= deltaToolCall.function.name;
                            if (deltaToolCall.function.arguments) {
                                toolCalls[deltaToolCall.index]!.function!.arguments ??= '';
                                toolCalls[deltaToolCall.index]!.function!.arguments! += deltaToolCall.function?.arguments || '';
                            }
                        }
                    }
                }

                // finish reason
                stock.choices[0]!.finish_reason ??= deltaChoice.finish_reason;
            }

            // usage
            stock.usage ??= chunk.usage;
        }

        if (stock) {} else throw new Error();
        const completion = this.convertCompletionStockToCompletion(stock);

        const choice = completion.choices[0];
        if (choice) {} else throw new ResponseInvalid('Content missing', { cause: completion });
        if (choice.message.content) logger.inference.debug('\n');

        this.handleFinishReason(completion, choice.finish_reason);

        if (completion.usage) {} else throw new Error();
        const cost = this.ctx.billing.charge(completion.usage);

        const aiMessage = this.ctx.messageCodec.convertToAiMessage(choice.message);

        const apifcs = choice.message.tool_calls;
        if (apifcs?.length) logger.message.debug(apifcs);
        logger.message.debug(completion.usage);
        wfctx.cost?.(cost);

        this.ctx.toolCallValidator.validate(aiMessage.getFunctionCalls());

        return aiMessage;
    }

    protected abstract getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string;
}

export namespace OpenAIChatCompletionsCompatibleStream {
    export interface Context<in out fdm extends Function.Declaration.Map> {
        inferenceParams: InferenceParams;
        providerSpec: ProviderSpec;
        fdm: fdm;
        throttle: Throttle;
        toolChoice: Function.ToolChoice<fdm>;
        parallelToolCall: boolean;

        messageCodec: OpenAIChatCompletionsCompatibleMessageCodec<fdm>;
        toolCodec: OpenAIChatCompletionsToolCodec<fdm>;
        billing: OpenAIChatCompletionsBilling<fdm>;
        toolCallValidator: ToolCallValidator<fdm>;
    }
}
