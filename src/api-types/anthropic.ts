import { Function } from '../function.ts';
import { type Engine, ResponseInvalid } from '../engine.ts';
import Anthropic from '@anthropic-ai/sdk';
import Ajv from 'ajv';
import { type TObject } from '@sinclair/typebox';

const ajv = new Ajv();



export namespace AnthropicEngine {
    export interface Options<fdm extends Function.Declaration.Map> extends Engine.Options<fdm> {}

    export interface OwnProps {
        parallel: boolean;
        anthropic: Anthropic,
    }
    export interface ParentProps<fdm extends Function.Declaration.Map> extends Engine.Underhood<fdm> {}
    export namespace OwnProps {
        export function init<fdm extends Function.Declaration.Map>(
            this: ParentProps<fdm>,
            options: Options<fdm>,
        ): OwnProps {
            return {
                parallel: options.parallelToolCall ?? false,
                anthropic: new Anthropic({
                    baseURL: this.baseUrl,
                    apiKey: this.apiKey,
                    fetchOptions: { dispatcher: this.proxyAgent },
                }),
            };
        }
    }

    export interface Underhood<fdm extends Function.Declaration.Map> extends
        ParentProps<fdm>,
        OwnProps
    {
        parallelToolCall: boolean;
        convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Anthropic.ToolUseBlock;
        convertToFunctionCall(apifc: Anthropic.ToolUseBlock): Function.Call.Distributive<Function.Declaration.From<fdm>>;
        convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): Anthropic.ToolResultBlockParam;
        convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Anthropic.Tool;
        convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>, parallel: boolean): Anthropic.ToolChoice;
        calcCost(usage: Anthropic.Usage): number;
    }


    export function convertFromFunctionCall<fdm extends Function.Declaration.Map>(
        fc: Function.Call.Distributive<Function.Declaration.From<fdm>>,
    ): Anthropic.ToolUseBlock {
        throw new Error('Anthropic compatible engine requires native function calls.');
    }

    export function convertToFunctionCall<fdm extends Function.Declaration.Map>(
        this: Engine.Underhood<fdm>,
        apifc: Anthropic.ToolUseBlock,
    ): Function.Call.Distributive<Function.Declaration.From<fdm>> {
        const fditem = this.fdm[apifc.name] as Function.Declaration.Item.From<fdm> | undefined;
        if (fditem) {} else throw new ResponseInvalid('Unknown function call', { cause: apifc });
        const args = (() => {
            try {
                return JSON.parse(apifc.input as string);
            } catch (e) {
                throw new ResponseInvalid('Invalid JSON of function call', { cause: apifc });
            }
        })();
        if (ajv.validate(fditem.paraschema, args)) {}
        else throw new ResponseInvalid('Function call not conforming to schema', { cause: apifc });
        return Function.Call.create({
            id: apifc.id,
            name: apifc.name,
            args,
        } as Function.Call.create.Options<Function.Declaration.From<fdm>>);
    }

    export function convertFromFunctionResponse<fdm extends Function.Declaration.Map>(
        fr: Function.Response.Distributive<Function.Declaration.From<fdm>>,
    ): Anthropic.ToolResultBlockParam {
        if (fr.id) {} else throw new Error();
        return {
            type: 'tool_result',
            tool_use_id: fr.id,
            content: fr.text,
        };
    }

    export function convertFromFunctionDeclarationEntry<fdm extends Function.Declaration.Map>(
        fdentry: Function.Declaration.Entry.From<fdm>,
    ): Anthropic.Tool {
        return {
            name: fdentry[0],
            description: fdentry[1].description,
            input_schema: fdentry[1].paraschema as TObject,
        };
    }

    export function convertFromToolChoice<fdm extends Function.Declaration.Map>(
        toolChoice: Function.ToolChoice<fdm>,
        parallel: boolean,
    ): Anthropic.ToolChoice {
        if (toolChoice === Function.ToolChoice.NONE) return { type: 'none' };
        else if (toolChoice === Function.ToolChoice.REQUIRED) return { type: 'any', disable_parallel_tool_use: !parallel };
        else if (toolChoice === Function.ToolChoice.AUTO) return { type: 'auto', disable_parallel_tool_use: !parallel };
        else {
            if (toolChoice.length === 1) {} else throw new Error();
            return { type: 'tool', name: toolChoice[0]!, disable_parallel_tool_use: !parallel };
        }
    }

    export function calcCost<fdm extends Function.Declaration.Map>(
        this: Engine.Underhood<fdm>,
        usage: Anthropic.Usage,
    ): number {
        const cacheHitTokenCount = usage.cache_read_input_tokens || 0;
        const cacheMissTokenCount = usage.input_tokens - cacheHitTokenCount;
        return	this.inputPrice * cacheMissTokenCount / 1e6 +
                this.cachePrice * cacheHitTokenCount / 1e6 +
                this.outputPrice * usage.output_tokens / 1e6;
    }

    export interface Options<fdm extends Function.Declaration.Map> extends Engine.Options<fdm> {}
}
