import { ResponseInvalid } from '#@/engine.ts';
import { Function } from '#@/function.ts';
import * as Google from '@google/genai';
import Ajv from 'ajv';

const ajv = new Ajv();



export class GoogleToolCodec<in out fdm extends Function.Declaration.Map> {
    public constructor(protected ctx: GoogleToolCodec.Context<fdm>) {}

    public convertFromFunctionCall(
        fc: Function.Call.From<fdm>,
    ): Google.FunctionCall {
        return {
            id: fc.id,
            name: fc.name,
            args: fc.args as Record<string, unknown>,
        };
    }

    public convertFromFunctionDeclarationMap(fdm: fdm): Google.FunctionDeclaration[] {
        const fdentries = Object.entries(fdm) as Function.Declaration.Entry.From<fdm>[];
        return fdentries.map(fdentry => this.convertFromFunctionDeclarationEntry(fdentry));
    }

    protected convertFromFunctionDeclarationEntry(
        fdentry: Function.Declaration.Entry.From<fdm>,
    ): Google.FunctionDeclaration {
        const json = JSON.stringify(fdentry[1].paraschema);
        const parsed = JSON.parse(json, (key, value) => {
            if (key === 'type' && typeof value === 'string') {
                if (value === 'string') return Google.Type.STRING;
                else if (value === 'number') return Google.Type.NUMBER;
                else if (value === 'boolean') return Google.Type.BOOLEAN;
                else if (value === 'object') return Google.Type.OBJECT;
                else if (value === 'array') return Google.Type.ARRAY;
                else throw new Error();
            } else if (key === 'additionalProperties' && typeof value === 'boolean')
                return;
            else return value;
        }) as Google.Schema;
        return {
            name: fdentry[0],
            description: fdentry[1].description,
            parameters: parsed,
        };
    }

    public convertToFunctionCall(
        googlefc: Google.FunctionCall,
    ): Function.Call.From<fdm> {
        if (googlefc.name) {} else throw new Error();
        const fditem = this.ctx.fdm[googlefc.name] as Function.Declaration.Item.From<fdm> | undefined;
        if (fditem) {} else throw new ResponseInvalid('Unknown function call', { cause: googlefc });
        if (ajv.validate(fditem.paraschema, googlefc.args)) {}
        else throw new ResponseInvalid('Function call not conforming to schema', { cause: googlefc });
        return Function.Call.create({
            id: googlefc.id,
            name: googlefc.name,
            args: googlefc.args,
        } as Function.Call.create.Options<fdm>);
    }

    public convertFromToolChoice(
        toolChoice: Function.ToolChoice<fdm>,
    ): Google.FunctionCallingConfig {
        if (toolChoice === Function.ToolChoice.NONE) return { mode: Google.FunctionCallingConfigMode.NONE };
        else if (toolChoice === Function.ToolChoice.REQUIRED) return { mode: Google.FunctionCallingConfigMode.ANY };
        else if (toolChoice === Function.ToolChoice.AUTO) return { mode: Google.FunctionCallingConfigMode.AUTO };
        else return { mode: Google.FunctionCallingConfigMode.ANY, allowedFunctionNames: [...toolChoice] };
    }
}


export namespace GoogleToolCodec {
    export interface Context<in out fdm extends Function.Declaration.Map> {
        fdm: fdm;
    }
}
