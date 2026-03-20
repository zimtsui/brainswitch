import OpenAI from 'openai';
import { Function } from '#@/function.ts';
import { ResponseInvalid } from '#@/engine.ts';
import Ajv from 'ajv';

const ajv = new Ajv();



export class OpenAIResponsesToolCodec<in out fdm extends Function.Declaration.Map> {
    public constructor(protected ctx: OpenAIResponsesToolCodec.Context<fdm>) {}

    public convertFromFunctionResponse(
        fr: Function.Response.Distributive<Function.Declaration.From<fdm>>,
    ): OpenAI.Responses.ResponseInputItem.FunctionCallOutput {
        if (fr.id) {} else throw new Error();
        return {
            type: 'function_call_output',
            call_id: fr.id,
            output: fr.text,
        };
    }

    protected convertFromFunctionDeclarationEntry(
        fdentry: Function.Declaration.Entry.From<fdm>,
    ): OpenAI.Responses.FunctionTool {
        return {
            name: fdentry[0],
            description: fdentry[1].description,
            parameters: fdentry[1].paraschema,
            strict: true,
            type: 'function',
        };
    }

    public convertFromFunctionDeclarationMap(fdm: fdm): OpenAI.Responses.FunctionTool[] {
        const fdentries = Object.entries(fdm) as Function.Declaration.Entry.From<fdm>[];
        return fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry));
    }

    public convertFromToolChoice(
        toolChoice: Function.ToolChoice<fdm>,
    ): OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceAllowed {
        if (toolChoice === Function.ToolChoice.NONE) return 'none';
        else if (toolChoice === Function.ToolChoice.REQUIRED) return 'required';
        else if (toolChoice === Function.ToolChoice.AUTO) return 'auto';
        else {
            return {
                type: 'allowed_tools',
                mode: 'required',
                tools: toolChoice.map(name => ({ type: 'function', name }) satisfies OpenAI.Responses.ToolChoiceFunction),
            };
        }
    }

    public convertToFunctionCall(
        apifc: OpenAI.Responses.ResponseFunctionToolCall,
    ): Function.Call.Distributive<Function.Declaration.From<fdm>> {
        const fditem = this.ctx.fdm[apifc.name] as Function.Declaration.Item.From<fdm> | undefined;
        if (fditem) {} else throw new ResponseInvalid('Unknown function call', { cause: apifc });
        const args = (() => {
            try {
                return JSON.parse(apifc.arguments);
            } catch (e) {
                throw new ResponseInvalid('Invalid JSON of function call', { cause: apifc });
            }
        })();
        if (ajv.validate(fditem.paraschema, args)) {}
        else throw new ResponseInvalid('Function call not conforming to schema', { cause: apifc });
        return Function.Call.create({
            id: apifc.call_id,
            name: apifc.name,
            args,
        } as Function.Call.create.Options<Function.Declaration.From<fdm>>);
    }
}

export namespace OpenAIResponsesToolCodec {
    export interface Context<in out fdm extends Function.Declaration.Map> {
        fdm: fdm;
    }
}
