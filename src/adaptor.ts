import { Config } from '#config';
import { Function } from './function.ts';
import { type CompatibleEngine } from './compatible-engine.ts';
import assert from 'node:assert';
import { Throttle } from './throttle.ts';
import { OpenAIChatCompletionsCompatibleDefaultEngine } from './compatible-engines/openai-chatcompletions.d/default.ts';
import { GoogleCompatibleRestfulEngine } from './compatible-engines/google/restful-engine.ts';
import { AliyunEngine } from './compatible-engines/aliyun.ts';
import { OpenAIResponsesCompatibleEngine } from './compatible-engines/openai-responses.ts';
import { AnthropicCompatibleEngine } from './compatible-engines/anthropic.ts';
import { OpenAIResponsesNativeEngine } from './native-engines/openai-responses.ts';


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

    public makeEngine<fdm extends Function.Declaration.Map>(
        endpoint: string,
        functionDeclarationMap: fdm,
        toolChoice?: Function.ToolChoice<fdm>,
        parallelToolCall?: boolean,
    ): CompatibleEngine<fdm> {
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
            return OpenAIResponsesCompatibleEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'openai-chatcompletions')
            return OpenAIChatCompletionsCompatibleDefaultEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'google')
            return GoogleCompatibleRestfulEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'aliyun')
            return AliyunEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'anthropic')
            return AnthropicCompatibleEngine.create<fdm>(options);
        else throw new Error();
    }

    public makeOpenAIResponsesNativeEngine<fdm extends Function.Declaration.Map>(
        endpoint: string,
        functionDeclarationMap: fdm,
        applyPatch?: boolean,
        toolChoice?: Function.ToolChoice<fdm>,
        parallelToolCall?: boolean,
    ): OpenAIResponsesNativeEngine<fdm> {
        const endpointSpec = this.config.brainswitch.endpoints[endpoint];
        assert(endpointSpec?.apiType === 'openai-responses');
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
