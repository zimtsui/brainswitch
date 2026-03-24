import { RWLock } from '@zimtsui/coroutine-locks';


export interface InferenceContext {
    busy?: RWLock;
    signal?: AbortSignal;
    cost?(deltaCost: number): void;
}
