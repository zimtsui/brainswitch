import { Engine } from '../engine.ts';
import { Function } from '../function.ts';
import { OpenAIChatCompletionsMonolithAPIBase } from './openai-chatcompletions-monolith-base.ts';


export namespace OpenAIChatCompletionsAPI {
	export function makeEngine<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		const api = new Constructor<fdm>(options);
		return api.monolith.bind(api);
	}

	export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsMonolithAPIBase<fdm> {}
}
