import { Type } from '@sinclair/typebox';
import { Function } from './function.ts';
import { type InferenceContext } from './inference-context.ts';
import { RoleMessage, type Session } from './session.ts';
import { Throttle } from './throttle.ts';


export const fdm = {
    foo: {
        description: 'foo tool',
        paraschema: Type.Object({ x: Type.Number() }),
    },
    bar: {
        description: 'bar tool',
        paraschema: Type.Object({ y: Type.String() }),
    },
} satisfies Function.Declaration.Map;

export type fdm = typeof fdm;
export type fdu = Function.Declaration.From<fdm>;

export function makeBaseOptions() {
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

export function makeSession(): Session<fdu> {
    return { chatMessages: [] };
}

export function makeUserMessage(): RoleMessage.User<fdu> {
    return RoleMessage.User.create([RoleMessage.Part.Text.create('hello')]);
}

export function makeAiMessage(text = 'ok'): RoleMessage.Ai<fdu> {
    return RoleMessage.Ai.create([RoleMessage.Part.Text.create(text)]);
}

export function makeInferenceContext(signal: AbortSignal | null = null): InferenceContext {
    return {
        busy: null,
        signal,
        cost() {},
    };
}
