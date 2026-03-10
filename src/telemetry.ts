import { Channel } from '@zimtsui/typelog';
import * as Presets from '@zimtsui/typelog/presets';
import { exporter } from '@zimtsui/typelog/exporter';


export const logger = {
    inference: Channel.create<typeof Presets.Level, string>(
        Presets.Level,
        (chunk: string, level) => exporter.stream({
            scope: '@zimtsui/brainswitch',
            channel: 'Inference',
            level,
            payload: chunk,
        }),
    ),
    message: Channel.create<typeof Presets.Level, unknown>(
        Presets.Level,
        (payload: unknown, level) => exporter.monolith({
            scope: '@zimtsui/brainswitch',
            channel: 'Message',
            level,
            payload,
        }),
    ),
};
