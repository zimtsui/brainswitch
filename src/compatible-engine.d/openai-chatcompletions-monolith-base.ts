import { RoleMessage, type Session } from '../session.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { OpenAIChatCompletionsEngineBase } from './openai-chatcompletions-base.ts';
import { type InferenceContext } from '../inference-context.ts';
import { fetch } from 'undici';
import { type CompatibleEngine } from '../compatible-engine.ts';
import { ResponseInvalid } from '../engine.ts';


export abstract class OpenAIChatCompletionsMonolithEngineBase<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsEngineBase<fdm> {
    private apiURL: URL;

    public constructor(options: CompatibleEngine.Options<fdm>) {
        super(options);
        this.apiURL = new URL(`${this.baseUrl}/chat/completions`);
    }

    protected makeParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsNonStreaming {
        const fdentries = Object.entries(this.fdm) as Function.Declaration.Entry.From<fdm>[];
        const tools = fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry));
        return {
            model: this.model,
            stream: false,
            messages: [
                ...(session.developerMessage ? this.convertFromRoleMessage(session.developerMessage) : []),
                ...session.chatMessages.flatMap(chatMessage => this.convertFromRoleMessage(chatMessage)),
            ],
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? this.convertFromToolChoice(this.toolChoice) : undefined,
            parallel_tool_calls: tools.length ? this.parallel : undefined,
            max_completion_tokens: this.maxTokens ?? undefined,
            ...this.additionalOptions,
        };
    }

    protected async fetchRaw(
        ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
        const params = this.makeParams(session);
        ctx.logger.message?.trace(params);

        await this.throttle.requests(ctx);
        const res = await fetch(this.apiURL, {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            }),
            body: JSON.stringify(params),
            dispatcher: this.proxyAgent,
            signal,
        });
        assert(res.ok, new Error(undefined, { cause: res }));
        const completion = await res.json() as OpenAI.ChatCompletion;
        ctx.logger.message?.trace(completion);

        const choice = completion.choices[0];
        assert(choice, new ResponseInvalid('Content missing', { cause: completion }));

        this.handleFinishReason(completion, choice.finish_reason);

        assert(completion.usage);
        const cost = this.calcCost(completion.usage);
        ctx.logger.cost?.(cost);

        const aiMessage = this.convertToAiMessage(choice.message);

        // logging
        const text = aiMessage.getText();
        if (text) ctx.logger.inference?.debug(text + '\n');
        const apifcs = choice.message.tool_calls;
        if (apifcs?.length) ctx.logger.message?.debug(apifcs);
        ctx.logger.message?.debug(completion.usage);

        this.validateToolCallsByToolChoice(aiMessage.getFunctionCalls());

        return aiMessage;
    }

}
