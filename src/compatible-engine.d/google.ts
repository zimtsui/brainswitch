import { CompatibleEngine } from '../compatible-engine.ts';
import { Function } from '../function.ts';
import * as MessageCodecModule from './google/message-codec.ts';
import { ToolCodec } from '../api-types/google/tool-codec.ts';
import { Billing } from '../api-types/google/billing.ts';
import { Validator } from '../compatible-engine/validation.ts';
import * as TransportModule from './google/transport.ts';
import type { Verbatim } from '../verbatim.ts';
import * as ChoiceCodecModule from './google/choice-codec.ts';



export type GoogleCompatibleEngine<
    fdm extends Function.Decl.Map.Proto,
    vdm extends Verbatim.Decl.Map.Proto,
> = GoogleCompatibleEngine.Instance<fdm, vdm>;
export namespace GoogleCompatibleEngine {
    export class Instance<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends CompatibleEngine.Instance<fdm, vdm> {
        protected toolCodec: ToolCodec<fdm>;
        protected messageCodec: GoogleCompatibleEngine.MessageCodec<fdm, vdm>;
        protected billing: Billing;
        protected override validator: Validator.From<fdm, vdm>;
        protected override transport: GoogleCompatibleEngine.Transport<fdm, vdm>;
        protected override parallelToolCall: boolean;

        public constructor(options: GoogleCompatibleEngine.Options<fdm, vdm>) {
            super(options);
            this.parallelToolCall = options.parallelToolCall ?? true;
            if (this.parallelToolCall) {} else throw new Error('Parallel tool calling is required by Google engine.');
            this.toolCodec = new ToolCodec({
                fdm: this.fdm,
            });
            this.messageCodec = new GoogleCompatibleEngine.MessageCodec({
                toolCodec: this.toolCodec,
                vdm: this.vdm,
            });
            this.billing = new Billing({ pricing: this.pricing });
            this.validator = new Validator({ choice: this.choice });
            this.transport = new GoogleCompatibleEngine.Transport({
                inferenceParams: this.inferenceParams,
                providerSpec: this.providerSpec,
                fdm: this.fdm,
                throttle: this.throttle,
                choice: this.choice,
                messageCodec: this.messageCodec,
                toolCodec: this.toolCodec,
                billing: this.billing,
                validator: this.validator,
            });
        }

    }

    export interface Options<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > extends CompatibleEngine.Options<fdm, vdm> {}

    export import Transport = TransportModule.Transport;
    export import MessageCodec = MessageCodecModule.MessageCodec;
    export import ChoiceCodec = ChoiceCodecModule;
}
