import assert from 'node:assert';
import OpenAI from 'openai';
import { Function } from '../function.ts';
import { ResponseInvalid } from '../engine.ts';
import Ajv from 'ajv';
import { type Engine } from '../engine.ts';

const ajv = new Ajv();



export namespace OpenAIResponsesEngine {

    export interface Base<in out fdm extends Function.Declaration.Map> {
        convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInputItem.FunctionCallOutput;
        calcCost(usage: OpenAI.Responses.ResponseUsage): number;
        convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.Responses.FunctionTool;
        convertToFunctionCall(apifc: OpenAI.Responses.ResponseFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>>;
    }

    export interface Instance<in out fdm extends Function.Declaration.Map> extends
        Engine.Instance<fdm>,
        OpenAIResponsesEngine.Base<fdm>
    {}

    export namespace Base {
        export class Instance<fdm extends Function.Declaration.Map> {
            public constructor(protected instance: OpenAIResponsesEngine.Instance<fdm>) {}

            public convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.Responses.ResponseInputItem.FunctionCallOutput {
                assert(fr.id);
                return {
                    type: 'function_call_output',
                    call_id: fr.id,
                    output: fr.text,
                };
            }

            public calcCost(usage: OpenAI.Responses.ResponseUsage): number {
                const cacheHitTokenCount = usage.input_tokens_details.cached_tokens;
                const cacheMissTokenCount = usage.input_tokens - cacheHitTokenCount;
                return	this.instance.inputPrice * cacheMissTokenCount / 1e6 +
                        this.instance.cachedPrice * cacheHitTokenCount / 1e6 +
                        this.instance.outputPrice * usage.output_tokens / 1e6;
            }

            public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.Responses.FunctionTool {
                return {
                    name: fdentry[0],
                    description: fdentry[1].description,
                    parameters: fdentry[1].paraschema,
                    strict: true,
                    type: 'function',
                };
            }

            public convertToFunctionCall(
                apifc: OpenAI.Responses.ResponseFunctionToolCall,
            ): Function.Call.Distributive<Function.Declaration.From<fdm>> {
                const fditem = this.instance.fdm[apifc.name] as Function.Declaration.Item.From<fdm> | undefined;
                assert(fditem, new ResponseInvalid('Unknown function call', { cause: apifc }));
                const args = (() => {
                    try {
                        return JSON.parse(apifc.arguments);
                    } catch (e) {
                        return new ResponseInvalid('Invalid JSON of function call', { cause: apifc });
                    }
                })();
                assert(
                    ajv.validate(fditem.paraschema, args),
                    new ResponseInvalid('Function call not conforming to schema', { cause: apifc }),
                );
                return Function.Call.create({
                    id: apifc.call_id,
                    name: apifc.name,
                    args,
                } as Function.Call.create.Options<Function.Declaration.From<fdm>>);
            }
        }
    }
}
