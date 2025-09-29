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
		await ctx.ratelimited?.acquireRead();
		await this.valve.acquire();
		setTimeout(() => void this.valve.release(), this.interval);
		ctx.ratelimited?.releaseRead();
	}

	public async inputTokens(token: number, ctx: InferenceContext): Promise<void> {
		await ctx.ratelimited?.acquireRead();
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
			this.fifo.pushBack({ token, time: Date.now() });
			this.tokenCount += token;
		} finally {
			ctx.ratelimited?.releaseRead();
		}
	}

	public outputTokens(token: number): void {
		this.fifo.pushBack({ token, time: Date.now() });
		this.tokenCount += token;
	}

	// private static throttles = new Map<string, Map<string, Throttle>>();

	// public static getThrottle(endpointId: string): Throttle {
	// 	assert(endpointId in config.adaptors.endpoints);
	// 	const baseUrl = config.adaptors.endpoints[endpointId]!.baseUrl;
	// 	const modelId = config.adaptors.endpoints[endpointId]!.modelId;
	// 	const rpm = config.adaptors.endpoints[endpointId]!.rpm ?? Number.POSITIVE_INFINITY;
	// 	const tpm = config.adaptors.endpoints[endpointId]!.tpm ?? Number.POSITIVE_INFINITY;
	// 	if (!Throttle.throttles.has(baseUrl))
	// 		Throttle.throttles.set(baseUrl, new Map<string, Throttle>());
	// 	if (!Throttle.throttles.get(baseUrl)!.has(modelId))
	// 		Throttle.throttles.get(baseUrl)!.set(modelId, new Throttle(rpm, tpm));
	// 	return Throttle.throttles.get(baseUrl)!.get(modelId)!;
	// }
}
