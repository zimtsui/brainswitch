import { Function } from '#@/function.ts';
import { CompatibleEngine } from '#@/compatible/engine.ts';
import { OpenAIChatCompletionsCompatibleStream } from '#@/compatible.d/openai-chatcompletions.d/stream.ts';
import { type InferenceContext } from '#@/inference-context.ts';
import { type Session, RoleMessage } from '#@/compatible/session.ts';
import { OpenAIChatCompletionsToolCodec } from '#@/api-types/openai-chatcompletion/tool-codec.ts';
import { OpenAIChatCompletionsCompatibleMessageCodec } from '#@/compatible.d/openai-chatcompletions/message-codec.ts';
import { OpenAIChatCompletionsBilling } from '#@/api-types/openai-chatcompletion/billing.ts';
import { ToolCallValidator } from '#@/compatible/tool-call-validator.ts';
import { AliyunTransport } from '#@/compatible.d/aliyun/transport.ts';



export class AliyunEngine<in out fdm extends Function.Declaration.Map> extends CompatibleEngine<fdm> {
    protected toolCodec: OpenAIChatCompletionsToolCodec<fdm>;
    protected messageCodec: OpenAIChatCompletionsCompatibleMessageCodec<fdm>;
    protected billing: OpenAIChatCompletionsBilling<fdm>;
    protected toolCallValidator: ToolCallValidator<fdm>;
    protected transport: AliyunTransport<fdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: AliyunEngine.Options<fdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? false;
        this.toolCodec = new OpenAIChatCompletionsToolCodec({
            fdm: this.fdm,
            parallelToolCall: this.parallelToolCall,
        });
        this.messageCodec = new OpenAIChatCompletionsCompatibleMessageCodec({ toolCodec: this.toolCodec });
        this.billing = new OpenAIChatCompletionsBilling({ pricing: this.pricing });
        this.toolCallValidator = new ToolCallValidator({ toolChoice: this.toolChoice });
        this.transport = new AliyunTransport({
            inferenceParams: this.inferenceParams,
            providerSpec: this.providerSpec,
            fdm: this.fdm,
            throttle: this.throttle,
            toolChoice: this.toolChoice,
            messageCodec: this.messageCodec,
            toolCodec: this.toolCodec,
            billing: this.billing,
            toolCallValidator: this.toolCallValidator,
            parallelToolCall: this.parallelToolCall,
        });
    }

    public override infer(
        wfctx: InferenceContext,
        session: Session<fdm>,
        signal?: AbortSignal,
    ): Promise<RoleMessage.Ai<fdm>> {
        return this.transport.fetch(wfctx, session, signal);
    }
}

export namespace AliyunEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends
        CompatibleEngine.Options<fdm>
    {}
}
