import { RoleMessage, type Session } from '../../session.ts';
import { Function } from '../../function.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { OpenAIChatCompletionsCompatibleEngine } from '../openai-chatcompletions.ts';
import { type InferenceContext } from '../../inference-context.ts';
import { ResponseInvalid } from '../../engine.ts';



export namespace OpenAIChatCompletionsCompatibleStreamEngine {

    export interface Base<in out fdm extends Function.Declaration.Map> {
        makeParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsStreaming;
        convertToFunctionCallFromDelta(apifc: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>>;
        convertCompletionStockToCompletion(stock: OpenAI.ChatCompletionChunk): OpenAI.ChatCompletion;
        fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    }

    export interface Instance<in out fdm extends Function.Declaration.Map> extends
        OpenAIChatCompletionsCompatibleEngine.Instance<fdm>,
        OpenAIChatCompletionsCompatibleStreamEngine.Base<fdm>
    {
        getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string | null;
    }

    export namespace Base {
        export class Instance<in out fdm extends Function.Declaration.Map> implements OpenAIChatCompletionsCompatibleStreamEngine.Base<fdm> {
            protected client: OpenAI;

            public constructor(protected instance: OpenAIChatCompletionsCompatibleStreamEngine.Instance<fdm>) {
                this.client = new OpenAI({
                    baseURL: this.instance.baseUrl,
                    apiKey: this.instance.apiKey,
                    fetchOptions: {
                        dispatcher: this.instance.proxyAgent,
                    },
                });
            }

            public makeParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsStreaming {
                const fdentries = Object.entries(this.instance.fdm) as Function.Declaration.Entry.From<fdm>[];
                const tools = fdentries.map(fdentry => this.instance.convertFromFunctionDeclarationEntry(fdentry));
                return {
                    model: this.instance.model,
                    messages: [
                        ...(session.developerMessage ? this.instance.convertFromRoleMessage(session.developerMessage) : []),
                        ...session.chatMessages.flatMap(chatMessage => this.instance.convertFromRoleMessage(chatMessage)),
                    ],
                    tools: tools.length ? tools : undefined,
                    tool_choice: tools.length ? this.instance.convertFromToolChoice(this.instance.toolChoice) : undefined,
                    parallel_tool_calls: tools.length ? this.instance.parallel : undefined,
                    stream: true,
                    stream_options: {
                        include_usage: true
                    },
                    max_completion_tokens: this.instance.maxTokens ?? undefined,
                    ...this.instance.additionalOptions,
                };
            }

            public convertToFunctionCallFromDelta(apifc: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
                assert(apifc.id);
                assert(apifc.function?.name);
                assert(apifc.function?.arguments);
                return this.instance.convertToFunctionCall(apifc as OpenAI.ChatCompletionMessageFunctionToolCall);
            }

            public convertCompletionStockToCompletion(stock: OpenAI.ChatCompletionChunk): OpenAI.ChatCompletion {
                const stockChoice = stock?.choices[0];
                assert(stockChoice?.finish_reason, new ResponseInvalid('Finish reason missing', { cause: stock }));

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
                                    assert(apifc.id !== undefined);
                                    assert(apifc.function?.name !== undefined);
                                    assert(apifc.function?.arguments !== undefined);
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
                ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal,
            ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
                const params = this.makeParams(session);
                ctx.logger.message?.trace(params);

                await this.instance.throttle.requests(ctx);

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
                        const deltaThoughts = this.instance.getDeltaThoughts(deltaChoice.delta);
                        if (deltaThoughts) {
                            if (!thinking) {
                                thinking = true;
                                ctx.logger.inference?.trace('<think>\n');
                            }
                            ctx.logger.inference?.trace(deltaThoughts);
                            thoughts ??= '';
                            thoughts += deltaThoughts;
                        }

                        // content
                        if (deltaChoice.delta.content) {
                            if (thinking) {
                                thinking = false;
                                ctx.logger.inference?.trace('\n</think>\n');
                            }
                            ctx.logger.inference?.debug(deltaChoice.delta.content);
                            stock.choices[0]!.delta.content ??= '';
                            stock.choices[0]!.delta.content! += deltaChoice.delta.content;
                        }

                        // function calls
                        if (deltaChoice.delta.tool_calls) {
                            if (thinking) {
                                thinking = false;
                                ctx.logger.inference?.trace('\n</think>\n');
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

                assert(stock);
                const completion = this.convertCompletionStockToCompletion(stock);

                const choice = completion.choices[0];
                assert(choice, new ResponseInvalid('Content missing', { cause: completion }));
                if (choice.message.content) ctx.logger.inference?.debug('\n');

                this.instance.handleFinishReason(completion, choice.finish_reason);

                assert(completion.usage);
                const cost = this.instance.calcCost(completion.usage);
                ctx.logger.cost?.(cost);

                const aiMessage = this.instance.convertToAiMessage(choice.message);

                // logging
                const apifcs = choice.message.tool_calls;
                if (apifcs?.length) ctx.logger.message?.debug(apifcs);
                ctx.logger.message?.debug(completion.usage);

                this.instance.validateToolCallsByToolChoice(aiMessage.getFunctionCalls());

                return aiMessage;
            }
        }
    }
}
