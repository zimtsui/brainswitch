import { type InferenceContext } from '../inference-context.ts';
import type { Session } from './session.ts';



export interface Transport<
    userm, aim, devm,
    session extends Session<userm, aim, devm>,
> {
    fetch(
        wfctx: InferenceContext,
        session: session,
        signal?: AbortSignal,
    ): Promise<aim>;
}
