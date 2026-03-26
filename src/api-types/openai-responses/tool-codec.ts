import OpenAI from 'openai';
import { Function } from '#@/function.ts';
import { ResponseInvalid } from '#@/engine.ts';
import Ajv from 'ajv';

const ajv = new Ajv();



export class ToolCodec<
    in out fdm extends Function.Decl.Map.Proto,
> {
    public constructor(protected ctx: ToolCodec.Context<fdm>) {}

    public convertFromFunctionResponse(
        fr: Function.Response.From<fdm>,
    ): OpenAI.Responses.ResponseInputItem.FunctionCallOutput {
        if (fr.id) {} else throw new Error();
        return {
            type: 'function_call_output',
            call_id: fr.id,
            output: fr.text,
        };
    }

    protected convertFromFunctionDeclarationEntry(
        fdentry: Function.Decl.Entry.From<fdm>,
    ): OpenAI.Responses.FunctionTool {
        return {
            name: fdentry[0],
            description: fdentry[1].description,
            parameters: fdentry[1].parameters,
            strict: true,
            type: 'function',
        };
    }

    public convertFromFunctionDeclarationMap(fdm: fdm): OpenAI.Responses.FunctionTool[] {
        const fdentries = Object.entries(fdm) as Function.Decl.Entry.From<fdm>[];
        return fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry));
    }

    public convertToFunctionCall(
        apifc: OpenAI.Responses.ResponseFunctionToolCall,
    ): Function.Call.From<fdm> {
        const fditem = this.ctx.fdm[apifc.name];
        if (fditem) {} else throw new ResponseInvalid('Unknown function call', { cause: apifc });
        const args = (() => {
            try {
                return JSON.parse(apifc.arguments);
            } catch (e) {
                throw new ResponseInvalid('Invalid JSON of function call', { cause: apifc });
            }
        })();
        if (ajv.validate(fditem.parameters, args)) {}
        else throw new ResponseInvalid('Function call not conforming to schema', { cause: apifc });
        return Function.Call.of({
            id: apifc.call_id,
            name: apifc.name,
            args,
        } as Function.Call.Options.From<fdm>);
    }
}

export namespace ToolCodec {
    export interface Context<in out fdm extends Function.Decl.Map.Proto> {
        fdm: fdm;
    }
}
