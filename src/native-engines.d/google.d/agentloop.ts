import { type InferenceContext } from '../../inference-context.ts';
import { Function } from '../../function.ts';
import { GoogleNativeEngine } from '../google.ts';
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
    session: GoogleNativeEngine.Session.From<fdm, vdm>,
    engine: GoogleNativeEngine<fdm, vdm>,
    fnm: Function.Map<fdm>,
    limit = Number.POSITIVE_INFINITY,
): AsyncGenerator<string, string, void> {
    for (let i = 0; i < limit; i++) {
        const response = await engine.stateful(wfctx, session);
        if (response.allChatPart()) return response.getChatText();
        const pfrs: Promise<Function.Response.From<fdm>>[] = [];
        for (const part of response.getParts()) {
            if (part instanceof GoogleNativeEngine.RoleMessage.Part.Text) {
                yield GoogleNativeEngine.RoleMessage.Ai.encodeChatPart(part);
            } else if (part instanceof Function.Call) {
                const fc = part as Function.Call.From<fdm>;
                const f = fnm[fc.name];
                pfrs.push((async () => {
                    try {
                        return Function.Response.Successful.of({
                            id: fc.id,
                            name: fc.name,
                            text: await f.call(fnm, fc.args),
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
            } else if (part instanceof GoogleNativeEngine.RoleMessage.Ai.Part.ExecutableCode) {
                yield GoogleNativeEngine.RoleMessage.Ai.encodeChatPart(part);
            } else if (part instanceof GoogleNativeEngine.RoleMessage.Ai.Part.CodeExecutionResult) {
                yield GoogleNativeEngine.RoleMessage.Ai.encodeChatPart(part);
            } else throw new Error();
        }
        const frs: Function.Response.From<fdm>[] = await Promise.all(pfrs);
        engine.pushUserMessage(session, new GoogleNativeEngine.RoleMessage.User(frs));
    }
    throw new agentloop.FunctionCallLimitExceeded('Function call limit exceeded.');
}

export namespace agentloop {
    export import FunctionCallLimitExceeded = CompatibleAgentloopModule.agentloop.FunctionCallLimitExceeded;
}
