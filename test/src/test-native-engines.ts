import test from 'ava';
import { Function } from '../../build/function.js';
import { GoogleNativeEngine } from '../../build/native-engines.d/google/engine.js';
import { OpenAIResponsesNativeEngine } from '../../build/native-engines.d/openai-responses/engine.js';
import { Adaptor } from '../../build/adaptor.js';
import { Tool } from '../../build/native-engines.d/openai-responses/tool.js';
import { fdm, type fdm as fdm_, makeBaseOptions } from './test-helpers.ts';


class GoogleNativeEngineProbe extends GoogleNativeEngine<fdm_> {
    public getToolChoice(): Function.ToolChoice<fdm_> {
        return this.toolChoice;
    }

    public getParallelToolCall(): boolean {
        return this.parallelToolCall;
    }
}

class OpenAIResponsesNativeEngineProbe extends OpenAIResponsesNativeEngine<fdm_> {
    public getToolChoice(): Tool.Choice<fdm_> {
        return this.toolChoice;
    }

    public getParallelToolCall(): boolean {
        return this.parallelToolCall;
    }
}


test('native engines preserve aggregated defaults', t => {
    const googleEngine = new GoogleNativeEngineProbe({
        ...makeBaseOptions(),
        apiType: 'google',
    });
    const openaiEngine = new OpenAIResponsesNativeEngineProbe({
        ...makeBaseOptions(),
        apiType: 'openai-responses',
    });

    t.is(googleEngine.getToolChoice(), Function.ToolChoice.AUTO);
    t.true(googleEngine.getParallelToolCall());

    t.is(openaiEngine.getToolChoice(), Function.ToolChoice.AUTO);
    t.false(openaiEngine.getParallelToolCall());
});

test('Adaptor native engine factories return expected implementations', t => {
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
            },
        },
    });

    const openaiEngine = adaptor.makeOpenAIResponsesNativeEngine('oa', fdm);
    const googleEngine = adaptor.makeGoogleNativeEngine('gg', fdm);

    t.true(openaiEngine instanceof OpenAIResponsesNativeEngine);
    t.true(googleEngine instanceof GoogleNativeEngine);
});
