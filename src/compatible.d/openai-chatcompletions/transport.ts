import { ResponseInvalid } from '../../engine.ts';
import { RoleMessage, type Session } from '../../session.ts';
import { Function } from '../../function.ts';
import OpenAI from 'openai';
import type { InferenceContext } from '../../inference-context.ts';



export abstract class OpenAIChatCompletionsCompatibleTransport<in out fdm extends Function.Declaration.Map> {

    public async fetch(
        wfctx: InferenceContext,
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>> {
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
        session: Session<Function.Declaration.From<fdm>>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<Function.Declaration.From<fdm>>>;
}
