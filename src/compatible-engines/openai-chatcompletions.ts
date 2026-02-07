import { type CompatibleEngine } from '../compatible-engine.ts';
import { ResponseInvalid } from '../engine.ts';
import { RoleMessage, type Session } from '../session.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import type { InferenceContext } from '../inference-context.ts';
import { type OpenAIChatCompletionsEngine } from '../api-types/openai-chat-completions.ts';



export namespace OpenAIChatCompletionsCompatibleEngine {

    export interface Base<in out fdm extends Function.Declaration.Map> {
        fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
        convertToAiMessage(message: OpenAI.ChatCompletionMessage): RoleMessage.Ai<Function.Declaration.From<fdm>>;
        convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): OpenAI.ChatCompletionSystemMessageParam;
        convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): [OpenAI.ChatCompletionUserMessageParam] | OpenAI.ChatCompletionToolMessageParam[];
        convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionAssistantMessageParam;
        convertFromRoleMessage(roleMessage: RoleMessage): OpenAI.ChatCompletionMessageParam[];
        validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void;
    }

    export interface Instance<in out fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Instance<fdm>,
        OpenAIChatCompletionsEngine.Base<fdm>,
        OpenAIChatCompletionsCompatibleEngine.Base<fdm>
    {
        fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
    }

    export namespace Base {
        export class Instance<in out fdm extends Function.Declaration.Map> implements OpenAIChatCompletionsCompatibleEngine.Base<fdm> {
            public constructor(protected instance: OpenAIChatCompletionsCompatibleEngine.Instance<fdm>) {}

            public async fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
                return await this.instance.fetchRaw(ctx, session, signal).catch(e => Promise.reject(e instanceof OpenAI.APIError ? new ResponseInvalid(undefined, { cause: e }) : e));
            }

            public convertToAiMessage(message: OpenAI.ChatCompletionMessage): RoleMessage.Ai<Function.Declaration.From<fdm>> {
                const parts: RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] = [];
                if (message.content)
                    parts.push(RoleMessage.Part.Text.create(this.instance.extractContent(message.content)));
                if (message.tool_calls)
                    parts.push(...message.tool_calls.map(apifc => {
                        assert(apifc.type === 'function');
                        return this.instance.convertToFunctionCall(apifc);
                    }));
                assert(parts.length, new ResponseInvalid('Content or tool calls not found in Response', { cause: message }));
                return RoleMessage.Ai.create(parts);
            }


            public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): OpenAI.ChatCompletionSystemMessageParam {
                return {
                    role: 'system',
                    content: developerMessage.getOnlyText(),
                };
            }

            public convertFromUserMessage(
                userMessage: RoleMessage.User<Function.Declaration.From<fdm>>,
            ): [OpenAI.ChatCompletionUserMessageParam] | OpenAI.ChatCompletionToolMessageParam[] {
                const textParts = userMessage.getParts().filter(part => part instanceof RoleMessage.Part.Text.Instance);
                const frs = userMessage.getFunctionResponses();
                if (textParts.length && !frs.length)
                    return [{ role: 'user', content: textParts.map(part => ({ type: 'text', text: part.text })) }];
                else if (!textParts.length && frs.length)
                    return frs.map(fr => this.instance.convertFromFunctionResponse(fr));
                else throw new Error();
            }

            public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionAssistantMessageParam {
                const parts = aiMessage.getParts();
                const textParts = parts.filter(part => part instanceof RoleMessage.Part.Text.Instance);
                const fcParts = parts.filter(part => part instanceof Function.Call);
                return {
                    role: 'assistant',
                    content: textParts.length ? textParts.map(part => part.text).join('') : undefined,
                    tool_calls: fcParts.length ? fcParts.map(fc => this.instance.convertFromFunctionCall(fc)) : undefined,
                };
            }

            public convertFromRoleMessage(roleMessage: RoleMessage): OpenAI.ChatCompletionMessageParam[] {
                if (roleMessage instanceof RoleMessage.Developer.Instance)
                    return [this.convertFromDeveloperMessage(roleMessage)];
                else if (roleMessage instanceof RoleMessage.User.Instance)
                    return this.convertFromUserMessage(roleMessage);
                else if (roleMessage instanceof RoleMessage.Ai.Instance)
                    return [this.convertFromAiMessage(roleMessage)];
                else throw new Error();
            }

            public validateToolCallsByToolChoice(
                toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[],
            ): void {
                // https://community.openai.com/t/function-call-with-finish-reason-of-stop/437226/7
                Function.Call.validate<fdm>(
                    toolCalls,
                    this.instance.toolChoice,
                    new ResponseInvalid('Invalid function call', { cause: toolCalls }),
                );
            }
        }
    }
}
