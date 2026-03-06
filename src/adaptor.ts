import { Config } from '#config';
import { Function } from './function.ts';
import { type CompatibleEngine } from './compatible-engine.ts';
import { Throttle } from './throttle.ts';
import { GoogleCompatibleEngine } from './compatible-engines.d/google.ts';
import { AliyunEngine } from './compatible-engines.d/aliyun.ts';
import { OpenAIResponsesCompatibleEngine } from './compatible-engines.d/openai-responses.ts';
import { AnthropicCompatibleEngine } from './compatible-engines.d/anthropic.ts';
import { OpenAIResponsesNativeEngine } from './native-engines.d/openai-responses/engine.ts';
import { GoogleNativeEngine } from './native-engines.d/google/engine.ts';
import { type Logger } from './telemetry.ts';


export class Adaptor {
    public static create(config: Config, logger: Logger): Adaptor {
        return new Adaptor(config, logger);
    }

    private throttles = new Map<string, Throttle>();
    protected constructor(public config: Config, public logger: Logger) {
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
            logger: this.logger,
        };
        if (endpointSpec.apiType === 'openai-responses')
            return OpenAIResponsesCompatibleEngine.create<fdm>(options);
        else if (endpointSpec.apiType === 'google')
            return GoogleCompatibleEngine.create<fdm>(options);
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
            logger: this.logger,
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
            logger: this.logger,
        };
        return GoogleNativeEngine.create<fdm>(options);
    }
}
