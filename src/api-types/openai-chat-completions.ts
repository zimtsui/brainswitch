import { ResponseInvalid, type Engine } from '../engine.ts';
import { Function } from '../function.ts';
import OpenAI from 'openai';
import { Ajv } from 'ajv';


const ajv = new Ajv();


export namespace OpenAIChatCompletionsEngine {
    export interface Options<fdm extends Function.Declaration.Map> extends Engine.Options<fdm> {}

    export interface Base {
        parallel: boolean;
    }
    export namespace Base {
        export function create<fdm extends Function.Declaration.Map>(options: Options<fdm>): Base {
            return {
                parallel: options.parallelToolCall ?? false,
            };
        }
    }

    export interface Abstract<in out fdm extends Function.Declaration.Map> extends
        Engine.Abstract<fdm>,
        Base
    {
        convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionMessageToolCall;
        convertToFunctionCall(apifc: OpenAI.ChatCompletionMessageFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>>;
        convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionToolMessageParam;
        convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.ChatCompletionTool;
        convertFromToolChoice(mode: Function.ToolChoice<fdm>): OpenAI.ChatCompletionToolChoiceOption;
        calcCost(usage: OpenAI.CompletionUsage): number;
        extractContent(completionContent: string): string;
        handleFinishReason(completion: OpenAI.ChatCompletion, finishReason: OpenAI.ChatCompletion.Choice['finish_reason']): void;
    }

    export function convertFromFunctionCall<fdm extends Function.Declaration.Map>(
        fc: Function.Call.Distributive<Function.Declaration.From<fdm>>,
    ): OpenAI.ChatCompletionMessageToolCall {
        if (fc.id) {} else throw new Error();
        return {
            id: fc.id,
            type: 'function',
            function: {
                name: fc.name,
                arguments: JSON.stringify(fc.args),
            },
        };
    }

    export function convertToFunctionCall<fdm extends Function.Declaration.Map>(
        this: Engine.Abstract<fdm>,
        apifc: OpenAI.ChatCompletionMessageFunctionToolCall,
    ): Function.Call.Distributive<Function.Declaration.From<fdm>> {
        const fditem = this.fdm[apifc.function.name] as Function.Declaration.Item.From<fdm>;
        if (fditem) {} else throw new ResponseInvalid('Unknown function call', { cause: apifc });
        const args = (() => {
            try {
                return JSON.parse(apifc.function.arguments);
            } catch (e) {
                return new ResponseInvalid('Invalid JSON of function call', { cause: apifc });
            }
        })();
        if (ajv.validate(fditem.paraschema, args)) {}
        else throw new ResponseInvalid('Invalid function arguments', { cause: apifc });
        return Function.Call.create({
            id: apifc.id,
            name: apifc.function.name,
            args,
        } as Function.Call.create.Options<Function.Declaration.From<fdm>>);
    }


    export function convertFromFunctionResponse<fdm extends Function.Declaration.Map>(
        fr: Function.Response.Distributive<Function.Declaration.From<fdm>>,
    ): OpenAI.ChatCompletionToolMessageParam {
        if (fr.id) {} else throw new Error();
        return {
            role: 'tool',
            tool_call_id: fr.id,
            content: fr.text,
        };
    }

    export function convertFromFunctionDeclarationEntry<fdm extends Function.Declaration.Map>(
        fdentry: Function.Declaration.Entry.From<fdm>,
    ): OpenAI.ChatCompletionTool {
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

    export function convertFromToolChoice<fdm extends Function.Declaration.Map>(
        toolChoice: Function.ToolChoice<fdm>,
    ): OpenAI.ChatCompletionToolChoiceOption {
        if (toolChoice === Function.ToolChoice.NONE) return 'none';
        else if (toolChoice === Function.ToolChoice.REQUIRED) return 'required';
        else if (toolChoice === Function.ToolChoice.AUTO) return 'auto';
        else {
            if (toolChoice.length === 1) {} else throw new Error();
            return { type: 'function', function: { name: toolChoice[0]! } };
        }
    }

    export function calcCost<fdm extends Function.Declaration.Map>(
        this: Engine.Abstract<fdm>,
        usage: OpenAI.CompletionUsage,
    ): number {
        const cacheHitTokenCount = usage.prompt_tokens_details?.cached_tokens ?? 0;
        const cacheMissTokenCount = usage.prompt_tokens - cacheHitTokenCount;
        return	this.inputPrice * cacheMissTokenCount / 1e6 +
                this.cachedPrice * cacheHitTokenCount / 1e6 +
                this.outputPrice * usage.completion_tokens / 1e6;
    }

    export function extractContent(completionContent: string): string {
        return completionContent;
    }

    export function handleFinishReason(completion: OpenAI.ChatCompletion, finishReason: OpenAI.ChatCompletion.Choice['finish_reason']): void {
        if (finishReason === 'length')
            throw new ResponseInvalid('Token limit exceeded.', { cause: completion });
        if (['stop', 'tool_calls'].includes(finishReason)) {}
        else throw new ResponseInvalid('Abnormal finish reason', { cause: finishReason });
    }
}
