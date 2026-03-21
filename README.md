<!-- 本文档由 GPT-5 辅助生成 -->

# Brainswitch

[![NPM Version](https://img.shields.io/npm/v/@zimtsui/brainswitch?style=flat-square)](https://www.npmjs.com/package/@zimtsui/brainswitch)

Brainswitch 是一个强类型的 LLM 推理 API 适配器。

## 支持服务商 API 类型

-   OpenAI Responses
-   Google
-   阿里云 OpenAI Chat Completions Compatible
-   Anthropic

## 安装

环境要求：Node.js >= 22。

```bash
npm install @zimtsui/brainswitch
```

## 核心概念

- `Session`：会话状态。
- `InferenceContext`：工作流环境，包含 [TypeLog](https://github.com/zimtsui/typelog) Logger、`AbortSignal`、用户防止并发过载的[读写锁](https://github.com/zimtsui/coroutine-locks)。
- `Engine`：推理引擎，从一个会话状态生成下一个会话状态。
- `Endpoint`：代表一家服务商的一个模型的 API 端点。
- `Adaptor`：Engine 工厂。
- `RoleMessage`：三类角色消息 `Developer`、`User`、`AI`，消息由 `Text/Function.Call/Response` 片段组成。
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
            apiType:
                | 'openai-responses'
                | 'google'
                | 'aliyun'
                | 'anthropic'
            ;
            proxy?: string;
            inputPrice?: number;    // CNY per MToken
            outputPrice?: number;   // CNY per MToken
            cachePrice?: number;    // CNY per MToken
            rpm?: number;           // Requests per minute
            timeout?: number;       // Time limit in milliseconds
            maxTokens?: number;     // Maximum number of generated tokens
            additionalOptions?: Record<string, unknown>;
        };
    };
}
```

## 快速上手

```ts
import { Adaptor, agentloop, RoleMessage, Function, type InferenceContext, type Config, type Session } from '@zimtsui/brainswitch';
import { Type } from '@sinclair/typebox';
import { RWLock } from '@zimtsui/coroutine-locks';


// 配置推理服务商 API 接入点
const config: Config = {
    brainswitch: {
        endpoints: {
            'gpt-5-mini': {
                name: 'GPT-5 mini',
                apiType: 'openai-responses',
                baseUrl: 'https://api.openai.com/v1',
                apiKey: process.env.OPENAI_API_KEY!,
                model: 'gpt-5-mini',
            },
            'gemini-3-flash': {
                name: 'Gemini 3 Flash',
                apiType: 'google',
                baseUrl: 'https://generativelanguage.googleapis.com',
                apiKey: process.env.GOOGLE_API_KEY!,
                model: 'gemini-3-flash',
            },
        }
    }
}

// 声明函数工具
const fdm = {
    get_weather: {
        description: '获取指定城市的天气',
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

// 实现函数工具
export class Submission {
    public constructor(public weather: string, public advice: string) {}
}
const fnm: Function.Map<fdm> = {
    async get_weather({ city, unit }) {
        const data = { city, unit: unit ?? 'C', temperature: 26, sky: 'sunny' };
        return JSON.stringify(data);
    },
    async submit_result({ weather, advice }) {
        throw new Submission(weather, advice);
    },
};

// 初始化工作流上下文
const wfctx: InferenceContext = {
    busy: new RWLock(),
    cost(deltaCost) {
        console.log((-deltaCost).toFixed(2));
    },
    signal: null,
};

// 创建会话
const session: Session<fdm> = {
    developerMessage: RoleMessage.Developer.create([
        RoleMessage.Part.Text.create('你的工作是为用户查询天气，并给出穿衣建议。调用工具提交最终结果'),
    ]),
    chatMessages: [
        RoleMessage.User.create([ RoleMessage.Part.Text.create('请查询现在北京的天气，并给穿衣建议。') ]),
    ],
};

// 选择推理引擎
const adaptor = Adaptor.create(config);
const engine = adaptor.makeEngine('gpt-5-mini', fdm, Function.ToolChoice.REQUIRED);

// 使用 agentloop 驱动智能体循环，最多 8 轮对话
try {
    for await (const text of agentloop(wfctx, session, engine, fnm, 8)) console.log(text);
} catch (e) {
    if (e instanceof Submission) {} else throw e;
    console.log(e.weather);
    console.log(e.advice);
}
```
