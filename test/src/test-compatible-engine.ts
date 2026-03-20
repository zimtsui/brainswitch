import test from 'ava';
import { CompatibleEngine } from './compatible/engine.ts';
import { ResponseInvalid, InferenceTimeout, UserAbortion } from './engine.ts';
import { RoleMessage, type Session } from './compatible/session.ts';
import { Function } from './function.ts';
import { type InferenceContext } from './inference-context.ts';
import {
    fdm,
    type fdm as fdm_,
    type fdu,
    makeAiMessage,
    makeBaseOptions,
    makeInferenceContext,
    makeSession,
    makeUserMessage,
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
    t.is(engine.fdm, fdm);
});

test('CompatibleEngine.stateless retries ResponseInvalid and succeeds', async t => {
    const engine = new StubCompatibleEngine({
        ...makeBaseOptions(),
        apiType: 'google',
    });

    let attempts = 0;
    const ai = makeAiMessage('retry-ok');
    engine.responder = async () => {
        attempts += 1;
        if (attempts < 3) throw new ResponseInvalid('temporary');
        return ai;
    };

    const response = await engine.stateless(makeInferenceContext(), makeSession());

    t.is(attempts, 3);
    t.is(response, ai);
});

test('CompatibleEngine.stateless converts aborted workflow signal to UserAbortion', async t => {
    const engine = new StubCompatibleEngine({
        ...makeBaseOptions(),
        apiType: 'google',
    });
    const controller = new AbortController();

    engine.responder = async () => {
        controller.abort();
        throw new TypeError('aborted');
    };

    const e = await engine.stateless(makeInferenceContext(controller.signal), makeSession()).catch(e => e);
    t.true(e instanceof UserAbortion);
});

test('CompatibleEngine.stateless converts timeout abort to InferenceTimeout', async t => {
    const engine = new StubCompatibleEngine({
        ...makeBaseOptions(),
        apiType: 'google',
        timeout: 1,
    });

    engine.responder = async (_wfctx, _session, signal) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        if (signal?.aborted) throw new TypeError('timed out');
        return makeAiMessage('late');
    };

    const e = await t.throwsAsync(
        engine.stateless(makeInferenceContext(), makeSession()),
    );
    t.true(e instanceof InferenceTimeout);
});

test('CompatibleEngine stateful/append/push message semantics are correct', async t => {
    const engine = new StubCompatibleEngine({
        ...makeBaseOptions(),
        apiType: 'google',
    });

    const ai = makeAiMessage('stateful-ok');
    engine.responder = async () => ai;

    const session = makeSession();
    const response = await engine.stateful(makeInferenceContext(), session);
    t.is(response, ai);
    t.deepEqual(session.chatMessages, [ai]);

    const user = makeUserMessage();
    const appended = engine.appendUserMessage(session, user);
    t.not(appended, session);
    t.deepEqual(appended.chatMessages, [ai, user]);
    t.deepEqual(session.chatMessages, [ai]);

    const pushed = engine.pushUserMessage(session, user);
    t.is(pushed, session);
    t.deepEqual(session.chatMessages, [ai, user]);
});
