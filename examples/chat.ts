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
