import { type InferenceContext } from '#@/inference-context.ts';
import { RoleMessage, type Session } from '#@/native-engines.d/google/session.ts';
import { Function } from '#@/function.ts';
import { type GoogleNativeEngine } from '#@/native-engines.d/google/engine.ts';
import * as CompatibleAgentloopModule from '#@/agentloop.ts';
import type { Verbatim } from '#@/verbatim.ts';


/**
 * @param session mutable
 */
export async function *agentloop<
    fdm extends Function.Decl.Map.Proto,
    vdm extends Verbatim.Decl.Map.Proto,
>(
    wfctx: InferenceContext,
    session: Session.From<fdm, vdm>,
    engine: GoogleNativeEngine<fdm, vdm>,
    fnm: Function.Map<fdm>,
    limit = Number.POSITIVE_INFINITY,
): AsyncGenerator<string, string, void> {
    for (let i = 0; i < limit; i++) {
        const response = await engine.stateful(wfctx, session);
        const parts = response.getParts();
        const pfrs: Promise<Function.Response.From<fdm>>[] = [];
        for (const part of parts) {
            if (part instanceof RoleMessage.Part.Text) {
                yield part.text;
            } else if (part instanceof Function.Call) {
                const fc = part as Function.Call.From<fdm>;
                const f = fnm[fc.name];
                pfrs.push((async () => {
                    return Function.Response.of({
                        id: fc.id,
                        name: fc.name,
                        text: await f.call(fnm, fc.args),
                    } as Function.Response.Options.From<fdm>);
                })());
            } else if (part instanceof RoleMessage.Ai.Part.ExecutableCode) {
                yield '\n```' + part.language + '\n' + part.code + '\n```';
            } else if (part instanceof RoleMessage.Ai.Part.CodeExecutionResult) {
                if (part.output) yield '\n```\n' + part.output + '\n```';
                yield part.outcome;
            } else throw new Error();
        }
        const frs: Function.Response.From<fdm>[] = await Promise.all(pfrs);
        if (frs.length)
            engine.pushUserMessage(session, new RoleMessage.User(frs));
        else
            return (parts.at(-1) as RoleMessage.Part.Text<Verbatim.Decl.From<vdm>>).text;
    }
    throw new agentloop.FunctionCallLimitExceeded('Function call limit exceeded.');
}

export namespace agentloop {
    export import FunctionCallLimitExceeded = CompatibleAgentloopModule.agentloop.FunctionCallLimitExceeded;
}
