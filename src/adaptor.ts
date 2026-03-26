import { Config } from '#@/config.ts';
import { Function } from '#@/function.ts';
import { type CompatibleEngine } from '#@/compatible/engine.ts';
import { Throttle } from '#@/throttle.ts';
import { GoogleCompatibleEngine } from '#@/compatible/engine.d/google.ts';
import { OpenAIResponsesCompatibleEngine } from '#@/compatible/engine.d/openai-responses.ts';
import { AnthropicCompatibleEngine } from '#@/compatible/engine.d/anthropic.ts';
import { AliyunCompatibleEngine } from '#@/compatible/engine.d/aliyun.ts';
import { OpenAIResponsesNativeEngine } from '#@/native-engines.d/openai-responses/engine.ts';
import { GoogleNativeEngine } from '#@/native-engines.d/google/engine.ts';
import type { Verbatim } from '#@/verbatim.ts';
import type { Structuring } from '#@/compatible/structuring.ts';
import type { Structuring as OpenAIResponsesNativeStructuring } from '#@/native-engines.d/openai-responses/structuring.ts';


export class Adaptor {
    public static create(config: Config): Adaptor {
        return new Adaptor(config);
    }

    protected throttles = new Map<string, Throttle>();
    protected constructor(public config: Config) {
        for (const endpointId in this.config.brainswitch.endpoints) {
            const rpm = this.config.brainswitch.endpoints[endpointId]!.rpm ?? Number.POSITIVE_INFINITY;
            this.throttles.set(endpointId, new Throttle(rpm));
        }
    }

    public makeCompatibleEngine<
        fdm extends Function.Decl.Map.Proto,
        vdm extends Verbatim.Decl.Map.Proto,
    >(adaptorOptions: Adaptor.CompatibleEngine.Options<fdm, vdm>): CompatibleEngine<fdm, vdm> {
        const endpointSpec = this.config.brainswitch.endpoints[adaptorOptions.endpoint];
        if (endpointSpec) {} else throw new Error();
        const throttle = this.throttles.get(adaptorOptions.endpoint);
        if (throttle) {} else throw new Error();
        const options: CompatibleEngine.Options<fdm, vdm> = {
            ...endpointSpec,
            functionDeclarationMap: adaptorOptions.functionDeclarationMap,
            verbatimDeclarationMap: adaptorOptions.verbatimDeclarationMap,
            structuringChoice: adaptorOptions.structuringChoice,
            throttle,
        };
        if (endpointSpec.apiType === 'openai-responses')
            return new OpenAIResponsesCompatibleEngine<fdm, vdm>(options);
        else if (endpointSpec.apiType === 'google')
            return new GoogleCompatibleEngine<fdm, vdm>(options);
        else if (endpointSpec.apiType === 'aliyun')
            return new AliyunCompatibleEngine<fdm, vdm>(options);
        else if (endpointSpec.apiType === 'anthropic')
            return new AnthropicCompatibleEngine<fdm, vdm>(options);
        else throw new Error();
    }

    public makeOpenAIResponsesNativeEngine<
        fdm extends Function.Decl.Map.Proto,
        vdm extends Verbatim.Decl.Map.Proto,
    >(adaptorOptions: Adaptor.OpenAIResponsesNativeEngineOptions<fdm, vdm>): OpenAIResponsesNativeEngine<fdm, vdm> {
        const endpointSpec = this.config.brainswitch.endpoints[adaptorOptions.endpoint];
        if (endpointSpec?.apiType === 'openai-responses') {} else throw new Error();
        const throttle = this.throttles.get(adaptorOptions.endpoint);
        if (throttle) {} else throw new Error();
        const options: OpenAIResponsesNativeEngine.Options<fdm, vdm> = {
            ...endpointSpec,
            functionDeclarationMap: adaptorOptions.functionDeclarationMap,
            verbatimDeclarationMap: adaptorOptions.verbatimDeclarationMap,
            structuringChoice: adaptorOptions.structuringChoice,
            throttle,
            applyPatch: adaptorOptions.applyPatch,
        };
        return new OpenAIResponsesNativeEngine(options);
    }

    public makeGoogleNativeEngine<
        fdm extends Function.Decl.Map.Proto,
        vdm extends Verbatim.Decl.Map.Proto,
    >(adaptorOptions: Adaptor.GoogleNativeEngineOptions<fdm, vdm>): GoogleNativeEngine<fdm, vdm> {
        const endpointSpec = this.config.brainswitch.endpoints[adaptorOptions.endpoint];
        if (endpointSpec?.apiType === 'google') {} else throw new Error();
        const throttle = this.throttles.get(adaptorOptions.endpoint);
        if (throttle) {} else throw new Error();
        const options: GoogleNativeEngine.Options<fdm, vdm> = {
            ...endpointSpec,
            functionDeclarationMap: adaptorOptions.functionDeclarationMap,
            verbatimDeclarationMap: adaptorOptions.verbatimDeclarationMap,
            structuringChoice: adaptorOptions.structuringChoice,
            parallelToolCall: adaptorOptions.parallelToolCall,
            throttle,
            codeExecution: adaptorOptions.codeExecution,
            urlContext: adaptorOptions.urlContext,
            googleSearch: adaptorOptions.googleSearch,
        };
        return new GoogleNativeEngine(options);
    }
}

export namespace Adaptor {
    export namespace CompatibleEngine {
        export interface Options<
            in out fdm extends Function.Decl.Map.Proto,
            in out vdm extends Verbatim.Decl.Map.Proto,
        > {
            endpoint: string;
            functionDeclarationMap: fdm;
            verbatimDeclarationMap: vdm;
            structuringChoice?: Structuring.Choice.From<fdm, vdm>;
        }
    }

    export interface OpenAIResponsesNativeEngineOptions<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
     > {
        endpoint: string;
        functionDeclarationMap: fdm;
        verbatimDeclarationMap: vdm;
        applyPatch?: boolean;
        structuringChoice?: OpenAIResponsesNativeStructuring.Choice.From<fdm, vdm>;
    }

    export interface GoogleNativeEngineOptions<
        in out fdm extends Function.Decl.Map.Proto,
        in out vdm extends Verbatim.Decl.Map.Proto,
    > {
        endpoint: string;
        functionDeclarationMap: fdm;
        verbatimDeclarationMap: vdm;
        structuringChoice?: Structuring.Choice.From<fdm, vdm>;
        codeExecution?: boolean;
        urlContext?: boolean;
        googleSearch?: boolean;
        parallelToolCall?: boolean;
    }
}
