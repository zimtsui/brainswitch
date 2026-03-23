import { type InferenceContext } from '#@/inference-context.ts';
import { RoleMessage, type Session } from '#@/native-engines.d/openai-responses/session.ts';
import { Function } from '#@/function.ts';
import { Tool } from '#@/native-engines.d/openai-responses/tool.ts';
import { OpenAIResponsesNativeEngine } from '#@/native-engines.d/openai-responses/engine.ts';
import * as CompatibleAgentloopModule from '#@/agentloop.ts';
import type { Verbatim } from '#@/verbatim.ts';


/**
 * @param session mutable
 */
export async function *agentloop<
    fdm extends Function.Declaration.Map.Prototype,
    vdm extends Verbatim.Declaration.Map.Prototype,
>(
    wfctx: InferenceContext,
    session: Session.From<fdm, vdm>,
    engine: OpenAIResponsesNativeEngine<fdm, vdm>,
    tlm: Tool.Map<fdm>,
    limit = Number.POSITIVE_INFINITY,
): AsyncGenerator<string, string, void> {
    for (let i = 0; i < limit; i++) {
        const response = await engine.stateful(wfctx, session);
        const tcs = response.getToolCalls();
        if (!tcs.length) return response.getOnlyText();
        const ptcs: Promise<Tool.Response.From<fdm>>[] = [];
        for (const part of response.getParts()) {
            if (part instanceof RoleMessage.Part.Text) {
                yield part.text;
            } else if (part instanceof Function.Call) {
                const fc = part as Function.Call.From<fdm>;
                const fn = tlm[fc.name];
                ptcs.push((async () => {
                    return Function.Response.of({
                        id: fc.id,
                        name: fc.name,
                        text: await fn.call(tlm, fc.args),
                    } as Function.Response.Options.From<fdm>);
                })());
            } else if (part instanceof Tool.ApplyPatch.Call) {
                const apc: Tool.ApplyPatch.Call = part;
                const tl = tlm[Tool.Choice.APPLY_PATCH];
                ptcs.push((async () => {
                    return new Tool.ApplyPatch.Response({
                        id: apc.raw.call_id,
                        failure: await tl.call(tlm, apc.raw.operation),
                    });
                })());
            } else throw new Error();
        }
        const trs: Tool.Response.From<fdm>[] = await Promise.all(ptcs);
        engine.pushUserMessage(session, new RoleMessage.User(trs));
    }
    throw new agentloop.FunctionCallLimitExceeded('Function call limit exceeded.');
}

export namespace agentloop {
    export import FunctionCallLimitExceeded = CompatibleAgentloopModule.agentloop.FunctionCallLimitExceeded;
}
