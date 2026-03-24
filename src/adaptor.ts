import { Config } from '#@/config.ts';
import { Function } from '#@/function.ts';
import { type CompatibleEngine } from '#@/compatible/engine.ts';
import { Throttle } from '#@/throttle.ts';
import { GoogleCompatibleEngine } from '#@/compatible/engine.d/google.ts';
import { OpenAIResponsesCompatibleEngine } from '#@/compatible/engine.d/openai-responses.ts';
import { AnthropicCompatibleEngine } from '#@/compatible/engine.d/anthropic.ts';
import { AliyunEngine } from '#@/compatible/engine.d/aliyun.ts';
import { OpenAIResponsesNativeEngine } from '#@/native-engines.d/openai-responses/engine.ts';
import { GoogleNativeEngine } from '#@/native-engines.d/google/engine.ts';
import type { Verbatim } from './verbatim';
import type { Structuring } from './compatible/structuring';
import type { Structuring as OpenAIResponsesNativeStructuring } from './native-engines.d/openai-responses/structuring';


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

    public makeCompatibleEngine<
        fdm extends Function.Declaration.Map.Prototype,
        vdm extends Verbatim.Declaration.Map.Prototype,
    >(
        endpoint: string,
        functionDeclarationMap: fdm,
        verbatimDeclarationMap: vdm,
        choice?: Structuring.Choice.From<fdm, vdm>,
        parallelToolCall?: boolean,
    ): CompatibleEngine<fdm, vdm> {
        const endpointSpec = this.config.brainswitch.endpoints[endpoint];
        if (endpointSpec) {} else throw new Error();
        const throttle = this.throttles.get(endpoint);
        if (throttle) {} else throw new Error();
        const options: CompatibleEngine.Options<fdm, vdm> = {
            ...endpointSpec,
            functionDeclarationMap,
            verbatimDeclarationMap,
            choice,
            parallelToolCall,
            throttle,
        };
        if (endpointSpec.apiType === 'openai-responses')
            return new OpenAIResponsesCompatibleEngine<fdm, vdm>(options);
        else if (endpointSpec.apiType === 'google')
            return new GoogleCompatibleEngine<fdm, vdm>(options);
        else if (endpointSpec.apiType === 'aliyun')
            return new AliyunEngine<fdm, vdm>(options);
        else if (endpointSpec.apiType === 'anthropic')
            return new AnthropicCompatibleEngine<fdm, vdm>(options);
        else throw new Error();
    }

    public makeOpenAIResponsesNativeEngine<
        fdm extends Function.Declaration.Map.Prototype,
        vdm extends Verbatim.Declaration.Map.Prototype,
    >(
        endpoint: string,
        functionDeclarationMap: fdm,
        verbatimDeclarationMap: vdm,
        applyPatch?: boolean,
        choice?: OpenAIResponsesNativeStructuring.Choice.From<fdm, vdm>,
        parallelToolCall?: boolean,
    ): OpenAIResponsesNativeEngine<fdm, vdm> {
        const endpointSpec = this.config.brainswitch.endpoints[endpoint];
        if (endpointSpec?.apiType === 'openai-responses') {} else throw new Error();
        const throttle = this.throttles.get(endpoint);
        if (throttle) {} else throw new Error();
        const options: OpenAIResponsesNativeEngine.Options<fdm, vdm> = {
            ...endpointSpec,
            functionDeclarationMap,
            verbatimDeclarationMap,
            choice,
            parallelToolCall,
            throttle,
            applyPatch,
        };
        return new OpenAIResponsesNativeEngine(options);
    }

    public makeGoogleNativeEngine<
        fdm extends Function.Declaration.Map.Prototype,
        vdm extends Verbatim.Declaration.Map.Prototype,
    >(
        endpoint: string,
        functionDeclarationMap: fdm,
        verbatimDeclarationMap: vdm,
        choice?: Structuring.Choice.From<fdm, vdm>,
        codeExecution?: boolean,
        urlContext?: boolean,
        googleSearch?: boolean,
        parallelToolCall?: boolean,
    ): GoogleNativeEngine<fdm, vdm> {
        const endpointSpec = this.config.brainswitch.endpoints[endpoint];
        if (endpointSpec?.apiType === 'google') {} else throw new Error();
        const throttle = this.throttles.get(endpoint);
        if (throttle) {} else throw new Error();
        const options: GoogleNativeEngine.Options<fdm, vdm> = {
            ...endpointSpec,
            functionDeclarationMap,
            verbatimDeclarationMap,
            choice,
            parallelToolCall,
            throttle,
            codeExecution,
            urlContext,
            googleSearch,
        };
        return new GoogleNativeEngine(options);
    }
}
