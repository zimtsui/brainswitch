import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import type OpenAI from 'openai';
import { Transport } from '#@/compatible.d/openai-chatcompletions/transport.ts';
import { type InferenceContext } from '#@/inference-context.ts';
import * as Undici from 'undici';
import { ResponseInvalid } from '#@/engine.ts';
import { logger } from '#@/telemetry.ts';
import type { OpenAIChatCompletionsBilling } from '#@/api-types/openai-chatcompletions/billing.ts';
import type { OpenAIChatCompletionsToolCodec } from '#@/api-types/openai-chatcompletions/tool-codec.ts';
import type { MessageCodec } from '#@/compatible.d/openai-chatcompletions/message-codec.ts';
import type { Throttle } from '#@/throttle.ts';
import type { Verbatim } from '#@/verbatim.ts';
import { Validator } from '#@/compatible/validation.ts';
import * as ChoiceCodec from '#@/compatible.d/openai-chatcompletions/choice-codec.ts';
import type { Structuring } from '#@/compatible/structuring.ts';
import * as VerbatimCodec from '#@/verbatim/codec.ts';



export abstract class MonolithTransport<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> extends Transport<fdm, vdm> {
    public constructor(protected ctx: MonolithTransport.Context<fdm, vdm>) {
        super();
    }

    protected getApiURL(baseUrl: string): URL {
        return new URL(`${baseUrl}/chat/completions`);
    }

    protected makeParams(
        session: Session.From<fdm, vdm>,
    ): OpenAI.ChatCompletionCreateParamsNonStreaming {
        const tools = this.ctx.toolCodec.convertFromFunctionDeclarationMap(this.ctx.fdm);
        return {
            model: this.ctx.model,
            stream: false,
            messages: [
                ...(session.developerMessage ? this.ctx.messageCodec.convertFromRoleMessage(session.developerMessage) : []),
                ...this.ctx.messageCodec.convertFromRoleMessages(session.chatMessages),
            ],
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? ChoiceCodec.encode(this.ctx.choice) : undefined,
            parallel_tool_calls: tools.length ? this.ctx.parallelToolCall : undefined,
            max_completion_tokens: this.ctx.maxTokens ?? undefined,
            ...this.ctx.additionalOptions,
        };
    }

    protected override async fetchRaw(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>> {
        const params = this.makeParams(session);
        logger.message.trace(params);

        await this.ctx.throttle.requests(wfctx);
        const res = await Undici.fetch(this.ctx.apiURL, {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.ctx.apiKey}`,
            }),
            body: JSON.stringify(params),
            dispatcher: this.ctx.proxyAgent,
            signal,
        });
        if (res.ok) {} else throw new Error(undefined, { cause: res });
        const completion = await res.json() as OpenAI.ChatCompletion;
        logger.message.trace(completion);

        const choice = completion.choices[0];
        if (choice) {} else throw new ResponseInvalid('Content missing', { cause: completion });

        this.handleFinishReason(completion, choice.finish_reason);

        if (completion.usage) {} else throw new Error();
        const cost = this.ctx.billing.charge(completion.usage);

        if (choice.message.content) logger.inference.debug(choice.message.content);
        if (choice.message.tool_calls) logger.message.debug(choice.message.tool_calls);
        logger.message.debug(completion.usage);
        wfctx.cost?.(cost);

        try {
            const aiMessage = this.ctx.messageCodec.convertToAiMessage(choice.message);
            this.ctx.validator.validate(aiMessage.getFunctionCalls(), aiMessage.getVerbatimMessages());
            return aiMessage;
        } catch (e) {
            if (e instanceof VerbatimCodec.RequestInvalid)
                throw new ResponseInvalid('Invalid verbatim message', { cause: choice.message });
            else throw e;
        }
    }
}

export namespace MonolithTransport {
    export interface Context<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > {
        proxyAgent?: Undici.ProxyAgent;
        apiURL: URL;
        apiKey: string;
        model: string;
        fdm: fdm;
        maxTokens?: number;
        throttle: Throttle;
        additionalOptions?: Record<string, unknown>;
        choice: Structuring.Choice.From<fdm, vdm>;
        parallelToolCall: boolean;

        messageCodec: MessageCodec<fdm, vdm>;
        toolCodec: OpenAIChatCompletionsToolCodec<fdm>;
        billing: OpenAIChatCompletionsBilling;
        validator: Validator.From<fdm, vdm>;
    }
}
