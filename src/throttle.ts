import type { InferenceContext } from './inference-context.ts';
import { Mutex } from '@zimtsui/coroutine-locks';


export class Throttle {
    private valve = new Mutex();
    private interval: number;
    public constructor(private rpm: number) {
        this.interval = Math.ceil(60*1000 / this.rpm);
    }

    public async requests(ctx: InferenceContext): Promise<void> {
        await ctx.busy?.acquireRead();
        await this.valve.acquire();
        setTimeout(() => void this.valve.release(), this.interval);
        ctx.busy?.releaseRead();
    }
}
