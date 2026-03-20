import test from 'ava';
import { CompatibleEngine } from '../../build/compatible/engine.js';
import { RoleMessage, type Session } from '../../build/compatible/session.js';
import { Function } from '../../build/function.js';
import { type InferenceContext } from '../../build/inference-context.js';
import {
    type fdm as fdm_,
    type fdu,
    makeAiMessage,
    makeBaseOptions,
} from './test-helpers.ts';


class StubCompatibleEngine extends CompatibleEngine<fdm_> {
    protected override parallelToolCall = false;
    public responder: (
        wfctx: InferenceContext,
        session: Session<fdu>,
        signal?: AbortSignal,
    ) => Promise<RoleMessage.Ai<fdu>> = async () => makeAiMessage();

    public getToolChoice(): Function.ToolChoice<fdm_> {
        return this.toolChoice;
    }

    public setToolChoice(toolChoice: Function.ToolChoice<fdm_>): void {
        this.toolChoice = toolChoice;
    }

    public override infer(
        wfctx: InferenceContext,
        session: Session<fdu>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<fdu>> {
        return this.responder(wfctx, session, signal);
    }
}


test('CompatibleEngine stores default tool choice', t => {
    const engine = new StubCompatibleEngine({
        ...makeBaseOptions(),
        apiType: 'google',
    });
    t.is(engine.getToolChoice(), Function.ToolChoice.AUTO);
});
