import type { InferenceContext } from './inference-context.ts';
import { Mutex } from '@zimtsui/coroutine-locks';


export class Throttle {
    private valve = new Mutex();
    private timer?: NodeJS.Timeout;
    private interval: number;
    public constructor(private rpm: number) {
        this.interval = Math.ceil(60*1000 / this.rpm);
    }

    public async requests(ctx: InferenceContext): Promise<void> {
        await ctx.busy?.acquireRead();
        const pwr = Promise.withResolvers<void>();
        const callback = () => pwr.reject(ctx.signal?.reason);
        ctx.signal?.addEventListener('abort', callback);
        const waiting = this.valve.acquire();
        try {
            await Promise.race([waiting, pwr.promise]);
            this.timer = setTimeout(() => void this.valve.release(), this.interval);
        } catch (e) {
            waiting.then(() => this.valve.release()).catch(() => {});
            throw e;
        } finally {
            ctx.signal?.removeEventListener('abort', callback);
            ctx.busy?.releaseRead();
        }
    }

    public throw(e: Error) {
        if (this.timer) clearTimeout(this.timer);
        this.valve.throw(e);
    }
}
