import type { Pricing } from '../../engine.ts';
import OpenAI from 'openai';
import { Function } from '../../function.ts';


export class OpenAIChatCompletionsBilling<in out fdm extends Function.Declaration.Map> {
    public constructor(protected ctx: OpenAIChatCompletionsBilling.Context) {}

    public charge(usage: OpenAI.CompletionUsage): number {
        const cacheHitTokenCount = usage.prompt_tokens_details?.cached_tokens ?? 0;
        const cacheMissTokenCount = usage.prompt_tokens - cacheHitTokenCount;
        return (
            this.ctx.pricing.inputPrice * cacheMissTokenCount / 1e6 +
            this.ctx.pricing.cachePrice * cacheHitTokenCount / 1e6 +
            this.ctx.pricing.outputPrice * usage.completion_tokens / 1e6
        );
    }
}

export namespace OpenAIChatCompletionsBilling {
    export interface Context {
        pricing: Pricing
    }
}
