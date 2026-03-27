import { Type } from '@sinclair/typebox';
import { EndpointSpec } from './endpoint-spec.ts';
import { type Static } from '@sinclair/typebox';


export type Config = Static<typeof Config.schema>;
export namespace Config {
    export const schema = Type.Object({
        brainswitch: Type.Object({
            endpoints: Type.Record(Type.String(), EndpointSpec.schema),
        }),
    });
}
