import { Function } from '#@/function.ts';
import { ResponseInvalid } from '#@/engine.ts';
import Anthropic from '@anthropic-ai/sdk';
import Ajv from 'ajv';
import { type TObject } from '@sinclair/typebox';

const ajv = new Ajv();


export class AnthropicToolCodec<in out fdm extends Function.Declaration.Map.Prototype> {
    public constructor(protected ctx: AnthropicToolCodec.Context<fdm>) {}

    public convertFromFunctionCall(
        fc: Function.Call.From<fdm>,
    ): Anthropic.ToolUseBlock {
        throw new Error('Anthropic compatible engine requires native function calls.');
    }

    public convertToFunctionCall(
        apifc: Anthropic.ToolUseBlock,
    ): Function.Call.From<fdm> {
        const fditem = this.ctx.fdm[apifc.name];
        if (fditem) {} else throw new ResponseInvalid('Unknown function call', { cause: apifc });
        const args = (() => {
            try {
                return JSON.parse(apifc.input as string);
            } catch {
                throw new ResponseInvalid('Invalid JSON of function call', { cause: apifc });
            }
        })();
        if (ajv.validate(fditem.paraschema, args)) {}
        else throw new ResponseInvalid('Function call not conforming to schema', { cause: apifc });
        return Function.Call.create({
            id: apifc.id,
            name: apifc.name,
            args,
        } as Function.Call.Options.From<fdm>);
    }

    public convertFromFunctionResponse(
        fr: Function.Response.From<fdm>,
    ): Anthropic.ToolResultBlockParam {
        if (fr.id) {} else throw new Error();
        return {
            type: 'tool_result',
            tool_use_id: fr.id,
            content: fr.text,
        };
    }

    protected convertFromFunctionDeclarationEntry(
        fdentry: Function.Declaration.Entry.From<fdm>,
    ): Anthropic.Tool {
        return {
            name: fdentry[0],
            description: fdentry[1].description,
            input_schema: fdentry[1].paraschema as TObject,
        };
    }

    public convertFromFunctionDeclarationMap(
        fdm: fdm,
    ): Anthropic.Tool[] {
        const fdentries = Object.entries(fdm) as Function.Declaration.Entry.From<fdm>[];

        return fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry));
    }

    public convertFromToolChoice(
        toolChoice: Function.ToolChoice.From<fdm>,
        parallelToolCall: boolean,
    ): Anthropic.ToolChoice {
        if (toolChoice === Function.ToolChoice.NONE) return { type: 'none' };
        else if (toolChoice === Function.ToolChoice.REQUIRED) return { type: 'any', disable_parallel_tool_use: !parallelToolCall };
        else if (toolChoice === Function.ToolChoice.AUTO) return { type: 'auto', disable_parallel_tool_use: !parallelToolCall };
        else {
            if (toolChoice.length === 1) {} else throw new Error();
            return { type: 'tool', name: toolChoice[0]!, disable_parallel_tool_use: !parallelToolCall };
        }
    }
}

export namespace AnthropicToolCodec {
    export interface Context<in out fdm extends Function.Declaration.Map.Prototype> {
        fdm: fdm;
    }
}
