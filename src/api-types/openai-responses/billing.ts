import OpenAI from 'openai';


export class OpenAIResponsesBilling {
    public constructor(protected ctx: OpenAIResponsesBilling.Context) {}


    public charge(usage: OpenAI.Responses.ResponseUsage): number {
        const cacheHitTokenCount = usage.input_tokens_details.cached_tokens;
        const cacheMissTokenCount = usage.input_tokens - cacheHitTokenCount;
        return (
            this.ctx.inputPrice * cacheMissTokenCount / 1e6 +
            this.ctx.cachePrice * cacheHitTokenCount / 1e6 +
            this.ctx.outputPrice * usage.output_tokens / 1e6
        );
    }
}

export namespace OpenAIResponsesBilling {
    export interface Context {
        inputPrice: number;
        cachePrice: number;
        outputPrice: number;
    }
}
