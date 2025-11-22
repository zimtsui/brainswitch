import { type InferenceContext } from './inference-context.ts';
import { RoleMessage, type Session } from './session.ts';
import { Function } from './function.ts';
import { type Engine } from './engine.ts';
import assert from 'node:assert';


/**
 * @param session mutable
 */
export async function *agentloop<fdm extends Function.Declaration.Map, session extends unknown = Session<Function.Declaration.From<fdm>>>(
    ctx: InferenceContext,
    session: session,
    engine: Engine<Function.Declaration.From<fdm>, session>,
    functionMap: Function.Map<fdm>,
    limit = Number.POSITIVE_INFINITY,
): AsyncGenerator<string, string, void> {
    type fdu = Function.Declaration.From<fdm>;
    for (let i = 0; i < limit; i++) {
        const response = await engine.stateful(ctx, session);
        const fcs = response.getFunctionCalls();
        if (!fcs.length) return response.getOnlyText();
        const pfrs: Promise<Function.Response.Distributive<fdu>>[] = [];
        for (const part of response.parts) {
            if (part instanceof RoleMessage.Part.Text.Constructor) {
                yield part.text;
            } else if (part instanceof Function.Call) {
                const fc = part as Function.Call.Distributive<fdu>;
                const f = functionMap[fc.name];
                assert(f);
                pfrs.push((async () => {
                    return Function.Response.create<fdu>({
                        id: fc.id,
                        name: fc.name,
                        text: await f(fc.args),
                    } as Function.Response.create.Options<fdu>);
                })());
            } else throw new Error();
        }
        const frs = await Promise.all(pfrs);
        engine.appendUserMessage(session, RoleMessage.User.create<fdu>(frs));
    }
    throw new agentloop.FunctionCallLimitExceeded('Function call limit exceeded.');
}

export namespace agentloop {
    export class FunctionCallLimitExceeded extends Error {}
}
