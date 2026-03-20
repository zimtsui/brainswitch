import { ResponseInvalid } from '../../engine.ts';
import { RoleMessage, type Session } from './session.ts';
import { Function } from '../../function.ts';
import * as Google from '@google/genai';
import { GoogleCompatibleMessageCodec } from '../../compatible.d/google/message-codec.ts';
import type { GoogleToolCodec } from '../../api-types/google/tool-codec.ts';



export class GoogleNativeMessageCodec<fdm extends Function.Declaration.Map> {
    public constructor(protected ctx: GoogleNativeMessageCodec.Context<fdm>) {}


    public convertFromAiMessage(
        aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>,
    ): Google.Content {
        return aiMessage.getRaw();
    }

    public convertFromUserMessage(
        userMessage: RoleMessage.User<Function.Declaration.From<fdm>>,
    ): Google.Content {
        return this.ctx.compatibleMessageCodec.convertFromUserMessage(userMessage);
    }

    public convertFromDeveloperMessage(
        developerMessage: RoleMessage.Developer,
    ): Google.Content {
        return this.ctx.compatibleMessageCodec.convertFromDeveloperMessage(developerMessage);
    }

    public convertFromChatMessages(
        chatMessages: Session.ChatMessage<Function.Declaration.From<fdm>>[],
    ): Google.Content[] {
        return chatMessages.map(chatMessage => {
            if (chatMessage instanceof RoleMessage.User.Instance) return this.convertFromUserMessage(chatMessage);
            else if (chatMessage instanceof RoleMessage.Ai.Instance) return this.convertFromAiMessage(chatMessage);
            else throw new Error();
        });
    }

    public convertToAiMessage(
        content: Google.Content,
    ): RoleMessage.Ai<Function.Declaration.From<fdm>> {
        if (content.parts) {} else throw new Error();
        return RoleMessage.Ai.create(content.parts.flatMap(part => {
            const parts: RoleMessage.Ai.Part<Function.Declaration.From<fdm>>[] = [];
            let payload = false;
            if (part.text) {
                payload = true;
                parts.push(RoleMessage.Part.Text.create(part.text));
            }
            if (part.functionCall) {
                payload = true;
                parts.push(this.ctx.toolCodec.convertToFunctionCall(part.functionCall));
            }
            if (this.ctx.codeExecution && part.executableCode) {
                payload = true;
                if (part.executableCode.code) {} else throw new Error();
                if (part.executableCode.language) {} else throw new Error();
                parts.push(RoleMessage.Ai.Part.ExecutableCode.create(part.executableCode.code, part.executableCode.language));
            }
            if (this.ctx.codeExecution && part.codeExecutionResult) {
                payload = true;
                if (part.codeExecutionResult.outcome) {} else throw new Error();
                parts.push(RoleMessage.Ai.Part.CodeExecutionResult.create(part.codeExecutionResult.outcome, part.codeExecutionResult.output));
            }
            if (payload) {} else throw new ResponseInvalid('Unknown content part', { cause: content });
            return parts;
        }), content);
    }
}

export namespace GoogleNativeMessageCodec {
    export interface Context<fdm extends Function.Declaration.Map> {
        toolCodec: GoogleToolCodec<fdm>;
        compatibleMessageCodec: GoogleCompatibleMessageCodec<fdm>;
        codeExecution: boolean;
    }
}
