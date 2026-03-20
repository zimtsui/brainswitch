import { type InferenceContext } from '#@/inference-context.ts';
import { RoleMessage, type Session } from '#@/native-engines.d/openai-responses/session.ts';
import { Function } from '#@/function.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';
import { OpenAIResponsesNativeEngine } from '#@/native-engines.d/openai-responses/engine.ts';
import * as CompatibleAgentloopModule from '#@/agentloop.ts';


/**
 * @param session mutable
 */
export async function *agentloop<fdm extends Function.Declaration.Map>(
    wfctx: InferenceContext,
    session: Session<fdm>,
    engine: OpenAIResponsesNativeEngine<fdm>,
    tlm: Tool.Map<fdm>,
    limit = Number.POSITIVE_INFINITY,
): AsyncGenerator<string, string, void> {
    for (let i = 0; i < limit; i++) {
        const response = await engine.stateful(wfctx, session);
        const tcs = response.getToolCalls();
        if (!tcs.length) return response.getOnlyText();
        const ptcs: Promise<Tool.Response<fdm>>[] = [];
        for (const part of response.getParts()) {
            if (part instanceof RoleMessage.Part.Text.Instance) {
                yield part.text;
            } else if (part instanceof Function.Call) {
                const fc = part as Function.Call.From<fdm>;
                const f = tlm[fc.name];
                ptcs.push((async () => {
                    return Function.Response.create<fdm>({
                        id: fc.id,
                        name: fc.name,
                        text: await f.call(tlm, fc.args),
                    } as Function.Response.create.Options<fdm>);
                })());
            } else if (part instanceof Tool.ApplyPatch.Call) {
                const apc: Tool.ApplyPatch.Call = part;
                const tl = tlm[Tool.Choice.APPLY_PATCH];
                ptcs.push((async () => {
                    return Tool.ApplyPatch.Response.create({
                        id: apc.raw.call_id,
                        failure: await tl.call(tlm, apc.raw.operation),
                    });
                })());
            } else throw new Error();
        }
        const trs = await Promise.all(ptcs);
        engine.pushUserMessage(session, RoleMessage.User.create<fdm>(trs));
    }
    throw new agentloop.FunctionCallLimitExceeded('Function call limit exceeded.');
}

export namespace agentloop {
    export import FunctionCallLimitExceeded = CompatibleAgentloopModule.agentloop.FunctionCallLimitExceeded;
}
