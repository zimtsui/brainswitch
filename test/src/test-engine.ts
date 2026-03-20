import test from 'ava';
import { Engine, InferenceTimeout, ResponseInvalid, UserAbortion } from '#@/engine.ts';
import { type GenericSession } from '#@/session.ts';
import { type InferenceContext } from '#@/inference-context.ts';
import { type RoleMessage } from '#@/compatible/session.ts';
import {
    fdm,
    type fdm as fdm_,
    type fdu,
    makeBaseOptions,
    makeInferenceContext,
    makeUserMessage,
} from './test-helpers.ts';


type StubSession = GenericSession<RoleMessage.User<fdu>, string, never>;

class StubEngine extends Engine<
    fdm_,
    RoleMessage.User<fdu>,
    string,
    never,
    StubSession
> {
    protected override parallelToolCall = false;
    public responder: (
        wfctx: InferenceContext,
        session: StubSession,
        signal?: AbortSignal,
    ) => Promise<string> = async () => 'ok';

    protected override infer(
        wfctx: InferenceContext,
        session: StubSession,
        signal?: AbortSignal,
    ): Promise<string> {
        return this.responder(wfctx, session, signal);
    }

    public override appendUserMessage(
        session: StubSession,
        message: RoleMessage.User<fdu>,
    ): StubSession {
        return {
            ...session,
            chatMessages: [...session.chatMessages, message],
        };
    }

    public override pushUserMessage(
        session: StubSession,
        message: RoleMessage.User<fdu>,
    ): StubSession {
        session.chatMessages.push(message);
        return session;
    }
}

function makeStringSession(): StubSession {
    return { chatMessages: [] };
}


test('Engine stores function declaration map', t => {
    const engine = new StubEngine({
        ...makeBaseOptions(),
        apiType: 'google',
    });
    t.is(engine.fdm, fdm);
});

test('Engine.stateless retries ResponseInvalid and succeeds', async t => {
    const engine = new StubEngine({
        ...makeBaseOptions(),
        apiType: 'google',
    });

    let attempts = 0;
    engine.responder = async () => {
        attempts += 1;
        if (attempts < 3) throw new ResponseInvalid('temporary');
        return 'retry-ok';
    };

    const response = await engine.stateless(makeInferenceContext(), makeStringSession());

    t.is(attempts, 3);
    t.is(response, 'retry-ok');
});

test('Engine.stateless converts aborted workflow signal to UserAbortion', async t => {
    const engine = new StubEngine({
        ...makeBaseOptions(),
        apiType: 'google',
    });
    const controller = new AbortController();

    engine.responder = async () => {
        controller.abort();
        throw new TypeError('aborted');
    };

    const e = await engine.stateless(makeInferenceContext(controller.signal), makeStringSession()).catch((e: unknown) => e);
    t.true(e instanceof UserAbortion);
});

test('Engine.stateless converts timeout abort to InferenceTimeout', async t => {
    const engine = new StubEngine({
        ...makeBaseOptions(),
        apiType: 'google',
        timeout: 1,
    });

    engine.responder = async (_wfctx: InferenceContext, _session: StubSession, signal?: AbortSignal) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        if (signal?.aborted) throw new TypeError('timed out');
        return 'late';
    };

    const e = await t.throwsAsync(
        engine.stateless(makeInferenceContext(), makeStringSession()),
    );
    t.true(e instanceof InferenceTimeout);
});

test('Engine stateful/append/push message semantics are correct', async t => {
    const engine = new StubEngine({
        ...makeBaseOptions(),
        apiType: 'google',
    });
    engine.responder = async () => 'stateful-ok';

    const session = makeStringSession();
    const response = await engine.stateful(makeInferenceContext(), session);
    t.is(response, 'stateful-ok');
    t.deepEqual(session.chatMessages, ['stateful-ok']);

    const user = makeUserMessage();
    const appended = engine.appendUserMessage(session, user);
    t.not(appended, session);
    t.deepEqual(appended.chatMessages, ['stateful-ok', user]);
    t.deepEqual(session.chatMessages, ['stateful-ok']);

    const pushed = engine.pushUserMessage(session, user);
    t.is(pushed, session);
    t.deepEqual(session.chatMessages, ['stateful-ok', user]);
});
