import { ResponseInvalid } from '#@/engine.ts';
import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import OpenAI from 'openai';
import type { InferenceContext } from '#@/inference-context.ts';
import type { Verbatim } from '#@/verbatim.ts';



export abstract class Transport<
    in out fdm extends Function.Declaration.Map.Prototype,
    in out vdm extends Verbatim.Declaration.Map.Prototype,
> {

    public async fetch(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>> {
        try {
            return await this.fetchRaw(wfctx, session, signal);
        } catch (e) {
            if (e instanceof OpenAI.APIError)
                throw new ResponseInvalid(undefined, { cause: e });
            else throw e;
        }
    }

    public handleFinishReason(completion: OpenAI.ChatCompletion, finishReason: OpenAI.ChatCompletion.Choice['finish_reason']): void {
        if (finishReason === 'length')
            throw new ResponseInvalid('Token limit exceeded.', { cause: completion });
        if (['stop', 'tool_calls'].includes(finishReason)) {}
        else throw new ResponseInvalid('Abnormal finish reason', { cause: finishReason });
    }

    protected abstract fetchRaw(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>>;
}
