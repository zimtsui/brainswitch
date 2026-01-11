import assert from 'node:assert';
import OpenAI from 'openai';
import { Function } from '../function.ts';
import { type Engine, ResponseInvalid } from '../engine.ts';
import Ajv from 'ajv';

const ajv = new Ajv();



export class OpenAIResponsesUtilities<fdm extends Function.Declaration.Map> {
    protected inputPrice: number;
    protected cachedPrice: number;
    protected outputPrice: number;
    protected fdm: fdm;

    public constructor(
        options: Engine.Options<fdm>,
    ) {
        this.inputPrice = options.inputPrice ?? 0;
        this.outputPrice = options.outputPrice ?? 0;
        this.cachedPrice = options.cachePrice ?? this.inputPrice;
        this.fdm = options.functionDeclarationMap;
    }

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
        return	this.inputPrice * cacheMissTokenCount / 1e6 +
                this.cachedPrice * cacheHitTokenCount / 1e6 +
                this.outputPrice * usage.output_tokens / 1e6;
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
        const fditem = this.fdm[apifc.name] as Function.Declaration.Item.From<fdm> | undefined;
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
