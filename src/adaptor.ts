import { Config } from '#config';
import { Function } from './function.ts';
import { type CompatibleEngine } from './compatible-engine.ts';
import { Throttle } from './throttle.ts';
import { GoogleCompatibleEngine } from './compatible-engine.d/google.ts';
import { AliyunEngine } from './compatible.d/aliyun.ts';
import { OpenAIResponsesCompatibleEngine } from './compatible.d/openai-responses.ts';
import { AnthropicCompatibleEngine } from './compatible.d/anthropic.ts';
import { OpenAIResponsesNativeEngine } from './native-engines.d/openai-responses/engine.ts';
import { GoogleNativeEngine } from './native-engines.d/google/engine.ts';


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
        if (endpointSpec) {} else throw new Error();
        const throttle = this.throttles.get(endpoint);
        if (throttle) {} else throw new Error();
        const options: CompatibleEngine.Options<fdm> = {
            ...endpointSpec,
            functionDeclarationMap,
            toolChoice,
            parallelToolCall,
            throttle,
        };
        if (endpointSpec.apiType === 'openai-responses')
            return OpenAIResponsesCompatibleEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'google')
            return new GoogleCompatibleEngine<fdm>(options);
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
        if (endpointSpec?.apiType === 'openai-responses') {} else throw new Error();
        const throttle = this.throttles.get(endpoint);
        if (throttle) {} else throw new Error();
        const options: OpenAIResponsesNativeEngine.Options<fdm> = {
            ...endpointSpec,
            functionDeclarationMap,
            toolChoice,
            parallelToolCall,
            throttle,
            applyPatch,
        };
        return OpenAIResponsesNativeEngine.create<fdm>(options);
    }

    public makeGoogleNativeEngine<fdm extends Function.Declaration.Map>(
        endpoint: string,
        functionDeclarationMap: fdm,
        toolChoice?: Function.ToolChoice<fdm>,
        codeExecution?: boolean,
        urlContext?: boolean,
        googleSearch?: boolean,
        parallelToolCall?: boolean,
    ): GoogleNativeEngine<fdm> {
        const endpointSpec = this.config.brainswitch.endpoints[endpoint];
        if (endpointSpec?.apiType === 'google') {} else throw new Error();
        const throttle = this.throttles.get(endpoint);
        if (throttle) {} else throw new Error();
        const options: GoogleNativeEngine.Options<fdm> = {
            ...endpointSpec,
            functionDeclarationMap,
            toolChoice,
            parallelToolCall,
            throttle,
            codeExecution,
            urlContext,
            googleSearch,
        };
        return GoogleNativeEngine.create<fdm>(options);
    }
}
