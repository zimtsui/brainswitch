import { ResponseInvalid } from '#@/engine.ts';
import { RoleMessage, type Session } from '#@/compatible/session.ts';
import { Function } from '#@/function.ts';
import OpenAI from 'openai';
import type { InferenceContext } from '#@/inference-context.ts';
import type { Verbatim } from '#@/verbatim.ts';
import type { Transport as GenericTransport } from '#@/engine/transport.ts';



export abstract class Transport<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> implements GenericTransport<
    RoleMessage.User.From<fdm>,
    RoleMessage.Ai.From<fdm, vdm>,
    RoleMessage.Developer,
    Session.From<fdm, vdm>
> {
    public abstract fetch(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>>;

    public handleFinishReason(completion: OpenAI.ChatCompletion, finishReason: OpenAI.ChatCompletion.Choice['finish_reason']): void {
        if (finishReason === 'length')
            throw new ResponseInvalid('Token limit exceeded.', { cause: completion });
        if (['stop', 'tool_calls'].includes(finishReason)) {}
        else throw new ResponseInvalid('Abnormal finish reason', { cause: finishReason });
    }

}
