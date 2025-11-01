import { type InferenceContext } from './inference-context.ts';
import { RoleMessage, type Session } from './session.ts';
import { Function } from './function.ts';
import { Engine } from './engine.ts';
import assert from 'node:assert';


/**
 * @param session mutable
 */
export async function *agentloop<fdm extends Function.Declaration.Map>(
    ctx: InferenceContext,
    session: Session<Function.Declaration.From<fdm>>,
    engine: Engine<Function.Declaration.From<fdm>>,
    functionMap: Function.Map<fdm>,
    limit = Number.POSITIVE_INFINITY,
): AsyncGenerator<string, void, void> {
    for (let i = 0; i < limit; i++) {
        const response = await Engine.apply(ctx, session, engine);
        const fcs = response.getFunctionCalls();
        if (fcs.length) {
            const parts: Function.Response.Distributive<Function.Declaration.From<fdm>>[] = [];
            for (const part of response.parts) {
                if (part instanceof RoleMessage.Part.Text.Constructor) {
                    yield part.text;
                } else if (part instanceof Function.Call) {
                    const fc = part as Function.Call.Distributive<Function.Declaration.From<fdm>>;
                    const f = functionMap[fc.name];
                    assert(f);
                    const text = await f(fc.args);
                    ctx.logger.message?.debug('\n'+text);
                    const fr = Function.Response.create({
                        id: fc.id,
                        name: fc.name,
                        text,
                    } as Function.Response.create.Options<Function.Declaration.From<fdm>>);
                    parts.push(fr);
                } else throw new Error();
            }
            session.chatMessages.push(RoleMessage.User.create<Function.Declaration.From<fdm>>(parts));
        } else return yield response.getOnlyText();
    }
    throw new agentloop.FunctionCallLimitExceeded('Function call limit exceeded.');
}

export namespace agentloop {
    export class FunctionCallLimitExceeded extends Error {}
}
