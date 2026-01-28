import { Function } from '../function.ts';
import { Engine, ResponseInvalid } from '../engine.ts';
import Anthropic from '@anthropic-ai/sdk';
import assert from 'node:assert';
import Ajv from 'ajv';
import { type TObject } from '@sinclair/typebox';

const ajv = new Ajv();



export namespace AnthropicEngine {
    export interface Base<fdm extends Function.Declaration.Map> {
        anthropic: Anthropic;
        parallel: boolean;
        convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Anthropic.ToolUseBlock;
        convertToFunctionCall(apifc: Anthropic.ToolUseBlock): Function.Call.Distributive<Function.Declaration.From<fdm>>;
        convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): Anthropic.ToolResultBlockParam;
        convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Anthropic.Tool;
        convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>, parallel: boolean): Anthropic.ToolChoice;
        calcCost(usage: Anthropic.Usage): number;
    }

    export interface Instance<fdm extends Function.Declaration.Map> extends
        Engine.Instance<fdm>,
        AnthropicEngine.Base<fdm>
    {}

    export namespace Base {

        export class Instance<in out fdm extends Function.Declaration.Map> implements AnthropicEngine.Base<fdm> {
            public anthropic: Anthropic;
            public parallel: boolean;

            public constructor(
                protected instance: AnthropicEngine.Instance<fdm>,
                options: AnthropicEngine.Options<fdm>,
            ) {
                this.parallel = options.parallelToolCall ?? false;
                this.anthropic = new Anthropic({
                    baseURL: this.instance.baseUrl,
                    apiKey: this.instance.apiKey,
                    fetchOptions: { dispatcher: this.instance.proxyAgent },
                });
            }

            public convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Anthropic.ToolUseBlock {
                assert(fc.id);
                return {
                    type: 'tool_use',
                    id: fc.id,
                    name: fc.name,
                    input: fc.args,
                };
            }

            public convertToFunctionCall(apifc: Anthropic.ToolUseBlock): Function.Call.Distributive<Function.Declaration.From<fdm>> {
                const fditem = this.instance.fdm[apifc.name] as Function.Declaration.Item.From<fdm> | undefined;
                assert(fditem, new ResponseInvalid('Unknown function call', { cause: apifc }));
                const args = (() => {
                    try {
                        return JSON.parse(apifc.input as string);
                    } catch (e) {
                        return new ResponseInvalid('Invalid JSON of function call', { cause: apifc });
                    }
                })();
                assert(
                    ajv.validate(fditem.paraschema, args),
                    new ResponseInvalid('Function call not conforming to schema', { cause: apifc }),
                );
                return Function.Call.create({
                    id: apifc.id,
                    name: apifc.name,
                    args,
                } as Function.Call.create.Options<Function.Declaration.From<fdm>>);
            }

            public convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): Anthropic.ToolResultBlockParam {
                assert(fr.id);
                return {
                    type: 'tool_result',
                    tool_use_id: fr.id,
                    content: fr.text,
                };
            }

            public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Anthropic.Tool {
                return {
                    name: fdentry[0],
                    description: fdentry[1].description,
                    input_schema: fdentry[1].paraschema as TObject,
                };
            }

            public convertFromToolChoice(toolChoice: Function.ToolChoice<fdm>, parallel: boolean): Anthropic.ToolChoice {
                if (toolChoice === Function.ToolChoice.NONE) return { type: 'none' };
                else if (toolChoice === Function.ToolChoice.REQUIRED) return { type: 'any', disable_parallel_tool_use: !parallel };
                else if (toolChoice === Function.ToolChoice.AUTO) return { type: 'auto', disable_parallel_tool_use: !parallel };
                else {
                    assert(toolChoice.length === 1);
                    return { type: 'tool', name: toolChoice[0]!, disable_parallel_tool_use: !parallel };
                }
            }

            public calcCost(usage: Anthropic.Usage): number {
                const cacheHitTokenCount = usage.cache_read_input_tokens || 0;
                const cacheMissTokenCount = usage.input_tokens - cacheHitTokenCount;
                return	this.instance.inputPrice * cacheMissTokenCount / 1e6 +
                        this.instance.cachedPrice * cacheHitTokenCount / 1e6 +
                        this.instance.outputPrice * usage.output_tokens / 1e6;
            }

        }
    }

    export interface Options<fdm extends Function.Declaration.Map> extends Engine.Options<fdm> {}
}
