import { Function } from '../function.ts';
import { CompatibleEngine } from '../compatible-engine.ts';
import { OpenAIChatCompletionsToolCodec } from '../api-types/openai-chatcompletions/tool-codec.ts';
import { MessageCodec } from './openai-chatcompletions/message-codec.ts';
import { OpenAIChatCompletionsBilling } from '../api-types/openai-chatcompletions/billing.ts';
import { Validator } from '../compatible-engine/validation.ts';
import * as TransportModule from './aliyun/transport.ts';
import type { Verbatim } from '../verbatim.ts';
import { OpenAIChatCompletionsCompatibleEngine } from './openai-chatcompletions.ts';



export type AliyunCompatibleEngine<
    fdm extends Function.Decl.Map.Proto,
    vdm extends Verbatim.Decl.Map.Proto,
> = AliyunCompatibleEngine.Instance<fdm, vdm>;
export namespace AliyunCompatibleEngine {
    export class Instance<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends OpenAIChatCompletionsCompatibleEngine.Instance<fdm, vdm> {
        protected toolCodec: OpenAIChatCompletionsToolCodec<fdm>;
        protected messageCodec: MessageCodec<fdm, vdm>;
        protected billing: OpenAIChatCompletionsBilling;
        protected override validator: Validator.From<fdm, vdm>;
        protected override transport: AliyunCompatibleEngine.Transport<fdm, vdm>;
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
            this.transport = new AliyunCompatibleEngine.Transport({
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
    export interface Options<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends CompatibleEngine.Options<fdm, vdm> {}

    export import Transport = TransportModule.Transport;
}
