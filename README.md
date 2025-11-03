<!-- 本文档由 GPT-5 辅助生成 -->

# Brainswitch

[![Npm package version](https://flat.badgen.net/npm/v/@zimtsui/brainswitch)](https://www.npmjs.com/package/@zimtsui/brainswitch)

Brainswitch 是一个为 AI 工作流设计的 LLM 推理 API 适配器，支持在会话中切换模型。

## Motivation

大多数 LLM 推理服务商不支持[严格函数调用](https://platform.openai.com/docs/guides/function-calling#strict-mode)，在 AI 批处理工作流中难以达到生产级的可靠性。如果仅使用 OpenAI 等支持严格函数调用的服务商，那么可选的模型型号会大幅受限。

Brainswitch 支持在一次会话中途切换模型并保持对话上下文，包括 OpenAI、Google 的深度思考模型的加密思考内容。有了 Brainswitch 就可以在会话的大量推理阶段使用最合适的模型生成自然语言结果，在最后的总结阶段切换成支持严格函数调用的模型进行结构化提交。

## 支持服务商 API 类型

- OpenAI Chat Completions
- OpenAI Responses
- Google
- 百炼/火山引擎 OpenAI 兼容
- OpenRouter
- HuggingFace Cerebras Qwen3 Thinking

## 安装

环境要求：Node.js >= 22。

```bash
npm i @zimtsui/brainswitch
```

## 核心概念

- `Session`：会话状态，包含开发者提示词和往返消息。
- `InferenceContext`：工作流上下文，包含 [TypeLog](https://github.com/zimtsui/typelog) Logger、`AbortSignal`、用户防止并发过载的[读写锁](https://github.com/zimtsui/coroutine-locks)。
- `Engine`：一个函数 `(ctx, session) => Promise<AIMessage>`；实现了具体服务商的请求/响应适配。
- `Endpoint`：一家服务商的某个模型的 API 端点。
- `Adaptor`：创建使用某个 Endpoint 的 `Engine`。
- `RoleMessage`：三类角色消息 `Developer`、`User`、`AI`，消息由 `Text` 与 `Function.Call/Response` 片段组成。
- `Function.Declaration.Map`：函数工具声明集合，使用 [JSON Schema](https://json-schema.org/) 描述函数参数。

## 配置

```ts
export type Config = {
    brainswitch: {
        endpoints: Record<string, {
            baseUrl: string;
            apiKey: string;
            model: string;
            name: string;
            apiType: 'openai-chatcompletions' | 'openai-responses' | 'google' | 'qwen' | 'openrouter-monolith' | 'openrouter-stream' | 'huggingface-cerebras-qwen3-thinking';
            proxy?: string;
            inputPrice?: number;    // 每百万输入 Token 人民币成本
            outputPrice?: number;   // 每百万输出 Token 人民币成本
            cachedPrice?: number;   // 每百万缓存命中 Token 人民币成本
            customOptions?: Record<string, unknown>; // 直通服务商的自定义参数
            rpm?: number;           // 每分钟请求次数上限
            tpm?: number;           // 每分钟 Token 上限
            timeout?: number;       // 单次请求超时（毫秒）
        }>;
    };
}
```

### 计费说明

`inputPrice`/`outputPrice`/`cachedPrice` 的单位均为「人民币每百万 Token」。OpenRouter 的成本会自动按服务器返回的 USD 成本并使用固定汇率（源码中默认 8）换算为 CNY 记账。

## 快速上手

下面演示：定义一个工具函数，先用 Google 做推理与工具调用，再在同一会话中切换到 OpenAI Responses 做最终的结构化总结。

```ts
import { Adaptor, agentloop, RoleMessage, Function, type InferenceContext, type Config, Session } from '@zimtsui/brainswitch';
import { Type } from '@sinclair/typebox';
import { RWLock } from '@zimtsui/coroutine-locks';
import { Channel } from '@zimtsui/typelog';
import * as Presets from '@zimtsui/typelog/presets';

// 配置
const config: Config = {
    brainswitch: {
        endpoints: {
            'gpt-4o-mini': {
                name: 'GPT-4o mini',
                apiType: 'openai-chatcompletions',
                baseUrl: 'https://api.openai.com/v1',
                apiKey: process.env.OPENAI_API_KEY!,
                model: 'gpt-4o-mini',
                inputPrice: 5, outputPrice: 15, cachedPrice: 1,
                rpm: 3000, tpm: 1_000_000, timeout: 60_000,
            },
            'o4-mini': {
                name: 'o4 mini',
                apiType: 'openai-responses',
                baseUrl: 'https://api.openai.com/v1',
                apiKey: process.env.OPENAI_API_KEY!,
                model: 'o4-mini',
            },
            'gemini-2.5-flash': {
                name: 'Gemini 2.5 Flash',
                apiType: 'google',
                baseUrl: 'https://generativelanguage.googleapis.com',
                apiKey: process.env.GOOGLE_API_KEY!,
                model: 'gemini-2.5-flash',
            },
        }
    }
}

// 声明函数工具
const fdm = {
    get_weather: {
        description: '获取某城市的天气',
        paraschema: Type.Object({
            city: Type.String(),
            unit: Type.Optional(Type.Union([Type.Literal('C'), Type.Literal('F')]))
        }),
    },
    submit_result: {
        description: '提交最终结果',
        paraschema: Type.Object({
            weather: Type.String(),
            advice: Type.String(),
        }),
    },
} satisfies Function.Declaration.Map;
type fdm = typeof fdm;
type fdu = Function.Declaration.From<fdm>;

export class Submission extends Error {
    public constructor(public weather: string, public advice: string) {
        super(undefined);
    }
}
const fnm: Function.Map<fdm> = {
    async get_weather({ city, unit }) {
        // 实际项目中此处调用真实 API，这里仅示例
        const data = { city, unit: unit ?? 'C', temperature: 26, sky: 'sunny' };
        return JSON.stringify(data);
    },
    async submit_result({ weather, advice }) {
        throw new Submission(weather, advice);
    },
};

// 初始化工作流上下文
const ctx: InferenceContext = {
    busy: new RWLock(),
    logger: {
        message: Channel.create(Presets.Level, message => console.log(message)),
        cost(deltaCost) { console.log((-deltaCost).toFixed(2)); },
    },
};

// 创建会话
const session: Session<fdu> = {
    developerMessage: RoleMessage.Developer.create([
        RoleMessage.Part.Text.create('你的工作是为用户查询天气，并给出穿衣建议。'),
    ]),
    chatMessages: [
        RoleMessage.User.create([ RoleMessage.Part.Text.create('请查询现在北京的天气，并给穿衣建议。') ]),
    ],
};

// 选择推理引擎
const adaptor = Adaptor.create(config);
const engine = adaptor.makeEngine('gpt-4o-mini', fdm, Function.ToolChoice.REQUIRED);

// 使用 agentloop 驱动智能体循环，最多 8 轮对话
try {
    for await (const text of agentloop(ctx, session, engine, fnm, 8)) console.log(text);
} catch (e) {
    if (e instanceof Submission) {} else throw e;
    console.log(e.weather);
    console.log(e.advice);
}
```
