import { type InferenceContext } from '#@/inference-context.ts';
import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import { type CompatibleEngine } from '#@/compatible/engine.ts';


/**
 * @param session mutable
 */
export async function *agentloop<fdm extends Function.Declaration.Map>(
    wfctx: InferenceContext,
    session: Session<fdm>,
    engine: CompatibleEngine<fdm>,
    fnm: Function.Map<fdm>,
    limit = Number.POSITIVE_INFINITY,
): AsyncGenerator<string, string, void> {
    for (let i = 0; i < limit; i++) {
        const response = await engine.stateful(wfctx, session);
        const fcs = response.getFunctionCalls();
        if (!fcs.length) return response.getOnlyText();
        const pfrs: Promise<Function.Response.From<fdm>>[] = [];
        for (const part of response.getParts()) {
            if (part instanceof RoleMessage.Part.Text.Instance) {
                yield part.text;
            } else if (part instanceof Function.Call) {
                const fc = part as Function.Call.From<fdm>;
                const f = fnm[fc.name];
                pfrs.push((async () => {
                    return Function.Response.create<fdm>({
                        id: fc.id,
                        name: fc.name,
                        text: await f.call(fnm, fc.args),
                    } as Function.Response.create.Options<fdm>);
                })());
            } else throw new Error();
        }
        const frs = await Promise.all(pfrs);
        engine.pushUserMessage(session, RoleMessage.User.create<fdm>(frs));
    }
    throw new agentloop.FunctionCallLimitExceeded('Function call limit exceeded.');
}

export namespace agentloop {
    export class FunctionCallLimitExceeded extends Error {}
}
