import { type InferenceContext } from '#@/inference-context.ts';
import type { GenericSession } from '#@/session.ts';



export interface Transport<
    userm, aim, devm,
    session extends GenericSession<userm, aim, devm>,
> {
    fetch(
        wfctx: InferenceContext,
        session: session,
        signal?: AbortSignal,
    ): Promise<aim>;
}
