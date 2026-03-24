import { Adaptor, RoleMessage, type Session, Structuring, Verbatim } from '@zimtsui/brainswitch';
import { Type } from '@sinclair/typebox';
import { config } from './config.ts';

// 声明 Verbatim 消息通道
const vdm = {
    bash: {
        description: '执行 Bash 命令',
        paraschema: Type.Object({
            command: Type.String(),
        }),
    },
} satisfies Verbatim.Declaration.Map.Prototype;
type vdm = typeof vdm;
type vdu = Verbatim.Declaration.From<vdm>;


// 创建会话
const session: Session<never, vdu> = {
    developerMessage: new RoleMessage.Developer([
        RoleMessage.Part.Text.paragraph(''),
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
    structuringChoice: Structuring.Choice.VMessage.ANYONE,
});

const response = await engine.stateless({}, session);
console.log(response.getOnlyVerbatimMessage().args.command);
