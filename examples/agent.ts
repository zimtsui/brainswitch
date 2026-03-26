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
