import { RoleMessage, type Session } from '../../session.ts';
import { Function } from '../../function.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { OpenAIChatCompletionsCompatibleEngine } from '../openai-chatcompletions.ts';
import { type InferenceContext } from '../../inference-context.ts';
import { fetch } from 'undici';
import { ResponseInvalid } from '../../engine.ts';



export namespace OpenAIChatCompletionsCompatibleMonolithEngine {

    export interface Base<in out fdm extends Function.Declaration.Map> {
        makeParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsNonStreaming;
        fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    }
    export interface Instance<in out fdm extends Function.Declaration.Map> extends
        OpenAIChatCompletionsCompatibleEngine.Instance<fdm>,
        OpenAIChatCompletionsCompatibleMonolithEngine.Base<fdm>
    {}

    export namespace Base {
        export class Instance<in out fdm extends Function.Declaration.Map> implements OpenAIChatCompletionsCompatibleMonolithEngine.Base<fdm> {
            protected apiURL: URL;

            public constructor(
                protected instance: OpenAIChatCompletionsCompatibleMonolithEngine.Instance<fdm>,
            ) {
                this.apiURL = new URL(`${this.instance.baseUrl}/chat/completions`);
            }

            public makeParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsNonStreaming {
                const fdentries = Object.entries(this.instance.fdm) as Function.Declaration.Entry.From<fdm>[];
                const tools = fdentries.map(fdentry => this.instance.convertFromFunctionDeclarationEntry(fdentry));
                return {
                    model: this.instance.model,
                    stream: false,
                    messages: [
                        ...(session.developerMessage ? this.instance.convertFromRoleMessage(session.developerMessage) : []),
                        ...session.chatMessages.flatMap(chatMessage => this.instance.convertFromRoleMessage(chatMessage)),
                    ],
                    tools: tools.length ? tools : undefined,
                    tool_choice: tools.length ? this.instance.convertFromToolChoice(this.instance.toolChoice) : undefined,
                    parallel_tool_calls: tools.length ? this.instance.parallel : undefined,
                    max_completion_tokens: this.instance.maxTokens ?? undefined,
                    ...this.instance.additionalOptions,
                };
            }

            public async fetchRaw(
                ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal,
            ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
                const params = this.makeParams(session);
                ctx.logger.message?.trace(params);

                await this.instance.throttle.requests(ctx);
                const res = await fetch(this.apiURL, {
                    method: 'POST',
                    headers: new Headers({
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.instance.apiKey}`,
                    }),
                    body: JSON.stringify(params),
                    dispatcher: this.instance.proxyAgent,
                    signal,
                });
                assert(res.ok, new Error(undefined, { cause: res }));
                const completion = await res.json() as OpenAI.ChatCompletion;
                ctx.logger.message?.trace(completion);

                const choice = completion.choices[0];
                assert(choice, new ResponseInvalid('Content missing', { cause: completion }));

                this.instance.handleFinishReason(completion, choice.finish_reason);

                assert(completion.usage);
                const cost = this.instance.calcCost(completion.usage);
                ctx.logger.cost?.(cost);

                const aiMessage = this.instance.convertToAiMessage(choice.message);

                // logging
                const text = aiMessage.getText();
                if (text) ctx.logger.inference?.debug(text + '\n');
                const apifcs = choice.message.tool_calls;
                if (apifcs?.length) ctx.logger.message?.debug(apifcs);
                ctx.logger.message?.debug(completion.usage);

                this.instance.validateToolCallsByToolChoice(aiMessage.getFunctionCalls());

                return aiMessage;
            }

        }
    }
}
