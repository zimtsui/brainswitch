import { ChatCompletion } from '../chat-completion.ts';
import { Function } from '../function.ts';
import { OpenAIChatCompletionsMonolithAPIBase } from './openai-chatcompletions-monolith-base.ts';


export class OpenAIChatCompletionsAPI<in out fd extends Function.Declaration = never> extends OpenAIChatCompletionsMonolithAPIBase<fd> {
	public static create<fd extends Function.Declaration = never>(options: ChatCompletion.Options<fd>): ChatCompletion<fd> {
		const api = new OpenAIChatCompletionsAPI<fd>(options);
		return api.monolith.bind(api);
	}
}
