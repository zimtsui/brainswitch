import OpenAI from 'openai';
import type { Pricing } from '../../engine.ts';


export class OpenAIResponsesBilling {
    public constructor(protected ctx: OpenAIResponsesBilling.Context) {}


    public charge(usage: OpenAI.Responses.ResponseUsage): number {
        const cacheHitTokenCount = usage.input_tokens_details.cached_tokens;
        const cacheMissTokenCount = usage.input_tokens - cacheHitTokenCount;
        return (
            this.ctx.pricing.inputPrice * cacheMissTokenCount / 1e6 +
            this.ctx.pricing.cachePrice * cacheHitTokenCount / 1e6 +
            this.ctx.pricing.outputPrice * usage.output_tokens / 1e6
        );
    }
}

export namespace OpenAIResponsesBilling {
    export interface Context {
        pricing: Pricing;
    }
}
