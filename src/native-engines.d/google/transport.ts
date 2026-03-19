import { ResponseInvalid, type InferenceParams, type ProviderSpec } from '../../engine.ts';
import { RoleMessage, type Session } from './session.ts';
import { Function } from '../../function.ts';
import * as Google from '@google/genai';
import * as Undici from 'undici';
import { type InferenceContext } from '../../inference-context.ts';
import type { GoogleRestfulRequest } from '../../api-types/google/restful-request.ts';
import { Throttle } from '../../throttle.ts';
import { logger } from '../../telemetry.ts';
import type { GoogleNativeMessageCodec } from './message-codec.ts';
import type { GoogleToolCodec } from '../../api-types/google/tool-codec.ts';
import type { GoogleBilling } from '../../api-types/google/billing.ts';
import type { ToolCallValidator } from '../../compatible/tool-call-validator.ts';



export class GoogleNativeTransport<fdm extends Function.Declaration.Map> {
    protected apiURL: URL;

    public constructor(protected ctx: GoogleNativeTransport.Context<fdm>) {
        this.apiURL = new URL(`${this.ctx.providerSpec.baseUrl}/v1beta/models/${this.ctx.inferenceParams.model}:generateContent`);
    }

    public async fetch(
        wfctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        const systemInstruction = session.developerMessage && this.ctx.messageCodec.convertFromDeveloperMessage(session.developerMessage);
        const contents = this.ctx.messageCodec.convertFromChatMessages(session.chatMessages);

        await this.ctx.throttle.requests(wfctx);

        const functionDeclarations = this.ctx.toolCodec.convertFromFunctionDeclarationMap(this.ctx.fdm);
        const tools: Google.Tool[] = [];
        if (functionDeclarations.length) tools.push({ functionDeclarations });
        if (this.ctx.urlContext) tools.push({ urlContext: {} });
        if (this.ctx.googleSearch) tools.push({ googleSearch: {} });
        if (this.ctx.codeExecution) tools.push({ codeExecution: {} });
        const reqbody: GoogleRestfulRequest = {
            contents,
            tools: tools.length ? tools : undefined,
            toolConfig: functionDeclarations.length ? {
                functionCallingConfig: this.ctx.toolCodec.convertFromToolChoice(this.ctx.toolChoice),
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
            if (part.text) logger.inference.debug(part.text + '\n');
            if (part.functionCall) logger.message.debug(part.functionCall);
        }

        if (response.usageMetadata) {} else throw new ResponseInvalid('Usage metadata missing', { cause: response });
        wfctx.cost?.(this.ctx.billing.charge(response.usageMetadata));

        const aiMessage = this.ctx.messageCodec.convertToAiMessage(response.candidates[0].content);
        this.ctx.toolCallValidator.validate(aiMessage.getFunctionCalls());
        return aiMessage;
    }
}

export namespace GoogleNativeTransport {
    export interface Context<fdm extends Function.Declaration.Map> {
        inferenceParams: InferenceParams;
        providerSpec: ProviderSpec;
        fdm: fdm;
        throttle: Throttle;
        toolChoice: Function.ToolChoice<fdm>;
        codeExecution: boolean;
        urlContext: boolean;
        googleSearch: boolean;

        messageCodec: GoogleNativeMessageCodec<fdm>;
        toolCodec: GoogleToolCodec<fdm>;
        billing: GoogleBilling;
        toolCallValidator: ToolCallValidator<fdm>;
    }
}
