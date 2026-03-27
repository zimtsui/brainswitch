import { NetworkError, ResponseInvalid, type InferenceParams, type ProviderSpec } from '../../engine.ts';
import { RoleMessage, type Session } from '../../compatible-engine/session.ts';
import { Function } from '../../function.ts';
import type OpenAI from 'openai';
import * as Undici from 'undici';
import { type InferenceContext } from '../../inference-context.ts';
import { Throttle } from '../../throttle.ts';
import { logger } from '../../telemetry.ts';
import type { MessageCodec } from './message-codec.ts';
import type { ToolCodec } from '../../api-types/openai-responses/tool-codec.ts';
import type { Billing } from '../../api-types/openai-responses/billing.ts';
import type { Verbatim } from '../../verbatim.ts';
import { Validator } from '../../compatible-engine/validation.ts';
import * as ChoiceCodec from './choice-codec.ts';
import type { Structuring } from '../../compatible-engine/structuring.ts';
import type { Engine } from '../../engine.ts';


export class Transport<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> implements Engine.Transport<
    RoleMessage.User.From<fdm>,
    RoleMessage.Ai.From<fdm, vdm>,
    RoleMessage.Developer,
    Session.From<fdm, vdm>
> {
    protected apiURL: URL;

    public constructor(protected ctx: Transport.Context<fdm, vdm>) {
        this.apiURL = new URL(`${this.ctx.providerSpec.baseUrl}/responses`);
    }

    protected makeParams(
        session: Session.From<fdm, vdm>,
    ): OpenAI.Responses.ResponseCreateParamsNonStreaming {
        const tools = this.ctx.toolCodec.encodeFunctionDeclarationMap(this.ctx.fdm);
        return {
            model: this.ctx.inferenceSpec.model,
            include: ['reasoning.encrypted_content'],
            store: false,
            input: session.chatMessages.flatMap(chatMessage => this.ctx.messageCodec.encodeChatMessage(chatMessage)),
            instructions: session.developerMessage && this.ctx.messageCodec.encodeDeveloperMessage(session.developerMessage),
            tools: tools.length ? tools : undefined,
            tool_choice: tools.length ? ChoiceCodec.encode(this.ctx.choice) : undefined,
            parallel_tool_calls: tools.length ? this.ctx.parallelToolCall : undefined,
            max_output_tokens: this.ctx.inferenceSpec.maxTokens,
            ...this.ctx.inferenceSpec.additionalOptions,
        };
    }

    protected logAiMessage(output: OpenAI.Responses.ResponseOutputItem[]): void {
        for (const item of output)
            if (item.type === 'message') {
                if (item.content.every(part => part.type === 'output_text')) {} else throw new Error();
                logger.inference.debug(item.content.map(part => part.text).join(''));
            } else if (item.type === 'function_call')
                logger.message.debug(item);
    }

    public async fetch(
        wfctx: InferenceContext,
        session: Session.From<fdm, vdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai.From<fdm, vdm>> {
        await this.ctx.throttle.requests(wfctx);

        // Prepare request
        const params = this.makeParams(session);
        logger.message.trace(params);

        // Send request
        const res = await Undici.fetch(
            this.apiURL,
            {
                method: 'POST',
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.ctx.providerSpec.apiKey}`,
                }),
                body: JSON.stringify(params),
                dispatcher: this.ctx.providerSpec.proxyAgent,
                signal,
            },
        ).catch(e => {
            if (e instanceof TypeError)
                throw new NetworkError(undefined, { cause: e });
            else throw e;
        });

        // Get response
        if (res.ok) {} else throw new Error(undefined, { cause: res });
        const response = await res.json() as OpenAI.Responses.Response;
        logger.message.trace(response);

        // Validate response
        if (response.status === 'incomplete' && response.incomplete_details?.reason === 'max_output_tokens')
            throw new ResponseInvalid('Token limit exceeded.', { cause: response });
        if (response.status === 'completed') {}
        else throw new ResponseInvalid('Abnormal response status', { cause: response });
        if (response.usage) {} else throw new Error();
        this.logAiMessage(response.output);
        logger.message.debug(response.usage);
        wfctx.cost?.(this.ctx.billing.charge(response.usage));

        return this.ctx.messageCodec.decodeAiMessage(response.output);
    }
}

export namespace Transport {
    export interface Context<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > {
        inferenceSpec: InferenceParams;
        providerSpec: ProviderSpec;
        fdm: fdm;
        throttle: Throttle;
        choice: Structuring.Choice.From<fdm, vdm>;
        parallelToolCall: boolean;

        messageCodec: MessageCodec<fdm, vdm>;
        toolCodec: ToolCodec<fdm>;
        billing: Billing;
        validator: Validator.From<fdm, vdm>;
    }
}
