import { ResponseInvalid, type Engine } from '../engine.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import assert from 'node:assert';
import { Ajv } from 'ajv';


const ajv = new Ajv();


export namespace OpenAIChatCompletionsEngine {

    export interface Base<in out fdm extends Function.Declaration.Map> {
        parallel: boolean;
        convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionMessageToolCall;
        convertToFunctionCall(apifc: OpenAI.ChatCompletionMessageFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>>;
        convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionToolMessageParam;
        convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.ChatCompletionTool;
        convertFromToolChoice(mode: Function.ToolChoice<fdm>): OpenAI.ChatCompletionToolChoiceOption;
        calcCost(usage: OpenAI.CompletionUsage): number;
        extractContent(completionContent: string): string;
        handleFinishReason(completion: OpenAI.ChatCompletion, finishReason: OpenAI.ChatCompletion.Choice['finish_reason']): void;
    }

    export interface Instance<in out fdm extends Function.Declaration.Map> extends
        Engine.Instance<fdm>,
        OpenAIChatCompletionsEngine.Base<fdm>
    {}

    export namespace Base {
        export class Instance<in out fdm extends Function.Declaration.Map> implements OpenAIChatCompletionsEngine.Base<fdm> {
            public parallel: boolean;

            public constructor(
                protected instance: Engine.Instance<fdm>,
                options: Engine.Options<fdm>,
            ) {
                this.parallel = options.parallelToolCall ?? false;
            }

            public convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionMessageToolCall {
                assert(fc.id);
                return {
                    id: fc.id,
                    type: 'function',
                    function: {
                        name: fc.name,
                        arguments: JSON.stringify(fc.args),
                    },
                };
            }

            public convertToFunctionCall(apifc: OpenAI.ChatCompletionMessageFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
                const fditem = this.instance.fdm[apifc.function.name] as Function.Declaration.Item.From<fdm>;
                assert(fditem, new ResponseInvalid('Unknown function call', { cause: apifc }));
                const args = (() => {
                    try {
                        return JSON.parse(apifc.function.arguments);
                    } catch (e) {
                        return new ResponseInvalid('Invalid JSON of function call', { cause: apifc });
                    }
                })();
                assert(
                    ajv.validate(fditem.paraschema, args),
                    new ResponseInvalid('Invalid function arguments', { cause: apifc }),
                );
                return Function.Call.create({
                    id: apifc.id,
                    name: apifc.function.name,
                    args,
                } as Function.Call.create.Options<Function.Declaration.From<fdm>>);
            }


            public convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionToolMessageParam {
                assert(fr.id);
                return {
                    role: 'tool',
                    tool_call_id: fr.id,
                    content: fr.text,
                };
            }

            public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.ChatCompletionTool {
                return {
                    type: 'function',
                    function: {
                        name: fdentry[0],
                        description: fdentry[1].description,
                        strict: true,
                        parameters: fdentry[1].paraschema,
                    },
                };
            }

            public convertFromToolChoice(mode: Function.ToolChoice<fdm>): OpenAI.ChatCompletionToolChoiceOption {
                if (mode === Function.ToolChoice.NONE) return 'none';
                else if (mode === Function.ToolChoice.REQUIRED) return 'required';
                else if (mode === Function.ToolChoice.AUTO) return 'auto';
                else {
                    assert(mode.length === 1);
                    return { type: 'function', function: { name: mode[0]! } };
                }
            }

            public calcCost(usage: OpenAI.CompletionUsage): number {
                const cacheHitTokenCount = usage.prompt_tokens_details?.cached_tokens ?? 0;
                const cacheMissTokenCount = usage.prompt_tokens - cacheHitTokenCount;
                return	this.instance.inputPrice * cacheMissTokenCount / 1e6 +
                        this.instance.cachedPrice * cacheHitTokenCount / 1e6 +
                        this.instance.outputPrice * usage.completion_tokens / 1e6;
            }

            public extractContent(completionContent: string): string {
                return completionContent;
            }

            public handleFinishReason(completion: OpenAI.ChatCompletion, finishReason: OpenAI.ChatCompletion.Choice['finish_reason']): void {
                if (finishReason === 'length')
                    throw new ResponseInvalid('Token limit exceeded.', { cause: completion });
                assert(
                    ['stop', 'tool_calls'].includes(finishReason),
                    new ResponseInvalid('Abnormal finish reason', { cause: finishReason }),
                );
            }
        }
    }
}
