import { Channel } from '@zimtsui/typelog';
import * as Presets from '@zimtsui/typelog/presets';
import { Exporter } from '@zimtsui/typelog/exporter';


export const logger = {
    inference: Channel.create<typeof Presets.Level, string>(
        Presets.Level,
        (chunk: string, level) => Exporter.getGlobalExporter().stream({
            scope: '@zimtsui/brainswitch',
            channel: 'Inference',
            level,
            payload: chunk,
        }),
    ),
    message: Channel.create<typeof Presets.Level, unknown>(
        Presets.Level,
        (payload: unknown, level) => Exporter.getGlobalExporter().monolith({
            scope: '@zimtsui/brainswitch',
            channel: 'Message',
            level,
            payload,
        }),
    ),
};
