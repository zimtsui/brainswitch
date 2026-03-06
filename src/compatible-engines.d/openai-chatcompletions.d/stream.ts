import { RoleMessage, type Session } from '../../session.ts';
import { Function } from '../../function.ts';
import type OpenAI from 'openai';
import { OpenAIChatCompletionsCompatibleEngine } from '../openai-chatcompletions.ts';
import { type InferenceContext } from '../../inference-context.ts';
import { ResponseInvalid } from '../../engine.ts';



export namespace OpenAIChatCompletionsCompatibleStreamEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends
        OpenAIChatCompletionsCompatibleEngine.Options<fdm> {}


    export interface Underhood<in out fdm extends Function.Declaration.Map> extends
        OpenAIChatCompletionsCompatibleEngine.Underhood<fdm>
    {
        client: OpenAI;
        makeParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsStreaming;
        convertToFunctionCallFromDelta(apifc: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>>;
        convertCompletionStockToCompletion(stock: OpenAI.ChatCompletionChunk): OpenAI.ChatCompletion;
        fetchRaw(wfctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string | null;
    }

    export function makeParams<fdm extends Function.Declaration.Map>(
        this: OpenAIChatCompletionsCompatibleEngine.Underhood<fdm>,
        session: Session<Function.Declaration.From<fdm>>,
    ): OpenAI.ChatCompletionCreateParamsStreaming {
        const fdentries = Object.entries(this.fdm) as Function.Declaration.Entry.From<fdm>[];
        const tools = fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry));
        return {
            model: this.model,
            messages: [
                ...(session.developerMessage ? this.convertFromRoleMessage(session.developerMessage) : []),
                ...session.chatMessages.flatMap(chatMessage => this.convertFromRoleMessage(chatMessage)),
            ],
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? this.convertFromToolChoice(this.toolChoice) : undefined,
            parallel_tool_calls: tools.length ? this.parallelToolCall : undefined,
            stream: true,
            stream_options: {
                include_usage: true
            },
            max_completion_tokens: this.maxTokens ?? undefined,
            ...this.additionalOptions,
        };
    }

    export function convertToFunctionCallFromDelta<fdm extends Function.Declaration.Map>(
        this: OpenAIChatCompletionsCompatibleEngine.Underhood<fdm>,
        apifc: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall,
    ): Function.Call.Distributive<Function.Declaration.From<fdm>> {
        if (apifc.id) {} else throw new Error();
        if (apifc.function?.name) {} else throw new Error();
        if (apifc.function?.arguments) {} else throw new Error();
        return this.convertToFunctionCall(apifc as OpenAI.ChatCompletionMessageFunctionToolCall);
    }

    export function convertCompletionStockToCompletion(
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

    export async function fetchRaw<fdm extends Function.Declaration.Map>(
        this: OpenAIChatCompletionsCompatibleStreamEngine.Underhood<fdm>,
        wfctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        const params = this.makeParams(session);
        this.logger.message?.trace(params);

        await this.throttle.requests(wfctx);

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
                        this.logger.inference?.trace('<think>\n');
                    }
                    this.logger.inference?.trace(deltaThoughts);
                    thoughts ??= '';
                    thoughts += deltaThoughts;
                }

                // content
                if (deltaChoice.delta.content) {
                    if (thinking) {
                        thinking = false;
                        this.logger.inference?.trace('\n</think>\n');
                    }
                    this.logger.inference?.debug(deltaChoice.delta.content);
                    stock.choices[0]!.delta.content ??= '';
                    stock.choices[0]!.delta.content! += deltaChoice.delta.content;
                }

                // function calls
                if (deltaChoice.delta.tool_calls) {
                    if (thinking) {
                        thinking = false;
                        this.logger.inference?.trace('\n</think>\n');
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
        if (choice.message.content) this.logger.inference?.debug('\n');

        this.handleFinishReason(completion, choice.finish_reason);

        if (completion.usage) {} else throw new Error();
        const cost = this.calcCost(completion.usage);
        wfctx.cost?.(cost);

        const aiMessage = this.convertToAiMessage(choice.message);

        // logging
        const apifcs = choice.message.tool_calls;
        if (apifcs?.length) this.logger.message?.debug(apifcs);
        this.logger.message?.debug(completion.usage);

        this.validateToolCallsByToolChoice(aiMessage.getFunctionCalls());

        return aiMessage;
    }
}
