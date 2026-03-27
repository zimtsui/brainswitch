import { RoleMessage, type Session } from '../../../compatible-engine/session.ts';
import { Function } from '../../../function.ts';
import OpenAI from 'openai';
import { Transport } from '../transport.ts';
import { type InferenceContext } from '../../../inference-context.ts';
import { ResponseInvalid, type InferenceParams, type ProviderSpec, NetworkError } from '../../../engine.ts';
import { logger } from '../../../telemetry.ts';
import type { OpenAIChatCompletionsBilling } from '../../../api-types/openai-chatcompletions/billing.ts';
import type { OpenAIChatCompletionsToolCodec } from '../../../api-types/openai-chatcompletions/tool-codec.ts';
import { Throttle } from '../../../throttle.ts';
import { type MessageCodec } from '../message-codec.ts';
import type { Verbatim } from '../../../verbatim.ts';
import { Validator } from '../../../compatible-engine/validation.ts';
import type { Structuring } from '../../../compatible-engine/structuring.ts';
import * as ChoiceCodec from '../choice-codec.ts';



export abstract class StreamTransport<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> extends Transport<fdm, vdm> {
    protected client: OpenAI;
    public constructor(protected ctx: StreamTransport.Context<fdm, vdm>) {
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
        session: Session.From<fdm, vdm>,
    ): OpenAI.ChatCompletionCreateParamsStreaming {
        const tools = this.ctx.toolCodec.encodeFunctionDeclarationMap(this.ctx.fdm);
        return {
            model: this.ctx.inferenceParams.model,
            messages: [
                ...(session.developerMessage ? this.ctx.messageCodec.encodeRoleMessage(session.developerMessage) : []),
                ...this.ctx.messageCodec.encodeRoleMessages(session.chatMessages),
            ],
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? ChoiceCodec.encode(this.ctx.choice) : undefined,
            parallel_tool_calls: tools.length ? this.ctx.parallelToolCall : undefined,
            stream: true,
            stream_options: {
                include_usage: true
            },
            max_completion_tokens: this.ctx.inferenceParams.maxTokens ?? undefined,
            ...this.ctx.inferenceParams.additionalOptions,
        };
    }

    public convertFromDeltaToolCall(
        apifc: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall,
    ) {
        if (apifc.id) {} else throw new Error();
        if (apifc.function?.name) {} else throw new Error();
        if (apifc.function?.arguments) {} else throw new Error();
        return apifc as OpenAI.ChatCompletionMessageFunctionToolCall;
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
                        apifc => this.convertFromDeltaToolCall(apifc),
                    ),
                    refusal: stockChoice.delta.refusal ?? null,
                },
                logprobs: stockChoice.logprobs ?? null,
            }],
            usage: stock.usage ?? undefined,
        };
        return completion;
    }

    public override async fetch(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>> {
        try {
            await this.ctx.throttle.requests(wfctx);

            // Prepare request
            const params = this.makeParams(session);
            logger.message.trace(params);

            // Send request
            const stream = await this.client.chat.completions.create(params, { signal });

            // Get response
            let stock: OpenAI.ChatCompletionChunk | null = null;
            try {
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
            } catch (e) {
                if (e instanceof TypeError)
                    throw new NetworkError(undefined, { cause: e });
                else throw e;
            }

            // Validate response
            if (stock) {} else throw new Error();
            const completion = this.convertCompletionStockToCompletion(stock);

            const choice = completion.choices[0];
            if (choice) {} else throw new ResponseInvalid('Content missing', { cause: completion });
            if (choice.message.content) logger.inference.debug('\n');

            this.handleFinishReason(completion, choice.finish_reason);

            if (completion.usage) {} else throw new Error();
            const cost = this.ctx.billing.charge(completion.usage);

            if (choice.message.tool_calls) logger.message.debug(choice.message.tool_calls);
            logger.message.debug(completion.usage);
            wfctx.cost?.(cost);

            return this.ctx.messageCodec.decodeAiMessage(choice.message);
        } catch (e) {
            if (e instanceof OpenAI.APIError)
                throw new ResponseInvalid(undefined, { cause: e });
            else throw e;
        }
    }

    protected abstract getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string;
}

export namespace StreamTransport {
    export interface Context<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > {
        inferenceParams: InferenceParams;
        providerSpec: ProviderSpec;
        fdm: fdm;
        throttle: Throttle;
        choice: Structuring.Choice.From<fdm, vdm>;
        parallelToolCall: boolean;

        messageCodec: MessageCodec<fdm, vdm>;
        toolCodec: OpenAIChatCompletionsToolCodec<fdm>;
        billing: OpenAIChatCompletionsBilling;
        validator: Validator.From<fdm, vdm>;
    }
}
