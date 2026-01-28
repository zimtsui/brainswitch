import { Engine, ResponseInvalid } from '../engine.ts';
import { Function } from '../function.ts';
import * as Google from '@google/genai';
import assert from 'node:assert';
import { CompatibleEngine } from '../compatible-engine.ts';
import Ajv from 'ajv';

const ajv = new Ajv();



export namespace GoogleEngine {
    export interface Base<in out fdm extends Function.Declaration.Map> {
        parallel: boolean;
        convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Google.FunctionCall;
        convertToFunctionCall(googlefc: Google.FunctionCall): Function.Call.Distributive<Function.Declaration.From<fdm>>;
        convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Google.FunctionDeclaration;
    }

    export interface Instance<in out fdm extends Function.Declaration.Map> extends
        Engine.Instance<fdm>,
        GoogleEngine.Base<fdm>
    {}

    export namespace Base {
        export class Instance<in out fdm extends Function.Declaration.Map> implements GoogleEngine.Base<fdm> {
            public parallel: boolean;

            public constructor(
                protected instance: GoogleEngine.Instance<fdm>,
                options: CompatibleEngine.Options<fdm>,
            ) {
                this.parallel = options.parallelToolCall ?? true;
                assert(this.parallel, new Error('Google API requires parallel tool calls.'));
            }

            public convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): Google.FunctionCall {
                return {
                    id: fc.id,
                    name: fc.name,
                    args: fc.args as Record<string, unknown>,
                };
            }

            public convertToFunctionCall(googlefc: Google.FunctionCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
                return GoogleEngine.convertToFunctionCall<fdm>(googlefc, this.instance.fdm);
            }

            public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): Google.FunctionDeclaration {
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

        }

    }

    export function convertToFunctionCall<fdm extends Function.Declaration.Map>(
        googlefc: Google.FunctionCall,
        fdm: fdm,
    ): Function.Call.Distributive<Function.Declaration.From<fdm>> {
        assert(googlefc.name);
        const fditem = fdm[googlefc.name] as Function.Declaration.Item.From<fdm> | undefined;
        assert(fditem, new ResponseInvalid('Unknown function call', { cause: googlefc }));
        assert(
            ajv.validate(fditem.paraschema, googlefc.args),
            new ResponseInvalid('Function call not conforming to schema', { cause: googlefc }),
        );
        return Function.Call.create({
            id: googlefc.id,
            name: googlefc.name,
            args: googlefc.args,
        } as Function.Call.create.Options<Function.Declaration.From<fdm>>);
    }
}
