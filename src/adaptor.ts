import { Config } from '#config';
import { Function } from './function.ts';
import { type Engine } from './engine.ts';
import assert from 'node:assert';
import { Throttle } from './throttle.ts';
import { OpenAIChatCompletionsEngine } from './engine.d/openai-chatcompletions.ts';
import { GoogleRestfulEngine } from './engine.d/google-rest.ts';
import { OpenRouterMonolithEngine } from './engine.d/openrouter-monolith.ts';
import { OpenRouterStreamEngine } from './engine.d/openrouter-stream.ts';
import { AliyunEngine } from './engine.d/aliyun.ts';
import { OpenAIResponsesEngine } from './engine.d/openai-responses.ts';
import { AnthropicEngine } from './engine.d/anthropic.ts';


export class Adaptor {
    public static create(config: Config): Adaptor {
        return new Adaptor(config);
    }

    private throttles = new Map<string, Throttle>();
    protected constructor(public config: Config) {
        for (const endpointId in this.config.brainswitch.endpoints) {
            const rpm = this.config.brainswitch.endpoints[endpointId]!.rpm ?? Number.POSITIVE_INFINITY;
            this.throttles.set(endpointId, new Throttle(rpm));
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
        const throttle = this.throttles.get(endpoint);
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

    public makeOpenAIResponsesEngine<fdm extends Function.Declaration.Map = {}>(
        endpoint: string,
        functionDeclarationMap: fdm,
        toolChoice?: Function.ToolChoice<fdm>,
        parallelFunctionCall?: boolean,
        applyPatch?: boolean,
    ): OpenAIResponsesEngine<fdm> {
        const endpointSpec = this.config.brainswitch.endpoints[endpoint];
        assert(endpointSpec);
        const throttle = this.throttles.get(endpoint);
        assert(throttle);
        const options: OpenAIResponsesEngine.Options<fdm> = {
            ...endpointSpec,
            functionDeclarationMap,
            toolChoice,
            parallelFunctionCall,
            throttle,
            applyPatch,
        };
        assert(endpointSpec.apiType === 'openai-responses');
        return OpenAIResponsesEngine.create<fdm>(options);
    }
}
