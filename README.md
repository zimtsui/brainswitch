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
import { type Config } from '@zimtsui/brainswitch';

// 配置推理服务商 API 接入点
export const config: Config = {
    brainswitch: {
        endpoints: {
            'gpt-5.4-mini': {
                name: 'GPT-5.4 mini',
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
```

## 对话

```ts
import { Adaptor, RoleMessage, type Session } from '@zimtsui/brainswitch';
import { config } from './config.ts';


// 创建会话
const session: Session<never, never> = {
    developerMessage: new RoleMessage.Developer([
        RoleMessage.Part.Text.paragraph('You are a helpful assistant.'),
    ]),
    chatMessages: [
        new RoleMessage.User([ RoleMessage.Part.Text.paragraph('Hello!') ]),
    ],
};

// 选择推理引擎
const adaptor = Adaptor.create(config);
const engine = adaptor.makeCompatibleEngine<{}, {}>({
    endpoint: 'gpt-5.4-mini',
    functionDeclarationMap: {},
    verbatimDeclarationMap: {},
});

const response = await engine.stateless({}, session);
console.log(response.getText());
```

## 智能体

```ts
import { Adaptor, agentloop, RoleMessage, Function, type Session, Structuring } from '@zimtsui/brainswitch';
import { Type } from '@sinclair/typebox';
import { config } from './config.ts';

// 声明函数工具
const fdm = {
    get_weather: {
        description: '获取指定城市的天气',
        parameters: Type.Object({
            city: Type.String(),
            unit: Type.Optional(Type.Union([Type.Literal('C'), Type.Literal('F')]))
        }),
    },
    submit_result: {
        description: '提交最终结果',
        parameters: Type.Object({
            weather: Type.String(),
            advice: Type.String(),
        }),
    },
} satisfies Function.Decl.Map.Proto;
type fdm = typeof fdm;
type fdu = Function.Decl.From<fdm>;

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

// 创建会话
const session: Session<fdu, never> = {
    developerMessage: new RoleMessage.Developer([
        RoleMessage.Part.Text.paragraph('你的工作是为用户查询天气，并给出穿衣建议。调用工具提交最终结果'),
    ]),
    chatMessages: [
        new RoleMessage.User([ RoleMessage.Part.Text.paragraph('请查询现在北京的天气，并给穿衣建议。') ]),
    ],
};

// 选择推理引擎
const adaptor = Adaptor.create(config);
const engine = adaptor.makeCompatibleEngine<fdm, {}>({
    endpoint: 'gpt-5.4-mini',
    functionDeclarationMap: fdm,
    verbatimDeclarationMap: {},
    structuringChoice: Structuring.Choice.FCall.REQUIRED,
});

// 使用 agentloop 驱动智能体循环，最多 8 轮对话
try {
    for await (const text of agentloop({}, session, engine, fnm, 8)) console.log(text);
} catch (e) {
    if (e instanceof Submission) {} else throw e;
    console.log(e.weather);
    console.log(e.advice);
}
```

### XML Verbatim 频道

When a LLM outputs structured data in JSON format, if there are too many special characters in the parameters (for example, a large Markdown document containing a lot of LaTeX math formulas), the LLM is prone to make mistakes in JSON escaping.

XML Verbatim Channel is designed to avoid escaping in structured output of large text.

```ts
import { Adaptor, RoleMessage, type Session, Structuring, Verbatim } from '@zimtsui/brainswitch';
import Assets from '@zimtsui/brainswitch/assets';
import * as Codec from '@zimtsui/brainswitch/codec';
import { config } from './config.ts';

// 声明 XML Verbatim 频道
const vdm = {
    bash: {
        description: '执行 Bash 命令',
        parameters: {
            command: {
                description: 'Bash 命令',
                mimeType: 'text/plain',
            },
        },
    },
} satisfies Verbatim.Decl.Map.Proto;
type vdm = typeof vdm;
type vdu = Verbatim.Decl.From<vdm>;


// 创建会话
const session: Session<never, vdu> = {
    developerMessage: new RoleMessage.Developer([
        Assets.verbatim.instruction,
        RoleMessage.Part.Text.paragraph('# Available Verbatim Channels'),
        RoleMessage.Part.Text.paragraph(Codec.Declarations.encode(vdm)),
    ]),
    chatMessages: [
        new RoleMessage.User([ RoleMessage.Part.Text.paragraph('请使用 Bash 命令查询当前系统时间。') ]),
    ],
};

// 选择推理引擎
const adaptor = Adaptor.create(config);
const engine = adaptor.makeCompatibleEngine<{}, vdm>({
    endpoint: 'gpt-5.4-mini',
    functionDeclarationMap: {},
    verbatimDeclarationMap: vdm,
    structuringChoice: Structuring.Choice.VRequest.ANYONE,
});

const response = await engine.stateless({}, session);
console.log(response.getOnlyVerbatimRequest().args.command);
```
