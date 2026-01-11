import { Config } from '#config';
import { Function } from './function.ts';
import { type CompatibleEngine } from './compatible-engine.ts';
import assert from 'node:assert';
import { Throttle } from './throttle.ts';
import { OpenAIChatCompletionsEngine } from './compatible-engine.d/openai-chatcompletions.ts';
import { GoogleRestfulEngine } from './compatible-engine.d/google-rest.ts';
import { OpenRouterMonolithEngine } from './compatible-engine.d/openrouter-monolith.ts';
import { OpenRouterStreamEngine } from './compatible-engine.d/openrouter-stream.ts';
import { AliyunEngine } from './compatible-engine.d/aliyun.ts';
import { OpenAIResponsesEngine } from './compatible-engine.d/openai-responses.ts';
import { AnthropicEngine } from './compatible-engine.d/anthropic.ts';
import { OpenAIResponsesNativeEngine } from './native-engine.d/openai-responses/engine.ts';


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
        parallelToolCall?: boolean,
    ): CompatibleEngine<Function.Declaration.From<fdm>> {
        const endpointSpec = this.config.brainswitch.endpoints[endpoint];
        assert(endpointSpec);
        const throttle = this.throttles.get(endpoint);
        assert(throttle);
        const options: CompatibleEngine.Options<fdm> = {
            ...endpointSpec,
            functionDeclarationMap,
            toolChoice,
            parallelToolCall,
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

    public makeOpenAIResponsesNativeEngine<fdm extends Function.Declaration.Map = {}>(
        endpoint: string,
        functionDeclarationMap: fdm,
        applyPatch?: boolean,
        toolChoice?: Function.ToolChoice<fdm>,
        parallelToolCall?: boolean,
    ): OpenAIResponsesNativeEngine<fdm> {
        const endpointSpec = this.config.brainswitch.endpoints[endpoint];
        assert(endpointSpec);
        const throttle = this.throttles.get(endpoint);
        assert(throttle);
        const options: OpenAIResponsesNativeEngine.Options<fdm> = {
            ...endpointSpec,
            functionDeclarationMap,
            toolChoice,
            parallelToolCall,
            throttle,
            applyPatch,
        };
        assert(endpointSpec.apiType === 'openai-responses');
        return OpenAIResponsesNativeEngine.create<fdm>(options);
    }
}
