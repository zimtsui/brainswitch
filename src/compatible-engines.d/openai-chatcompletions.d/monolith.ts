import { RoleMessage, type Session } from '../../session.ts';
import { Function } from '../../function.ts';
import OpenAI from 'openai';
import { OpenAIChatCompletionsCompatibleEngine } from '../openai-chatcompletions.ts';
import { type InferenceContext } from '../../inference-context.ts';
import { fetch } from 'undici';
import { ResponseInvalid } from '../../engine.ts';



export namespace OpenAIChatCompletionsCompatibleMonolithEngine {

    export interface Abstract<in out fdm extends Function.Declaration.Map> extends
        OpenAIChatCompletionsCompatibleEngine.Abstract<fdm>
    {
        apiURL: URL;
        makeParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsNonStreaming;
        fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    }

    export function getApiURL(baseUrl: string): URL {
        return new URL(`${baseUrl}/chat/completions`);
    }

    export function makeParams<fdm extends Function.Declaration.Map>(
        this: OpenAIChatCompletionsCompatibleEngine.Abstract<fdm>,
        session: Session<Function.Declaration.From<fdm>>,
    ): OpenAI.ChatCompletionCreateParamsNonStreaming {
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

    export async function fetchRaw<fdm extends Function.Declaration.Map>(
        this: OpenAIChatCompletionsCompatibleMonolithEngine.Abstract<fdm>,
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
        if (res.ok) {} else throw new Error(undefined, { cause: res });
        const completion = await res.json() as OpenAI.ChatCompletion;
        ctx.logger.message?.trace(completion);

        const choice = completion.choices[0];
        if (choice) {} else throw new ResponseInvalid('Content missing', { cause: completion });

        this.handleFinishReason(completion, choice.finish_reason);

        if (completion.usage) {} else throw new Error();
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
