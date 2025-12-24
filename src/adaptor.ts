import { Config } from '#config';
import { Function } from './function.ts';
import { type Engine } from './engine.ts';
import assert from 'node:assert';
import { Throttle } from './throttle.ts';
import { OpenAIChatCompletionsEngine } from './api-types/openai-chatcompletions.ts';
import { GoogleRestfulEngine } from './api-types/google-rest.ts';
import { OpenRouterMonolithEngine } from './api-types/openrouter-monolith.ts';
import { OpenRouterStreamEngine } from './api-types/openrouter-stream.ts';
import { AliyunEngine } from './api-types/aliyun.ts';
import { OpenAIResponsesEngine } from './api-types/openai-responses.ts';
import { AnthropicEngine } from './api-types/anthropic.ts';


export class Adaptor {
    public static create(config: Config): Adaptor {
        return new Adaptor(config);
    }

    private throttles: Record<string, Throttle> = {};
    protected constructor(public config: Config) {
        for (const endpointId in this.config.brainswitch.endpoints) {
            const rpm = this.config.brainswitch.endpoints[endpointId]!.rpm ?? Number.POSITIVE_INFINITY;
            this.throttles[endpointId] = new Throttle(rpm);
        }
    }

    public makeEngine<fdm extends Function.Declaration.Map = {}>(
        endpoint: string,
        functionDeclarationMap: fdm,
        toolChoice?: Function.ToolChoice<fdm>,
        parallelFunctionCall?: boolean,
    ): Engine<Function.Declaration.From<fdm>> {
        const endpointSpec = this.config.brainswitch.endpoints[endpoint];
        assert(endpointSpec);
        const throttle = this.throttles[endpoint];
        assert(throttle);
        const options: Engine.Options<fdm> = {
            ...endpointSpec,
            functionDeclarationMap,
            toolChoice,
            parallelFunctionCall,
            throttle,
        };
        if (endpointSpec.apiType === 'openai-responses')
            return OpenAIResponsesEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'openai-chatcompletions')
            return OpenAIChatCompletionsEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'google')
            return GoogleRestfulEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'aliyun')
            return AliyunEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'openrouter-monolith')
            return OpenRouterMonolithEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'openrouter-stream')
            return OpenRouterStreamEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'anthropic')
            return AnthropicEngine.create<fdm>(options);
        else throw new Error();
    }
}
