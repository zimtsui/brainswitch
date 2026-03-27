import type { InferenceContext } from './inference-context.ts';
import { Mutex } from '@zimtsui/coroutine-locks';


export class Throttle {
    protected valve = new Mutex();
    protected timer: NodeJS.Timeout | null = null;
    protected interval: number;
    public constructor(protected rpm: number) {
        this.interval = Math.ceil(60*1000 / this.rpm);
    }

    public async requests(wfctx: InferenceContext): Promise<void> {
        if (this.interval === Number.POSITIVE_INFINITY) return;

        await wfctx.busy?.acquireRead();
        try {
            wfctx.signal?.throwIfAborted();

            const waiting = this.valve.acquire()
                .finally(() => {
                    this.timer = setTimeout(
                        () => {
                            this.timer = null;
                            void this.valve.release();
                        },
                        this.interval,
                    );
                });

            await new Promise<void>((resolve, reject) => {
                waiting.then(resolve, reject);
                wfctx.signal?.addEventListener('abort', reject, { signal: wfctx.signal });
            });

        } finally {
            wfctx.busy?.releaseRead();
        }
    }

    public throw(e: Error) {
        if (this.timer) clearTimeout(this.timer);
        this.valve.throw(e);
    }
}
