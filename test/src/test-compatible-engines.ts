import test from 'ava';
import { Adaptor } from '../../build/adaptor.js';
import { Function } from '../../build/function.js';
import { OpenAIResponsesCompatibleEngine } from '../../build/compatible-engine.d/openai-responses.js';
import { GoogleCompatibleEngine } from '../../build/compatible-engine.d/google.js';
import { AnthropicCompatibleEngine } from '../../build/compatible-engine.d/anthropic.js';
import { AliyunEngine } from '../../build/compatible-engine.d/aliyun.js';
import { fdm, type fdm as fdm_, makeBaseOptions } from './test-helpers.ts';


class OpenAIResponsesCompatibleEngineProbe extends OpenAIResponsesCompatibleEngine<fdm_> {
    public getToolChoice(): Function.ToolChoice<fdm_> {
        return this.toolChoice;
    }

    public getParallelToolCall(): boolean {
        return this.parallelToolCall;
    }
}

class GoogleCompatibleEngineProbe extends GoogleCompatibleEngine<fdm_> {
    public getToolChoice(): Function.ToolChoice<fdm_> {
        return this.toolChoice;
    }

    public getParallelToolCall(): boolean {
        return this.parallelToolCall;
    }
}

class AnthropicCompatibleEngineProbe extends AnthropicCompatibleEngine<fdm_> {
    public getToolChoice(): Function.ToolChoice<fdm_> {
        return this.toolChoice;
    }

    public getParallelToolCall(): boolean {
        return this.parallelToolCall;
    }
}

class AliyunEngineProbe extends AliyunEngine<fdm_> {
    public getToolChoice(): Function.ToolChoice<fdm_> {
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
