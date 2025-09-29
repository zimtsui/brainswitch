import { Config } from '#config';
import { Function } from './function.ts';
import { Engine } from './engine.ts';
import assert from 'node:assert';
import { OpenAIChatCompletionsAPI } from './api-types/openai-chatcompletions.ts';
import { GoogleRESTfulAPI } from './api-types/google-rest.ts';
import { OpenRouterMonolithAPI } from './api-types/openrouter-monolith.ts';
import { OpenRouterStreamAPI } from './api-types/openrouter-stream.ts';
import { QwenAPI } from './api-types/qwen.ts';
import { OpenAIResponsesAPI } from './api-types/openai-responses.ts';
import { HuggingFaceCerebrasQwen3ThinkingAPI } from './api-types/huggingface-cerebras-qwen3-thinking.ts';
import { Throttle } from './throttle.ts';


export class Adaptor {
	public static create(config: Config): Adaptor {
		return new Adaptor(config);
	}

	protected constructor(public config: Config) {}

	private throttles = new Map<string, Map<string, Throttle>>();
	public getThrottle(endpointId: string): Throttle {
		assert(endpointId in this.config.brainswitch.endpoints);
		const baseUrl = this.config.brainswitch.endpoints[endpointId]!.baseUrl;
		const model = this.config.brainswitch.endpoints[endpointId]!.model;
		const rpm = this.config.brainswitch.endpoints[endpointId]!.rpm ?? Number.POSITIVE_INFINITY;
		const tpm = this.config.brainswitch.endpoints[endpointId]!.tpm ?? Number.POSITIVE_INFINITY;
		if (!this.throttles.has(baseUrl))
			this.throttles.set(baseUrl, new Map<string, Throttle>());
		if (!this.throttles.get(baseUrl)!.has(model))
			this.throttles.get(baseUrl)!.set(model, new Throttle(rpm, tpm));
		return this.throttles.get(baseUrl)!.get(model)!;
	}

	public createEngine<fdm extends Function.Declaration.Map = {}>(
		endpoint: string,
		functionDeclarationMap: fdm,
		functionCallMode?: Function.ToolChoice<fdm>,
	): Engine<Function.Declaration.From<fdm>> {
		assert(endpoint in this.config.brainswitch.endpoints);
		const endpointSpec = this.config.brainswitch.endpoints[endpoint]!;
		const throttle = this.getThrottle(endpoint);
		const options: Engine.Options<fdm> = {
			...endpointSpec,
			functionDeclarationMap,
			functionCallMode,
			throttle,
		};
		if (endpointSpec.apiType === 'openai-responses')
			return OpenAIResponsesAPI.create<fdm>(options);
		else if (endpointSpec.apiType === 'openai-chatcompletions')
			return OpenAIChatCompletionsAPI.create<fdm>(options);
		else if (endpointSpec.apiType === 'google')
			return GoogleRESTfulAPI.create<fdm>(options);
		else if (endpointSpec.apiType === 'qwen')
			return QwenAPI.create<fdm>(options);
		else if (endpointSpec.apiType === 'openrouter-monolith')
			return OpenRouterMonolithAPI.create<fdm>(options);
		else if (endpointSpec.apiType === 'openrouter-stream')
			return OpenRouterStreamAPI.create<fdm>(options);
		else if (endpointSpec.apiType === 'huggingface-cerebras-qwen3-thinking')
			return HuggingFaceCerebrasQwen3ThinkingAPI.create<fdm>(options);
		else throw new Error();
	}
}
