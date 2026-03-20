import { Function } from '#@/function.ts';
import OpenAI from 'openai';
import { ResponseInvalid } from '#@/engine.ts';
import Ajv from 'ajv';

const ajv = new Ajv();


export class OpenAIChatCompletionsToolCodec<in out fdm extends Function.Declaration.Map> {
    public constructor(protected ctx: OpenAIChatCompletionsToolCodec.Context<fdm>) {}


    public convertFromFunctionCall(
        fc: Function.Call.From<fdm>,
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

    public convertToFunctionCall(
        apifc: OpenAI.ChatCompletionMessageFunctionToolCall,
    ): Function.Call.From<fdm> {
        const fditem = this.ctx.fdm[apifc.function.name] as Function.Declaration.Item.From<fdm>;
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
        } as Function.Call.create.Options<fdm>);
    }


    public convertFromFunctionResponse(
        fr: Function.Response.Distributive<fdm>,
    ): OpenAI.ChatCompletionToolMessageParam {
        if (fr.id) {} else throw new Error();
        return {
            role: 'tool',
            tool_call_id: fr.id,
            content: fr.text,
        };
    }

    protected convertFromFunctionDeclarationEntry(
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

    public convertFromFunctionDeclarationMap(fdm: fdm): OpenAI.ChatCompletionTool[] {
        const fdentries = Object.entries(fdm) as Function.Declaration.Entry.From<fdm>[];
        return fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry));
    }

    public convertFromToolChoice(
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

}

export namespace OpenAIChatCompletionsToolCodec {
    export interface Context<in out fdm extends Function.Declaration.Map> {
        parallelToolCall: boolean;
        fdm: fdm;
    }
}
