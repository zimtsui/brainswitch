import { RoleMessage, type Session } from '../../../compatible-engine/session.ts';
import { Function } from '../../../function.ts';
import OpenAI from 'openai';
import { Transport } from '../transport.ts';
import { type InferenceContext } from '../../../inference-context.ts';
import * as Undici from 'undici';
import { ResponseInvalid } from '../../../engine.ts';
import { logger } from '../../../telemetry.ts';
import type { OpenAIChatCompletionsBilling } from '../../../api-types/openai-chatcompletions/billing.ts';
import type { OpenAIChatCompletionsToolCodec } from '../../../api-types/openai-chatcompletions/tool-codec.ts';
import type { MessageCodec } from '../message-codec.ts';
import type { Throttle } from '../../../throttle.ts';
import type { Verbatim } from '../../../verbatim.ts';
import { Validator } from '../../../compatible-engine/validation.ts';
import * as ChoiceCodec from '../choice-codec.ts';
import type { Structuring } from '../../../compatible-engine/structuring.ts';



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
        const tools = this.ctx.toolCodec.encodeFunctionDeclarationMap(this.ctx.fdm);
        return {
            model: this.ctx.model,
            stream: false,
            messages: [
                ...(session.developerMessage ? this.ctx.messageCodec.encodeRoleMessage(session.developerMessage) : []),
                ...this.ctx.messageCodec.encodeRoleMessages(session.chatMessages),
            ],
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? ChoiceCodec.encode(this.ctx.choice) : undefined,
            parallel_tool_calls: tools.length ? this.ctx.parallelToolCall : undefined,
            max_completion_tokens: this.ctx.maxTokens ?? undefined,
            ...this.ctx.additionalOptions,
        };
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

            // Get response
            if (res.ok) {} else throw new Error(undefined, { cause: res });
            const completion = await res.json() as OpenAI.ChatCompletion;
            logger.message.trace(completion);

            // Validate response
            const choice = completion.choices[0];
            if (choice) {} else throw new ResponseInvalid('Content missing', { cause: completion });

            this.handleFinishReason(completion, choice.finish_reason);

            if (completion.usage) {} else throw new Error();
            const cost = this.ctx.billing.charge(completion.usage);

            if (choice.message.content) logger.inference.debug(choice.message.content);
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
