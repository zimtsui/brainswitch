import { Type } from '@sinclair/typebox';
import { type Static } from '@sinclair/typebox';


export type Config = Static<typeof Config.schema>;
export namespace Config {
	export const schema = Type.Object({
		brainswitch: Type.Object({
			suite: Type.Object({
				summarize: Type.String(),
				agentloop: Type.String(),
			}),
		}),
	});
}
