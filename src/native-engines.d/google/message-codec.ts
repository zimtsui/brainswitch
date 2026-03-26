import { ResponseInvalid } from '#@/engine.ts';
import { RoleMessage, type Session } from '#@/native-engines.d/google/session.ts';
import { Function } from '#@/function.ts';
import * as Google from '@google/genai';
import { MessageCodec as CompatibleMessageCodec } from '#@/compatible.d/google/message-codec.ts';
import type { ToolCodec } from '#@/api-types/google/tool-codec.ts';
import { Verbatim } from '#@/verbatim.ts';
import * as VerbatimCodec from '#@/verbatim/codec.ts';



export class GoogleNativeMessageCodec<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> {
    public constructor(protected ctx: GoogleNativeMessageCodec.Context<fdm, vdm>) {}


    public convertFromAiMessage(
        aiMessage: RoleMessage.Ai.From<fdm, vdm>,
    ): Google.Content {
        return aiMessage.getRaw();
    }

    public convertFromUserMessage(
        userMessage: RoleMessage.User.From<fdm>,
    ): Google.Content {
        return this.ctx.compatibleMessageCodec.convertFromUserMessage(userMessage);
    }

    public convertFromDeveloperMessage(
        developerMessage: RoleMessage.Developer,
    ): Google.Content {
        return this.ctx.compatibleMessageCodec.convertFromDeveloperMessage(developerMessage);
    }

    public convertFromChatMessages(
        chatMessages: Session.ChatMessage.From<fdm, vdm>[],
    ): Google.Content[] {
        return chatMessages.map(chatMessage => {
            if (chatMessage instanceof RoleMessage.User) return this.convertFromUserMessage(chatMessage);
            else if (chatMessage instanceof RoleMessage.Ai) return this.convertFromAiMessage(chatMessage);
            else throw new Error();
        });
    }

    public convertToAiMessage(
        content: Google.Content,
    ): RoleMessage.Ai.From<fdm, vdm> {
        if (content.parts) {} else throw new Error();
        return new RoleMessage.Ai(content.parts.flatMap(part => {
            const parts: RoleMessage.Ai.Part.From<fdm, vdm>[] = [];
            let payload = false;
            if (part.text) {
                payload = true;
                const vms = VerbatimCodec.decode(part.text, this.ctx.vdm);
                parts.push(new RoleMessage.Part.Text(part.text, vms));
            }
            if (part.functionCall) {
                payload = true;
                parts.push(this.ctx.toolCodec.convertToFunctionCall(part.functionCall));
            }
            if (this.ctx.codeExecution && part.executableCode) {
                payload = true;
                if (part.executableCode.code) {} else throw new Error();
                if (part.executableCode.language) {} else throw new Error();
                parts.push(new RoleMessage.Ai.Part.ExecutableCode(part.executableCode.code, part.executableCode.language));
            }
            if (this.ctx.codeExecution && part.codeExecutionResult) {
                payload = true;
                if (part.codeExecutionResult.outcome) {} else throw new Error();
                parts.push(new RoleMessage.Ai.Part.CodeExecutionResult(part.codeExecutionResult.outcome, part.codeExecutionResult.output));
            }
            if (payload) {} else throw new ResponseInvalid('Unknown content part', { cause: content });
            return parts;
        }), content);
    }
}

export namespace GoogleNativeMessageCodec {
    export interface Context<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > {
        toolCodec: ToolCodec<fdm>;
        compatibleMessageCodec: CompatibleMessageCodec<fdm, vdm>;
        codeExecution: boolean;
        vdm: vdm;
    }
}
