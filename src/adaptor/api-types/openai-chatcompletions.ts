import { Engine } from '../engine.ts';
import { Function } from '../function.ts';
import { OpenAIChatCompletionsMonolithAPIBase } from './openai-chatcompletions-monolith-base.ts';


export class OpenAIChatCompletionsAPI<in out fd extends Function.Declaration = never> extends OpenAIChatCompletionsMonolithAPIBase<fd> {
	public static create<fd extends Function.Declaration = never>(options: Engine.Options<fd>): Engine<fd> {
		const api = new OpenAIChatCompletionsAPI<fd>(options);
		return api.monolith.bind(api);
	}
}
