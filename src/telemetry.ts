import { type Channel } from '@zimtsui/typelog';
import * as Presets from '@zimtsui/typelog/presets';


export interface Logger {
    inference?: Channel<typeof Presets.Level, string>;
    message?: Channel<typeof Presets.Level, unknown>;
}
