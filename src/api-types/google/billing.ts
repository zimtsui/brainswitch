import * as Google from '@google/genai';
import type { Pricing } from '../../engine.ts';
import { logger } from '../../telemetry.ts';


export class GoogleBilling {
    public constructor(protected ctx: GoogleBilling.Context) {}

    public charge(usageMetadata: Google.GenerateContentResponseUsageMetadata): number {
        logger.message.debug(usageMetadata);

        if (usageMetadata?.promptTokenCount) {} else throw new Error('Prompt token count missing.', { cause: usageMetadata });
        const candidatesTokenCount = usageMetadata.candidatesTokenCount ?? 0;
        const cacheHitTokenCount = usageMetadata.cachedContentTokenCount ?? 0;
        const cacheMissTokenCount = usageMetadata.promptTokenCount - cacheHitTokenCount;
        const thinkingTokenCount = usageMetadata.thoughtsTokenCount ?? 0;
        const cost =
            this.ctx.pricing.inputPrice * cacheMissTokenCount / 1e6 +
            this.ctx.pricing.cachePrice * cacheHitTokenCount / 1e6 +
            this.ctx.pricing.outputPrice * candidatesTokenCount / 1e6 +
            this.ctx.pricing.outputPrice * thinkingTokenCount / 1e6;
        return cost;
    }
}

export namespace GoogleBilling {
    export interface Context {
        pricing: Pricing
    }
}
