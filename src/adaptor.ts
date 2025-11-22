import { Config } from '#config';
import { Function } from './function.ts';
import { type Engine } from './engine.ts';
import assert from 'node:assert';
import { OpenAIChatCompletionsEngine } from './api-types/openai-chatcompletions.ts';
import { GoogleRestfulEngine } from './api-types/google-rest.ts';
import { OpenRouterMonolithEngine } from './api-types/openrouter-monolith.ts';
import { OpenRouterStreamEngine } from './api-types/openrouter-stream.ts';
import { AliyunStreamEngine } from './api-types/aliyun-stream.ts';
import { OpenAIResponsesEngine } from './api-types/openai-responses.ts';
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
        if (!this.throttles.has(baseUrl))
            this.throttles.set(baseUrl, new Map<string, Throttle>());
        if (!this.throttles.get(baseUrl)!.has(model))
            this.throttles.get(baseUrl)!.set(model, new Throttle(rpm));
        return this.throttles.get(baseUrl)!.get(model)!;
    }

    public makeEngine<fdm extends Function.Declaration.Map = {}>(
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
            return OpenAIResponsesEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'openai-chatcompletions')
            return OpenAIChatCompletionsEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'google')
            return GoogleRestfulEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'aliyun-stream')
            return AliyunStreamEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'openrouter-monolith')
            return OpenRouterMonolithEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'openrouter-stream')
            return OpenRouterStreamEngine.create<fdm>(options);
        else throw new Error();
    }
}
