import type { Pricing } from '#@/engine.ts';
import Anthropic from '@anthropic-ai/sdk';


export class Billing {
    public constructor(protected ctx: Billing.Context) {}

    public charge(usage: Anthropic.Usage): number {
        const cacheHitTokenCount = usage.cache_read_input_tokens || 0;
        const cacheMissTokenCount = usage.input_tokens - cacheHitTokenCount;
        return (
            this.ctx.pricing.inputPrice * cacheMissTokenCount / 1e6 +
            this.ctx.pricing.cachePrice * cacheHitTokenCount / 1e6 +
            this.ctx.pricing.outputPrice * usage.output_tokens / 1e6
        );
    }
}

export namespace Billing {
    export interface Context {
        pricing: Pricing;
    }
}
