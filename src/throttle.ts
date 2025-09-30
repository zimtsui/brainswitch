import { FifoStack } from '@zimtsui/deque';
import assert from 'node:assert';
import type { InferenceContext } from './inference-context.ts';
import { Mutex } from '@zimtsui/coroutine-locks';

interface Request {
	token: number;
	time: number;
}

export class Throttle {
	private fifo = new FifoStack<Request>();
	private tokenCount = 0;
	private valve = new Mutex();
	private interval: number;
	public constructor(
		private rpm: number,
		private tpm: number,
		private redundancy = .5,
	) {
		this.interval = Math.ceil(60*1000 / this.rpm);
	}

	public async requests(ctx: InferenceContext): Promise<void> {
		await ctx.busy?.acquireRead();
		await this.valve.acquire();
		setTimeout(() => void this.valve.release(), this.interval);
		ctx.busy?.releaseRead();
	}

	public async inputTokens(deltaTokenCount: number, ctx: InferenceContext): Promise<void> {
		await ctx.busy?.acquireRead();
		try {
			while (this.tokenCount > this.tpm * (1-this.redundancy)) {
				assert(this.fifo.length, new Error('Overflow'));
				const { promise, resolve, reject } = Promise.withResolvers();
				const timeout = setTimeout(resolve, Math.max(this.fifo[0]!.time+60*1000-Date.now(), 0));
				ctx.signal?.addEventListener('abort', reject);
				await promise.finally(() => {
					ctx.signal?.removeEventListener('abort', reject);
					clearTimeout(timeout);
				});
				this.tokenCount -= this.fifo.popFront().token;
			}
			this.fifo.pushBack({ token: deltaTokenCount, time: Date.now() });
			this.tokenCount += deltaTokenCount;
		} finally {
			ctx.busy?.releaseRead();
		}
	}

	public outputTokens(deltaTokenCount: number): void {
		this.fifo.pushBack({ token: deltaTokenCount, time: Date.now() });
		this.tokenCount += deltaTokenCount;
	}
}
