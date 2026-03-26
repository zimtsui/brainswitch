import { ResponseInvalid, type InferenceParams, type ProviderSpec } from '#@/engine.ts';
import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import Anthropic from '@anthropic-ai/sdk';
import { type InferenceContext } from '#@/inference-context.ts';
import { Throttle } from '#@/throttle.ts';
import { logger } from '#@/telemetry.ts';
import type { MessageCodec } from '#@/compatible.d/anthropic/message-codec.ts';
import type { Billing } from '#@/api-types/anthropic/billing.ts';
import type { ToolCodec } from '#@/api-types/anthropic/tool-codec.ts';
import type { Verbatim } from '#@/verbatim.ts';
import { Validator } from '#@/compatible/validation.ts';
import * as ChoiceCodec from '#@/compatible.d/anthropic/choice-codec.ts';
import type { Structuring } from '#@/compatible/structuring.ts';
import * as VerbatimCodec from '#@/verbatim/codec.ts';


export class Transport<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> {
    protected client: Anthropic;

    public constructor(protected ctx: Transport.Context<fdm, vdm>) {
        this.client = new Anthropic({
            baseURL: this.ctx.providerSpec.baseUrl,
            apiKey: this.ctx.providerSpec.apiKey,
            fetchOptions: { dispatcher: this.ctx.providerSpec.proxyAgent },
        });
    }

    protected makeParams(
        session: Session.From<fdm, vdm>,
    ): Anthropic.MessageCreateParamsStreaming {
        const tools = this.ctx.toolCodec.convertFromFunctionDeclarationMap(this.ctx.fdm);
        return {
            model: this.ctx.inferenceSpec.model,
            stream: true,
            messages: session.chatMessages.map(chatMessage => this.ctx.messageCodec.convertFromChatMessage(chatMessage)),
            system: session.developerMessage && this.ctx.messageCodec.convertFromDeveloperMessage(session.developerMessage),
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? ChoiceCodec.encode(this.ctx.choice, this.ctx.parallelToolCall) : undefined,
            max_tokens: this.ctx.inferenceSpec.maxTokens ?? 64 * 1024,
            ...this.ctx.inferenceSpec.additionalOptions,
        };
    }

    public async fetch(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>> {
        const params = this.makeParams(session);
        logger.message.trace(params);

        await this.ctx.throttle.requests(wfctx);
        const stream = this.client.messages.stream(params, { signal });

        let response: Anthropic.Message | null = null;
        for await (const event of stream) {
            if (event.type === 'message_start') {
                logger.message.trace(event);
                response = structuredClone(event.message);
            } else {
                if (response) {} else throw new Error();
                if (event.type === 'message_delta') {
                    logger.message.trace(event);
                    response.stop_sequence = event.delta.stop_sequence ?? response.stop_sequence;
                    response.stop_reason = event.delta.stop_reason ?? response.stop_reason;
                    response.usage.input_tokens = event.usage.input_tokens ?? response.usage.input_tokens;
                    response.usage.output_tokens = event.usage.output_tokens;
                    response.usage.cache_read_input_tokens = event.usage.cache_read_input_tokens ?? response.usage.cache_read_input_tokens;
                    response.usage.cache_creation_input_tokens = event.usage.cache_creation_input_tokens ?? response.usage.cache_creation_input_tokens;
                    response.usage.server_tool_use = event.usage.server_tool_use ?? response.usage.server_tool_use;
                } else if (event.type === 'message_stop') {
                    logger.message.trace(event);
                } else if (event.type === 'content_block_start') {
                    logger.message.trace(event);
                    const contentBlock = structuredClone(event.content_block);
                    response.content.push(contentBlock);
                    if (contentBlock.type === 'tool_use') contentBlock.input = '';
                } else if (event.type === 'content_block_delta') {
                    const contentBlock = response.content[event.index];
                    if (event.delta.type === 'text_delta') {
                        logger.inference.debug(event.delta.text);
                        if (contentBlock?.type === 'text') {} else throw new Error();
                        contentBlock.text += event.delta.text;
                    } else if (event.delta.type === 'thinking_delta') {
                        logger.inference.trace(event.delta.thinking);
                        if (contentBlock?.type === 'thinking') {} else throw new Error();
                        contentBlock.thinking += event.delta.thinking;
                    } else if (event.delta.type === 'signature_delta') {
                        if (contentBlock?.type === 'thinking') {} else throw new Error();
                        contentBlock.signature += event.delta.signature;
                    } else if (event.delta.type === 'input_json_delta') {
                        logger.inference.trace(event.delta.partial_json);
                        if (contentBlock?.type === 'tool_use') {} else throw new Error();
                        if (typeof contentBlock.input === 'string') {} else throw new Error();
                        contentBlock.input += event.delta.partial_json;
                    } else throw new Error('Unknown type of content block delta', { cause: event.delta });
                } else if (event.type === 'content_block_stop') {
                    const contentBlock = response.content[event.index];
                    if (contentBlock?.type === 'text') logger.inference.debug('\n');
                    else if (contentBlock?.type === 'thinking') logger.inference.trace('\n');
                    else if (contentBlock?.type === 'tool_use') logger.inference.debug('\n');
                    logger.message.trace(event);
                    if (contentBlock?.type === 'tool_use') {
                        if (typeof contentBlock.input === 'string') {} else throw new Error();
                        logger.message.debug(contentBlock);
                    }
                } else throw new Error('Unknown stream event', { cause: event });
            }
        }
        if (response) {} else throw new Error();
        if (response.stop_reason === 'max_tokens')
            throw new ResponseInvalid('Token limit exceeded.', { cause: response });
        if (response.stop_reason === 'end_turn' || response.stop_reason === 'tool_use') {}
        else throw new ResponseInvalid('Abnormal stop reason', { cause: response });

        logger.message.debug(response.usage);
        wfctx.cost?.(this.ctx.billing.charge(response.usage));

        try {
            const aiMessage = this.ctx.messageCodec.convertToAiMessage(response.content);
            this.ctx.validator.validate(aiMessage.getFunctionCalls(), aiMessage.getVerbatimMessages());
            return aiMessage;
        } catch (e) {
            if (e instanceof VerbatimCodec.Request.Invalid)
                throw new ResponseInvalid('Invalid verbatim message', { cause: response.content });
            else throw e;
        }
    }
}

export namespace Transport {
    export interface Context<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > {
        providerSpec: ProviderSpec;
        inferenceSpec: InferenceParams;
        fdm: fdm;
        throttle: Throttle;
        choice: Structuring.Choice.From<fdm, vdm>;
        parallelToolCall: boolean;

        messageCodec: MessageCodec<fdm, vdm>;
        toolCodec: ToolCodec<fdm>;
        billing: Billing;
        validator: Validator.From<fdm, vdm>;
    }
}
