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
