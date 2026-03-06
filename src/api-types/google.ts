import { type Engine, ResponseInvalid } from '../engine.ts';
import { Function } from '../function.ts';
import * as Google from '@google/genai';
import Ajv from 'ajv';

const ajv = new Ajv();



export namespace GoogleEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends Engine.Options<fdm> {}

    export interface OwnProps {
        parallelToolCall: boolean;
    }
    export namespace OwnProps {
        export function init<fdm extends Function.Declaration.Map>(options: Options<fdm>): OwnProps {
            const parallelToolCall = options.parallelToolCall ?? true;
            if (parallelToolCall) {} else throw new Error('Google API requires parallel tool calls.');
            return {
                parallelToolCall,
            };
        }
    }

    export interface Underhood<in out fdm extends Function.Declaration.Map> extends
        Engine.Underhood<fdm>,
        OwnProps
    {
        convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Google.FunctionCall;
        convertToFunctionCall(googlefc: Google.FunctionCall): Function.Call.Distributive<Function.Declaration.From<fdm>>;
        convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Google.FunctionDeclaration;
    }

    export function convertFromFunctionCall<fdm extends Function.Declaration.Map>(
        this: GoogleEngine.Underhood<fdm>,
        fc: Function.Call.Distributive<Function.Declaration.From<fdm>>,
    ): Google.FunctionCall {
        return {
            id: fc.id,
            name: fc.name,
            args: fc.args as Record<string, unknown>,
        };
    }

    export function convertFromFunctionDeclarationEntry<fdm extends Function.Declaration.Map>(
        this: GoogleEngine.Underhood<fdm>,
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

    export function convertToFunctionCall<fdm extends Function.Declaration.Map>(
        this: GoogleEngine.Underhood<fdm>,
        googlefc: Google.FunctionCall,
    ): Function.Call.Distributive<Function.Declaration.From<fdm>> {
        if (googlefc.name) {} else throw new Error();
        const fditem = this.fdm[googlefc.name] as Function.Declaration.Item.From<fdm> | undefined;
        if (fditem) {} else throw new ResponseInvalid('Unknown function call', { cause: googlefc });
        if (ajv.validate(fditem.paraschema, googlefc.args)) {}
        else throw new ResponseInvalid('Function call not conforming to schema', { cause: googlefc });
        return Function.Call.create({
            id: googlefc.id,
            name: googlefc.name,
            args: googlefc.args,
        } as Function.Call.create.Options<Function.Declaration.From<fdm>>);
    }

    export interface RestfulRequest {
        contents: Google.Content[];
        tools?: Google.Tool[];
        toolConfig?: Google.ToolConfig;
        systemInstruction?: Google.Content;
        generationConfig?: Google.GenerationConfig;
    }

}
