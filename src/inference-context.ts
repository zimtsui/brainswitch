import { RWLock } from '@zimtsui/coroutine-locks';
import { Channel } from '@zimtsui/typelog';
import * as Presets from '@zimtsui/typelog/presets';


export interface InferenceContext {
	ratelimited?: RWLock;
	logger: InferenceContext.Logger;
	signal?: AbortSignal;
}

export namespace InferenceContext {
	export interface Logger {
		inference?: Channel<typeof Presets.Level, string>;
		message?: Channel<typeof Presets.Level, unknown>;
		cost?: (deltaCost: number) => void;
	}
}
