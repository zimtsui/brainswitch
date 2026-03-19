import test from 'ava';
import { Type } from '@sinclair/typebox';

import { Adaptor } from './adaptor.ts';
import { CompatibleEngine } from './compatible-engine.ts';
import { ResponseInvalid } from './engine.ts';
import { Function } from './function.ts';
import { type InferenceContext } from './inference-context.ts';
import { RoleMessage, type Session } from './session.ts';
import { Throttle } from './throttle.ts';

import { OpenAIResponsesCompatibleEngine } from './compatible-engine.d/openai-responses.ts';
import { GoogleCompatibleEngine } from './compatible-engine.d/google.ts';
import { AnthropicCompatibleEngine } from './compatible-engine.d/anthropic.ts';
import { AliyunEngine } from './compatible-engine.d/aliyun.ts';


const fdm = {
    foo: {
        description: 'foo tool',
        paraschema: Type.Object({ x: Type.Number() }),
    },
    bar: {
        description: 'bar tool',
        paraschema: Type.Object({ y: Type.String() }),
    },
} satisfies Function.Declaration.Map;

type fdm = typeof fdm;
type fdu = Function.Declaration.From<fdm>;

function makeBaseOptions() {
    return {
        baseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
        name: 'Test Endpoint',
        functionDeclarationMap: fdm,
        throttle: new Throttle(60),
        inputPrice: 1,
        outputPrice: 2,
        cachePrice: 3,
    };
}

function makeSession(): Session<fdu> {
    return { chatMessages: [] };
}

function makeUserMessage(): RoleMessage.User<fdu> {
    return RoleMessage.User.create([RoleMessage.Part.Text.create('hello')]);
}

function makeAiMessage(text = 'ok'): RoleMessage.Ai<fdu> {
    return RoleMessage.Ai.create([RoleMessage.Part.Text.create(text)]);
}

function makeInferenceContext(): InferenceContext {
    return {
        busy: null,
        signal: null,
        cost() {},
    };
}


test('OpenAIResponses compatible engine: composition initializes mixed own props', t => {
    const options: OpenAIResponsesCompatibleEngine.Options<fdm> = {
        ...makeBaseOptions(),
        apiType: 'openai-responses',
        parallelToolCall: true,
        toolChoice: Function.ToolChoice.REQUIRED,
    };
    const engine = new OpenAIResponsesCompatibleEngine(options);

    t.is(engine.name, options.name);
    t.is(engine.fdm, fdm);
});


test('Google compatible engine: default own-props from different parents are preserved', t => {
    const options: GoogleCompatibleEngine.Options<fdm> = {
        ...makeBaseOptions(),
        apiType: 'google',
    };
    const engine = new GoogleCompatibleEngine(options);

    t.is(engine.fdm, fdm);
});


test('CompatibleEngine.stateless retries ResponseInvalid and succeeds', async t => {
    const options: GoogleCompatibleEngine.Options<fdm> = {
        ...makeBaseOptions(),
        apiType: 'google',
    };
    const engine = new GoogleCompatibleEngine(options);

    let attempts = 0;
    const ai = makeAiMessage('retry-ok');
    engine.fetch = async () => {
        attempts += 1;
        if (attempts < 3) throw new ResponseInvalid('temporary');
        return ai;
    };

    const wfctx = makeInferenceContext();
    const response = await engine.stateless(wfctx, makeSession());

    t.is(attempts, 3);
    t.is(response, ai);
});


test('CompatibleEngine stateful/append/push message semantics are correct', async t => {
    const options: GoogleCompatibleEngine.Options<fdm> = {
        ...makeBaseOptions(),
        apiType: 'google',
    };
    const engine = new GoogleCompatibleEngine(options);

    const ai = makeAiMessage('stateful-ok');
    engine.fetch = async () => ai;

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


test('CompatibleEngine.validateToolCallsByToolChoice enforces REQUIRED and allowlist', t => {
    const options: GoogleCompatibleEngine.Options<fdm> = {
        ...makeBaseOptions(),
        apiType: 'google',
    };
    const engine = new GoogleCompatibleEngine(options);

    const fooCall = Function.Call.create<fdu>({
        id: 'fc-1',
        name: 'foo',
        args: { x: 1 },
    });
    const barCall = Function.Call.create<fdu>({
        id: 'fc-2',
        name: 'bar',
        args: { y: 'x' },
    });

    engine.toolChoice = Function.ToolChoice.REQUIRED;
    t.throws(() => engine.validateToolCallsByToolChoice([]), { instanceOf: ResponseInvalid });
    t.notThrows(() => engine.validateToolCallsByToolChoice([fooCall]));

    engine.toolChoice = ['foo'];
    t.notThrows(() => engine.validateToolCallsByToolChoice([fooCall]));
    t.throws(() => engine.validateToolCallsByToolChoice([barCall]), { instanceOf: ResponseInvalid });

    engine.toolChoice = Function.ToolChoice.NONE;
    t.notThrows(() => engine.validateToolCallsByToolChoice([]));
    t.throws(() => engine.validateToolCallsByToolChoice([fooCall]), { instanceOf: ResponseInvalid });
});


test('Adaptor.makeEngine returns each compatible implementation with expected mixed defaults', t => {
    const adaptor = Adaptor.create({
        brainswitch: {
            endpoints: {
                oa: {
                    baseUrl: 'https://example.com/v1',
                    apiKey: 'k',
                    model: 'm',
                    name: 'oa',
                    apiType: 'openai-responses',
                },
                gg: {
                    baseUrl: 'https://generativelanguage.googleapis.com',
                    apiKey: 'k',
                    model: 'gemini-test',
                    name: 'gg',
                    apiType: 'google',
                },
                an: {
                    baseUrl: 'https://api.anthropic.com',
                    apiKey: 'k',
                    model: 'claude-test',
                    name: 'an',
                    apiType: 'anthropic',
                },
                al: {
                    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                    apiKey: 'k',
                    model: 'qwen-test',
                    name: 'al',
                    apiType: 'aliyun',
                },
            },
        },
    });

    const openaiEngine = adaptor.makeEngine('oa', fdm);
    const googleEngine = adaptor.makeEngine('gg', fdm);
    const anthropicEngine = adaptor.makeEngine('an', fdm);
    const aliyunEngine = adaptor.makeEngine('al', fdm);

    t.true(openaiEngine instanceof OpenAIResponsesCompatibleEngine);
    t.true(googleEngine instanceof GoogleCompatibleEngine);
    t.true(anthropicEngine instanceof AnthropicCompatibleEngine);
    t.true(aliyunEngine instanceof AliyunEngine.Instance);

    t.is((openaiEngine as CompatibleEngine.Underhood<fdm>).toolChoice, Function.ToolChoice.AUTO);
    t.is((googleEngine as CompatibleEngine.Underhood<fdm>).toolChoice, Function.ToolChoice.AUTO);
    t.is((anthropicEngine as CompatibleEngine.Underhood<fdm>).toolChoice, Function.ToolChoice.AUTO);
    t.is((aliyunEngine as CompatibleEngine.Underhood<fdm>).toolChoice, Function.ToolChoice.AUTO);

    t.false((openaiEngine as CompatibleEngine.Underhood<fdm>).parallelToolCall);
    t.true((googleEngine as CompatibleEngine.Underhood<fdm>).parallelToolCall);
    t.false((anthropicEngine as CompatibleEngine.Underhood<fdm>).parallelToolCall);
    t.false((aliyunEngine as CompatibleEngine.Underhood<fdm>).parallelToolCall);
});
