import { type InferenceContext } from '../inference-context.ts';
import { Function } from '../function.ts';
import { CompatibleEngine } from '../compatible-engine.ts';
import type { Verbatim } from '../verbatim.ts';


/**
 * @param session mutable
 */
export async function *agentloop<
    fdm extends Function.Decl.Map.Proto,
    vdm extends Verbatim.Decl.Map.Proto,
>(
    wfctx: InferenceContext,
    session: CompatibleEngine.Session.From<fdm, vdm>,
    engine: CompatibleEngine<fdm, vdm>,
    fnm: Function.Map<fdm>,
    limit = Number.POSITIVE_INFINITY,
): AsyncGenerator<string, string, void> {
    for (let i = 0; i < limit; i++) {
        const response = await engine.stateful(wfctx, session);
        if (response.allTextPart()) return response.getText();
        const pfrs: Promise<Function.Response.From<fdm>>[] = [];
        for (const part of response.getParts()) {
            if (part instanceof CompatibleEngine.RoleMessage.Part.Text) {
                yield part.text;
            } else if (part instanceof Function.Call) {
                const fc = part as Function.Call.From<fdm>;
                const f = fnm[fc.name];
                try {
                    pfrs.push((async () => {
                        return Function.Response.Successful.of({
                            id: fc.id,
                            name: fc.name,
                            text: await f.call(fnm, fc.args),
                        } as Function.Response.Successful.Options.From<fdm>);
                    })());
                } catch (e) {
                    if (e instanceof Function.Error) {} else throw e;
                    pfrs.push((async () => {
                        return Function.Response.Failed.of({
                            id: fc.id,
                            name: fc.name,
                            error: e.message,
                        } as Function.Response.Failed.Options.From<fdm>);
                    })());
                }
            } else throw new Error();
        }
        const frs: Function.Response.From<fdm>[] = await Promise.all(pfrs);
        engine.pushUserMessage(session, new CompatibleEngine.RoleMessage.User(frs));
    }
    throw new agentloop.FunctionCallLimitExceeded('Function call limit exceeded.');
}

export namespace agentloop {
    export class FunctionCallLimitExceeded extends Error {}
}
