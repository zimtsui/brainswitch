import OpenAI from 'openai';
import { Function } from '../../function.ts';
import { ResponseInvalid } from '../../engine.ts';
import Ajv from 'ajv';

const ajv = new Ajv();



export class ToolCodec<
    in out fdm extends Function.Decl.Map.Proto,
> {
    public constructor(protected ctx: ToolCodec.Context<fdm>) {}

    public encodeFunctionResponse(
        fr: Function.Response.From<fdm>,
    ): OpenAI.Responses.ResponseInputItem.FunctionCallOutput {
        if (fr.id) {} else throw new Error();
        return {
            type: 'function_call_output',
            call_id: fr.id,
            output: fr.text,
        };
    }

    protected encodeFunctionDeclarationEntry(
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

    public encodeFunctionDeclarationMap(fdm: fdm): OpenAI.Responses.FunctionTool[] {
        const fdentries = Object.entries(fdm) as Function.Decl.Entry.From<fdm>[];
        return fdentries.map(fdentry => this.encodeFunctionDeclarationEntry(fdentry));
    }

    public decodeFunctionCall(
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

    public encodeFunctionCall(
        fc: Function.Call.From<fdm>,
    ): OpenAI.Responses.ResponseFunctionToolCall {
        if (fc.id) {} else throw new Error();
        return {
            type: 'function_call',
            call_id: fc.id,
            name: fc.name,
            arguments: JSON.stringify(fc.args),
        };
    }
}

export namespace ToolCodec {
    export interface Context<in out fdm extends Function.Decl.Map.Proto> {
        fdm: fdm;
    }
}
