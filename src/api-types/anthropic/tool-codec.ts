import { Function } from '../../function.ts';
import { ResponseInvalid } from '../../engine.ts';
import Anthropic from '@anthropic-ai/sdk';
import Ajv from 'ajv';
import { type TObject } from '@sinclair/typebox';

const ajv = new Ajv();


export class ToolCodec<in out fdm extends Function.Decl.Map.Proto> {
    public constructor(protected ctx: ToolCodec.Context<fdm>) {}

    public encodeFunctionCall(
        fc: Function.Call.From<fdm>,
    ): Anthropic.ToolUseBlock {
        throw new Error('Anthropic compatible engine requires native function calls.');
    }

    public decodeFunctionCall(
        apifc: Anthropic.ToolUseBlock,
    ): Function.Call.From<fdm> {
        const fditem = this.ctx.fdm[apifc.name];
        if (fditem) {} else throw new ResponseInvalid('Unknown function call', { cause: apifc });
        if (typeof apifc.input === 'string') {} else throw new Error();
        const args = (() => {
            try {
                return JSON.parse(apifc.input);
            } catch {
                throw new ResponseInvalid('Invalid JSON of function call', { cause: apifc });
            }
        })();
        if (ajv.validate(fditem.parameters, args)) {}
        else throw new ResponseInvalid('Function call not conforming to schema', { cause: apifc });
        return Function.Call.of({
            id: apifc.id,
            name: apifc.name,
            args,
        } as Function.Call.Options.From<fdm>);
    }

    public encodeFunctionResponse(
        fr: Function.Response.From<fdm>,
    ): Anthropic.ToolResultBlockParam {
        if (fr.id) {} else throw new Error();
        if (fr instanceof Function.Response.Successful)
            return {
                type: 'tool_result',
                tool_use_id: fr.id,
                content: fr.text,
            };
        else if (fr instanceof Function.Response.Failed)
            return {
                type: 'tool_result',
                tool_use_id: fr.id,
                content: fr.error,
            };
        else throw new Error();
    }

    protected encodeFunctionDeclarationEntry(
        fdentry: Function.Decl.Entry.From<fdm>,
    ): Anthropic.Tool {
        return {
            name: fdentry[0],
            description: fdentry[1].description,
            input_schema: fdentry[1].parameters as TObject,
        };
    }

    public encodeFunctionDeclarationMap(
        fdm: fdm,
    ): Anthropic.Tool[] {
        const fdentries = Object.entries(fdm) as Function.Decl.Entry.From<fdm>[];

        return fdentries.map(fdentry => this.encodeFunctionDeclarationEntry(fdentry));
    }

}

export namespace ToolCodec {
    export interface Context<in out fdm extends Function.Decl.Map.Proto> {
        fdm: fdm;
    }
}
