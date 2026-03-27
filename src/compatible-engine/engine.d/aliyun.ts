import { Function } from '../../function.ts';
import { CompatibleEngine } from '../../compatible-engine.ts';
import { type InferenceContext } from '../../inference-context.ts';
import { type Session, RoleMessage } from '../session.ts';
import { OpenAIChatCompletionsToolCodec } from '../../api-types/openai-chatcompletions/tool-codec.ts';
import { MessageCodec } from '../../compatible.d/openai-chatcompletions/message-codec.ts';
import { OpenAIChatCompletionsBilling } from '../../api-types/openai-chatcompletions/billing.ts';
import { Validator } from '../validation.ts';
import { AliyunTransport } from '../../compatible.d/aliyun/transport.ts';
import type { Verbatim } from '../../verbatim.ts';



export class AliyunCompatibleEngine<
    in out fdm extends Function.Decl.Map.Proto,
    in out vdm extends Verbatim.Decl.Map.Proto,
> extends CompatibleEngine<fdm, vdm> {
    protected toolCodec: OpenAIChatCompletionsToolCodec<fdm>;
    protected messageCodec: MessageCodec<fdm, vdm>;
    protected billing: OpenAIChatCompletionsBilling;
    protected validator: Validator.From<fdm, vdm>;
    protected transport: AliyunTransport<fdm, vdm>;
    protected override parallelToolCall: boolean;

    public constructor(options: AliyunCompatibleEngine.Options<fdm, vdm>) {
        super(options);
        this.parallelToolCall = options.parallelToolCall ?? false;
        this.toolCodec = new OpenAIChatCompletionsToolCodec({
            fdm: this.fdm,
            parallelToolCall: this.parallelToolCall,
        });
        this.messageCodec = new MessageCodec({
            toolCodec: this.toolCodec,
            vdm: this.vdm,
        });
        this.billing = new OpenAIChatCompletionsBilling({ pricing: this.pricing });
        this.validator = new Validator({ choice: this.choice });
        this.transport = new AliyunTransport({
            inferenceParams: this.inferenceParams,
            providerSpec: this.providerSpec,
            fdm: this.fdm,
            throttle: this.throttle,
            choice: this.choice,
            messageCodec: this.messageCodec,
            toolCodec: this.toolCodec,
            billing: this.billing,
            validator: this.validator,
            parallelToolCall: this.parallelToolCall,
        });
    }

}

export namespace AliyunCompatibleEngine {
    export interface Options<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends CompatibleEngine.Options<fdm, vdm> {}
}
