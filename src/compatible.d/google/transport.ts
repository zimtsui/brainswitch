import { ResponseInvalid, type InferenceParams as InferenceParams, type Pricing, type ProviderSpec } from '#@/engine.ts';
import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import * as Google from '@google/genai';
import * as Undici from 'undici';
import { type InferenceContext } from '#@/inference-context.ts';
import type { RestfulRequest } from '#@/api-types/google/restful-request.ts';
import { Throttle } from '#@/throttle.ts';
import { logger } from '#@/telemetry.ts';
import type { MessageCodec } from '#@/compatible.d/google/message-codec.ts';
import type { ToolCodec } from '#@/api-types/google/tool-codec.ts';
import type { Billing } from '#@/api-types/google/billing.ts';
import type { Verbatim } from '#@/verbatim.ts';
import type { Validator } from '#@/compatible/validation.ts';
import type { Structuring } from '#@/compatible/structuring.ts';
import * as GoogleChoiceCodec from '#@/compatible.d/google/choice-codec.ts';
import * as VerbatimCodec from '#@/verbatim/codec.ts';



export class Transport<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> {
    protected apiURL: URL;
    public constructor(protected ctx: Transport.Context<fdm, vdm>) {
        this.apiURL = new URL(`${this.ctx.providerSpec.baseUrl}/v1beta/models/${this.ctx.inferenceParams.model}:generateContent`)
    }

    public async fetch(
        wfctx: InferenceContext,
        session: Session<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Decl.From<fdm>, Verbatim.Decl.From<vdm>>> {
        const systemInstruction = session.developerMessage && this.ctx.messageCodec.convertFromDeveloperMessage(session.developerMessage);
        const contents = this.ctx.messageCodec.convertFromChatMessages(session.chatMessages);

        await this.ctx.throttle.requests(wfctx);

        const tools = this.ctx.toolCodec.convertFromFunctionDeclarationMap(this.ctx.fdm);
        const reqbody: RestfulRequest = {
            contents,
            tools: tools.length ? [{
                functionDeclarations: tools,
            }] : undefined,
            toolConfig: tools.length ? {
                functionCallingConfig: GoogleChoiceCodec.encode(this.ctx.choice),
            } : undefined,
            systemInstruction,
            generationConfig: this.ctx.inferenceParams.maxTokens || this.ctx.inferenceParams.additionalOptions ? {
                maxOutputTokens: this.ctx.inferenceParams.maxTokens ?? undefined,
                ...this.ctx.inferenceParams.additionalOptions,
            } : undefined,
        };

        logger.message.trace(reqbody);

        const res = await Undici.fetch(this.apiURL, {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/json',
                'x-goog-api-key': this.ctx.providerSpec.apiKey,
            }),
            body: JSON.stringify(reqbody),
            dispatcher: this.ctx.providerSpec.proxyAgent,
            signal,
        });
        logger.message.trace(res);
        if (res.ok) {} else throw new Error(undefined, { cause: res });
        const response = await res.json() as Google.GenerateContentResponse;

        if (response.candidates?.[0]?.content?.parts?.length) {} else throw new ResponseInvalid('Content missing', { cause: response });
        if (response.candidates[0].finishReason === Google.FinishReason.MAX_TOKENS)
            throw new ResponseInvalid('Token limit exceeded.', { cause: response });
        if (response.candidates[0].finishReason === Google.FinishReason.STOP) {}
        else throw new ResponseInvalid('Abnormal finish reason', { cause: response });


        for (const part of response.candidates[0].content.parts) {
            if (part.text) logger.inference.debug(part.text);
            if (part.functionCall) logger.message.debug(part.functionCall);
        }

        if (response.usageMetadata) {} else throw new ResponseInvalid('Usage metadata missing', { cause: response });
        wfctx.cost?.(this.ctx.billing.charge(response.usageMetadata));

        try {
            const aiMessage = this.ctx.messageCodec.convertToAiMessage(response.candidates[0].content);
            this.ctx.validator.validate(aiMessage.getFunctionCalls(), aiMessage.getVerbatimMessages());
            return aiMessage;
        } catch (e) {
            if (e instanceof VerbatimCodec.RequestInvalid)
                throw new ResponseInvalid('Invalid verbatim message', { cause: response.candidates[0].content });
            else throw e;
        }
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

        messageCodec: MessageCodec<fdm, vdm>;
        toolCodec: ToolCodec<fdm>;
        billing: Billing;
        validator: Validator.From<fdm, vdm>;
    }
}
