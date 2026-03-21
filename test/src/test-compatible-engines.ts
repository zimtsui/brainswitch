import test from 'ava';
import { Adaptor } from '#@/adaptor.ts';
import { Function } from '#@/function.ts';
import { OpenAIResponsesCompatibleEngine } from '#@/compatible/engine.d/openai-responses.ts';
import { GoogleCompatibleEngine } from '#@/compatible/engine.d/google.ts';
import { AnthropicCompatibleEngine } from '#@/compatible/engine.d/anthropic.ts';
import { AliyunEngine } from '#@/compatible/engine.d/aliyun.ts';
import { fdm, makeBaseOptions } from './test-helpers.ts';


class OpenAIResponsesCompatibleEngineProbe extends OpenAIResponsesCompatibleEngine<fdm> {
    public getToolChoice(): Function.ToolChoice<fdm> {
        return this.toolChoice;
    }

    public getParallelToolCall(): boolean {
        return this.parallelToolCall;
    }
}

class GoogleCompatibleEngineProbe extends GoogleCompatibleEngine<fdm> {
    public getToolChoice(): Function.ToolChoice<fdm> {
        return this.toolChoice;
    }

    public getParallelToolCall(): boolean {
        return this.parallelToolCall;
    }
}

class AnthropicCompatibleEngineProbe extends AnthropicCompatibleEngine<fdm> {
    public getToolChoice(): Function.ToolChoice<fdm> {
        return this.toolChoice;
    }

    public getParallelToolCall(): boolean {
        return this.parallelToolCall;
    }
}

class AliyunEngineProbe extends AliyunEngine<fdm> {
    public getToolChoice(): Function.ToolChoice<fdm> {
        return this.toolChoice;
    }

    public getParallelToolCall(): boolean {
        return this.parallelToolCall;
    }
}


test('compatible engines preserve aggregated defaults', t => {
    const openaiEngine = new OpenAIResponsesCompatibleEngineProbe({
        ...makeBaseOptions(),
        apiType: 'openai-responses',
    });
    const googleEngine = new GoogleCompatibleEngineProbe({
        ...makeBaseOptions(),
        apiType: 'google',
    });
    const anthropicEngine = new AnthropicCompatibleEngineProbe({
        ...makeBaseOptions(),
        apiType: 'anthropic',
    });
    const aliyunEngine = new AliyunEngineProbe({
        ...makeBaseOptions(),
        apiType: 'aliyun',
    });

    t.is(openaiEngine.fdm, fdm);
    t.is(openaiEngine.getToolChoice(), Function.ToolChoice.AUTO);
    t.false(openaiEngine.getParallelToolCall());

    t.is(googleEngine.getToolChoice(), Function.ToolChoice.AUTO);
    t.true(googleEngine.getParallelToolCall());

    t.is(anthropicEngine.getToolChoice(), Function.ToolChoice.AUTO);
    t.false(anthropicEngine.getParallelToolCall());

    t.is(aliyunEngine.getToolChoice(), Function.ToolChoice.AUTO);
    t.false(aliyunEngine.getParallelToolCall());
});

test('Adaptor.makeEngine returns each compatible implementation', t => {
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
    t.true(aliyunEngine instanceof AliyunEngine);
});
