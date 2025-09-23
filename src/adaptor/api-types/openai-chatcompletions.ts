import { Engine } from '../engine.ts';
import { Function } from '../function.ts';
import { OpenAIChatCompletionsMonolithAPIBase } from './openai-chatcompletions-monolith-base.ts';


export class OpenAIChatCompletionsAPI<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsMonolithAPIBase<fdm> {
	public static create<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		const api = new OpenAIChatCompletionsAPI<fdm>(options);
		return api.monolith.bind(api);
	}
}
