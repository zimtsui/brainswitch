import { ResponseInvalid, type InferenceParams, type ProviderSpec } from '#@/engine.ts';
import { RoleMessage, type Session } from '#@/native-engines.d/openai-responses/session.ts';
import { Function } from '#@/function.ts';
import OpenAI from 'openai';
import * as Undici from 'undici';
import { type InferenceContext } from '#@/inference-context.ts';
import { Throttle } from '#@/throttle.ts';
import { logger } from '#@/telemetry.ts';
import type { MessageCodec } from '#@/native-engines.d/openai-responses/message-codec.ts';
import type { ToolCodec } from '#@/api-types/openai-responses/tool-codec.ts';
import type { Billing } from '#@/api-types/openai-responses/billing.ts';
import type { Validator } from '#@/native-engines.d/openai-responses/validation.ts';
import type { Verbatim } from '#@/verbatim.ts';
import * as ChoiceCodec from '#@/native-engines.d/openai-responses/choice-codec.ts';
import { Structuring } from '#@/native-engines.d/openai-responses/structuring.ts';
import * as VerbatimCodec from '#@/verbatim/codec.ts';



export class Transport<
    fdm extends Function.Decl.Map.Proto,
    vdm extends Verbatim.Decl.Map.Proto,
> {
    protected apiURL: URL;

    public constructor(protected ctx: Transport.Context<fdm, vdm>) {
        this.apiURL = new URL(`${this.ctx.providerSpec.baseUrl}/responses`);
    }

    protected makeParams(
        session: Session.From<fdm, vdm>,
    ): OpenAI.Responses.ResponseCreateParamsNonStreaming {
        const tools: OpenAI.Responses.Tool[] = this.ctx.toolCodec.convertFromFunctionDeclarationMap(this.ctx.fdm);
        if (this.ctx.applyPatch) tools.push({ type: 'apply_patch' });
        return {
            model: this.ctx.inferenceParams.model,
            include: ['reasoning.encrypted_content'],
            store: false,
            input: session.chatMessages.flatMap(chatMessage => this.ctx.messageCodec.convertFromChatMessage(chatMessage)),
            instructions: session.developerMessage && this.ctx.messageCodec.convertFromDeveloperMessage(session.developerMessage),
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? ChoiceCodec.encode(this.ctx.choice) : undefined,
            parallel_tool_calls: tools.length ? this.ctx.parallelToolCall : undefined,
            max_output_tokens: this.ctx.inferenceParams.maxTokens,
            ...this.ctx.inferenceParams.additionalOptions,
        };
    }

    protected logAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): void {
        for (const item of output)
            if (item.type === 'message') {
                if (item.content.every(part => part.type === 'output_text')) {} else throw new Error();
                logger.inference.debug(item.content.map(part => part.text).join(''));
            } else if (item.type === 'function_call')
                logger.message.debug(item);
            else if (item.type === 'apply_patch_call')
                logger.message.debug(item);
    }

    protected async fetchRaw(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>> {
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
        wfctx.cost?.(this.ctx.billing.charge(response.usage));
        logger.message.debug(response.usage);

        try {
            const aiMessage = this.ctx.messageCodec.convertToAiMessage(response.output);
            this.ctx.validator.validate(aiMessage.getToolCalls(), aiMessage.getVerbatimMessages());
            return aiMessage;
        } catch (e) {
            if (e instanceof VerbatimCodec.Request.Invalid)
                throw new ResponseInvalid('Invalid verbatim message', { cause: response.output });
            else throw e;
        }
    }

    public async fetch(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>> {
        return await this.fetchRaw(wfctx, session, signal).catch(e => Promise.reject(e instanceof OpenAI.APIError ? new ResponseInvalid(undefined, { cause: e }) : e));
    }
}

export namespace Transport {
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
        applyPatch: boolean;

        messageCodec: MessageCodec<fdm, vdm>;
        toolCodec: ToolCodec<fdm>;
        billing: Billing;
        validator: Validator.From<fdm, vdm>;
    }
}
