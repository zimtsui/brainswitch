import { RWLock } from '@zimtsui/coroutine-locks';


export interface InferenceContext {
    busy: RWLock | null;
    signal: AbortSignal | null;
    cost?(deltaCost: number): void;
}
