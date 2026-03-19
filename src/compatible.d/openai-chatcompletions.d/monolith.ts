import { RoleMessage, type Session } from '../../session.ts';
import { Function } from '../../function.ts';
import type OpenAI from 'openai';
import { OpenAIChatCompletionsCompatibleTransport } from '../openai-chatcompletions/transport.ts';
import { type InferenceContext } from '../../inference-context.ts';
import * as Undici from 'undici';
import { ResponseInvalid } from '../../engine.ts';
import { logger } from '../../telemetry.ts';
import type { OpenAIChatCompletionsBilling } from '../../api-types/openai-chatcompletion/billing.ts';
import type { OpenAIChatCompletionsToolCodec } from '../../api-types/openai-chatcompletion/tool-codec.ts';
import type { OpenAIChatCompletionsCompatibleMessageCodec } from '../openai-chatcompletions/message-codec.ts';
import type { Throttle } from '../../throttle.ts';
import type { ToolCallValidator } from '../../compatible/tool-call-validator.ts';



export abstract class OpenAIChatCompletionsCompatibleMonolith<in out fdm extends Function.Declaration.Map> extends
    OpenAIChatCompletionsCompatibleTransport<fdm>
{
    public constructor(protected ctx: OpenAIChatCompletionsCompatibleMonolith.Context<fdm>) {
        super();
    }

    protected getApiURL(baseUrl: string): URL {
        return new URL(`${baseUrl}/chat/completions`);
    }

    protected makeParams(
        session: Session<Function.Declaration.From<fdm>>,
    ): OpenAI.ChatCompletionCreateParamsNonStreaming {
        const tools = this.ctx.toolCodec.convertFromFunctionDeclarationMap(this.ctx.fdm);
        return {
            model: this.ctx.model,
            stream: false,
            messages: [
                ...(session.developerMessage ? this.ctx.messageCodec.convertFromRoleMessage(session.developerMessage) : []),
                ...session.chatMessages.flatMap(chatMessage => this.ctx.messageCodec.convertFromRoleMessage(chatMessage)),
            ],
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? this.ctx.toolCodec.convertFromToolChoice(this.ctx.toolChoice) : undefined,
            parallel_tool_calls: tools.length ? this.ctx.parallelToolCall : undefined,
            max_completion_tokens: this.ctx.maxTokens ?? undefined,
            ...this.ctx.additionalOptions,
        };
    }

    protected override async fetchRaw(
        wfctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
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

        const aiMessage = this.ctx.messageCodec.convertToAiMessage(choice.message);

        const text = aiMessage.getText();
        if (text) logger.inference.debug(text);
        const apifcs = choice.message.tool_calls;
        if (apifcs?.length) logger.message.debug(apifcs);
        logger.message.debug(completion.usage);
        wfctx.cost?.(cost);

        this.ctx.toolCallValidator.validate(aiMessage.getFunctionCalls());

        return aiMessage;
    }
}

export namespace OpenAIChatCompletionsCompatibleMonolith {
    export interface Context<in out fdm extends Function.Declaration.Map> {
        proxyAgent?: Undici.ProxyAgent;
        apiURL: URL;
        apiKey: string;
        model: string;
        fdm: fdm;
        maxTokens?: number;
        throttle: Throttle;
        additionalOptions?: Record<string, unknown>;
        toolChoice: Function.ToolChoice<fdm>;
        parallelToolCall: boolean;

        messageCodec: OpenAIChatCompletionsCompatibleMessageCodec<fdm>;
        toolCodec: OpenAIChatCompletionsToolCodec<fdm>;
        billing: OpenAIChatCompletionsBilling<fdm>;
        toolCallValidator: ToolCallValidator<fdm>;
    }
}
