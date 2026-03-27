import { type InferenceContext } from '../../inference-context.ts';
import { Function } from '../../function.ts';
import { OpenAIResponsesNativeEngine } from '../openai-responses.ts';
import * as CompatibleAgentloopModule from '../../compatible-engine.d/agentloop.ts';
import type { Verbatim } from '../../verbatim.ts';


/**
 * @param session mutable
 */
export async function *agentloop<
    fdm extends Function.Decl.Map.Proto,
    vdm extends Verbatim.Decl.Map.Proto,
>(
    wfctx: InferenceContext,
    session: OpenAIResponsesNativeEngine.Session.From<fdm, vdm>,
    engine: OpenAIResponsesNativeEngine<fdm, vdm>,
    tlm: OpenAIResponsesNativeEngine.Tool.Map<fdm>,
    limit = Number.POSITIVE_INFINITY,
): AsyncGenerator<string, string, void> {
    for (let i = 0; i < limit; i++) {
        const response = await engine.stateful(wfctx, session);
        if (response.allTextPart()) return response.getText();
        const ptcs: Promise<OpenAIResponsesNativeEngine.Tool.Response.From<fdm>>[] = [];
        for (const part of response.getParts()) {
            if (part instanceof OpenAIResponsesNativeEngine.RoleMessage.Part.Text) {
                yield part.text;
            } else if (part instanceof Function.Call) {
                const fc = part as Function.Call.From<fdm>;
                const fn = tlm[fc.name];
                ptcs.push((async () => {
                    try {
                        return Function.Response.Successful.of({
                            id: fc.id,
                            name: fc.name,
                            text: await fn.call(tlm, fc.args),
                        } as Function.Response.Successful.Options.From<fdm>);
                    } catch (e) {
                        if (e instanceof Function.Error) {} else throw e;
                        return Function.Response.Failed.of({
                            id: fc.id,
                            name: fc.name,
                            error: e.message,
                        } as Function.Response.Failed.Options.From<fdm>);
                    }
                })());

            } else if (part instanceof OpenAIResponsesNativeEngine.Tool.ApplyPatch.Call) {
                const apc: OpenAIResponsesNativeEngine.Tool.ApplyPatch.Call = part;
                const tl = tlm[OpenAIResponsesNativeEngine.Tool.APPLY_PATCH];
                ptcs.push((async () => {
                    return new OpenAIResponsesNativeEngine.Tool.ApplyPatch.Response({
                        id: apc.raw.call_id,
                        failure: await tl.call(tlm, apc.raw.operation),
                    });
                })());
            } else throw new Error();
        }
        const trs: OpenAIResponsesNativeEngine.Tool.Response.From<fdm>[] = await Promise.all(ptcs);
        engine.pushUserMessage(session, new OpenAIResponsesNativeEngine.RoleMessage.User(trs));
    }
    throw new agentloop.FunctionCallLimitExceeded('Function call limit exceeded.');
}

export namespace agentloop {
    export import FunctionCallLimitExceeded = CompatibleAgentloopModule.agentloop.FunctionCallLimitExceeded;
}
