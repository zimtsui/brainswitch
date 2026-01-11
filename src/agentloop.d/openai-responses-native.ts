import { type InferenceContext } from '../inference-context.ts';
import { RoleMessage, type Session } from '../native-engine.d/openai-responses/session.ts';
import { Function } from '../function.ts';
import assert from 'node:assert';
import { Tool } from '../native-engine.d/openai-responses/tool.ts';
import { OpenAIResponsesNativeEngine } from '../native-engine.d/openai-responses.ts';


/**
 * @param session mutable
 */
export async function *agentloop<fdm extends Function.Declaration.Map>(
    ctx: InferenceContext,
    session: Session<Function.Declaration.From<fdm>>,
    engine: OpenAIResponsesNativeEngine<fdm>,
    tlm: Tool.Map<fdm>,
    limit = Number.POSITIVE_INFINITY,
): AsyncGenerator<string, string, void> {
    type fdu = Function.Declaration.From<fdm>;
    for (let i = 0; i < limit; i++) {
        const response = await engine.stateful(ctx, session);
        const tcs = response.getToolCalls();
        if (!tcs.length) return response.getOnlyText();
        const ptcs: Promise<Tool.Response<fdu>>[] = [];
        for (const part of response.getParts()) {
            if (part instanceof RoleMessage.Part.Text.Constructor) {
                yield part.text;
            } else if (part instanceof Function.Call) {
                const fc = part as Function.Call.Distributive<fdu>;
                const f = tlm[fc.name];
                assert(f);
                ptcs.push((async () => {
                    return Function.Response.create<fdu>({
                        id: fc.id,
                        name: fc.name,
                        text: await f.call(tlm, fc.args),
                    } as Function.Response.create.Options<fdu>);
                })());
            } else if (part instanceof Tool.ApplyPatch.Call) {
                const apc: Tool.ApplyPatch.Call = part;
                const tl = tlm[Tool.Choice.APPLY_PATCH];
                assert(tl);
                ptcs.push((async () => {
                    return Tool.ApplyPatch.Response.create({
                        id: apc.raw.call_id,
                        failure: await tl.call(tlm, apc.raw.operation),
                    });
                })());
            } else throw new Error();
        }
        const trs = await Promise.all(ptcs);
        engine.pushUserMessage(session, RoleMessage.User.create<fdu>(trs));
    }
    throw new agentloop.FunctionCallLimitExceeded('Function call limit exceeded.');
}

export namespace agentloop {
    export class FunctionCallLimitExceeded extends Error {}
}
