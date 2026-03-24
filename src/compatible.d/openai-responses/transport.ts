import { ResponseInvalid, type InferenceParams, type ProviderSpec } from '#@/engine.ts';
import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import OpenAI from 'openai';
import * as Undici from 'undici';
import { type InferenceContext } from '#@/inference-context.ts';
import { Throttle } from '#@/throttle.ts';
import { logger } from '#@/telemetry.ts';
import type { OpenAIResponsesCompatibleMessageCodec } from '#@/compatible.d/openai-responses/message-codec.ts';
import type { OpenAIResponsesToolCodec } from '#@/api-types/openai-responses/tool-codec.ts';
import type { OpenAIResponsesBilling } from '#@/api-types/openai-responses/billing.ts';
import type { Verbatim } from '#@/verbatim.ts';
import { Validator } from '#@/compatible/validation.ts';
import * as ChoiceCodec from '#@/compatible.d/openai-responses/choice-codec.ts';
import type { Structuring } from '#@/compatible/structuring.ts';


export class OpenAIResponsesCompatibleTransport<
    in out fdm extends Function.Declaration.Map.Prototype,
    in out vdm extends Verbatim.Declaration.Map.Prototype,
> {
    protected apiURL: URL;

    public constructor(protected ctx: OpenAIResponsesCompatibleTransport.Context<fdm, vdm>) {
        this.apiURL = new URL(`${this.ctx.providerSpec.baseUrl}/responses`);
    }

    protected makeParams(
        session: Session.From<fdm, vdm>,
    ): OpenAI.Responses.ResponseCreateParamsNonStreaming {
        const tools = this.ctx.toolCodec.convertFromFunctionDeclarationMap(this.ctx.fdm);
        return {
            model: this.ctx.inferenceSpec.model,
            include: ['reasoning.encrypted_content'],
            store: false,
            input: session.chatMessages.flatMap(chatMessage => this.ctx.messageCodec.convertFromChatMessage(chatMessage)),
            instructions: session.developerMessage && this.ctx.messageCodec.convertFromDeveloperMessage(session.developerMessage),
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? ChoiceCodec.encode(this.ctx.choice) : undefined,
            parallel_tool_calls: tools.length ? this.ctx.parallelToolCall : undefined,
            max_output_tokens: this.ctx.inferenceSpec.maxTokens,
            ...this.ctx.inferenceSpec.additionalOptions,
        };
    }

    protected logAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): void {
        for (const item of output)
            if (item.type === 'message') {
                if (item.content.every(part => part.type === 'output_text')) {} else throw new Error();
                logger.inference.debug(item.content.map(part => part.text).join(''));
            } else if (item.type === 'function_call')
                logger.message.debug(item);
    }

    protected async fetchRaw(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<OpenAIResponsesCompatibleMessageCodec.Message.Ai.From<fdm, vdm>> {
        const params = this.makeParams(session);
        logger.message.trace(params);

        await this.ctx.throttle.requests(wfctx);
        const res = await Undici.fetch(
            this.apiURL,
            {
                method: 'POST',
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.ctx.providerSpec.apiKey}`,
                }),
                body: JSON.stringify(params),
                dispatcher: this.ctx.providerSpec.proxyAgent,
                signal,
            },
        );
        if (res.ok) {} else throw new Error(undefined, { cause: res });
        const response = await res.json() as OpenAI.Responses.Response;
        logger.message.trace(response);
        if (response.status === 'incomplete' && response.incomplete_details?.reason === 'max_output_tokens')
            throw new ResponseInvalid('Token limit exceeded.', { cause: response });
        if (response.status === 'completed') {}
        else throw new ResponseInvalid('Abnormal response status', { cause: response });

        this.logAiMessage(response.output);

        if (response.usage) {} else throw new Error();
        logger.message.debug(response.usage);
        wfctx.cost?.(this.ctx.billing.charge(response.usage));

        const aiMessage = this.ctx.messageCodec.convertToAiMessage(response.output);
        this.ctx.validator.validate(aiMessage.getFunctionCalls(), aiMessage.getVerbatimMessages());

        return aiMessage;
    }

    public async fetch(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>> {
        try {
            return await this.fetchRaw(wfctx, session, signal);
        } catch (e) {
            if (e instanceof OpenAI.APIError)
                throw new ResponseInvalid(undefined, { cause: e });
            else throw e;
        }
    }
}

export namespace OpenAIResponsesCompatibleTransport {
    export interface Context<
        in out fdm extends Function.Declaration.Map.Prototype,
        in out vdm extends Verbatim.Declaration.Map.Prototype,
    > {
        inferenceSpec: InferenceParams;
        providerSpec: ProviderSpec;
        fdm: fdm;
        throttle: Throttle;
        choice: Structuring.Choice.From<fdm, vdm>;
        parallelToolCall: boolean;

        messageCodec: OpenAIResponsesCompatibleMessageCodec<fdm, vdm>;
        toolCodec: OpenAIResponsesToolCodec<fdm>;
        billing: OpenAIResponsesBilling;
        validator: Validator.From<fdm, vdm>;
    }
}
