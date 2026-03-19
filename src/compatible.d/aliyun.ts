import { Function } from '../function.ts';
import { OpenAIChatCompletionsEngine } from '../api-types/openai-chat-completions.ts';
import { OpenAIChatCompletionsCompatibleEngine } from './openai-chatcompletions/transport.ts';
import { CompatibleEngine } from '../compatible-engine.ts';
import { OpenAIChatCompletionsCompatibleStreamEngine } from './openai-chatcompletions.d/stream.ts';
import { type InferenceContext } from '../inference-context.ts';
import { type Session, RoleMessage } from '../session.ts';
import * as Undici from 'undici';
import { Throttle } from '../throttle.ts';
import { Engine } from '../engine.ts';
import OpenAI from 'openai';



export namespace AliyunEngine {
    export interface Options<in out fdm extends Function.Declaration.Map> extends
        OpenAIChatCompletionsCompatibleStreamEngine.Options<fdm> {}

    export interface OwnProps {
        client: OpenAI;
    }
    export namespace OwnProps {
        export function init<fdm extends Function.Declaration.Map>(
            this: OpenAIChatCompletionsCompatibleStreamEngine.Underhood<fdm>,
            options: Options<fdm>,
        ): OwnProps {
            return {
                client: new OpenAI({
                    baseURL: this.baseUrl,
                    apiKey: this.apiKey,
                    fetchOptions: {
                        dispatcher: this.proxyAgent,
                    },
                }),
            }
        }
    }

    export interface ChatCompletionChunkChoiceDelta extends OpenAI.ChatCompletionChunk.Choice.Delta {
        reasoning_content?: string;
    }

    export interface Underhood<in out fdm extends Function.Declaration.Map> extends
        OpenAIChatCompletionsCompatibleStreamEngine.Underhood<fdm>
    {
        getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string;
    }

    export function getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
        return (delta as AliyunEngine.ChatCompletionChunkChoiceDelta).reasoning_content ?? '';
    }

    export class Instance<in out fdm extends Function.Declaration.Map> implements AliyunEngine.Underhood<fdm> {
        public baseUrl: string;
        public apiKey: string;
        public model: string;
        public name: string;
        public inputPrice: number;
        public outputPrice: number;
        public cachePrice: number;
        public fdm: fdm;
        public additionalOptions?: Record<string, unknown>;
        public throttle: Throttle;
        public timeout?: number;
        public maxTokens?: number;
        public proxyAgent?: Undici.ProxyAgent;

        public toolChoice: Function.ToolChoice<fdm>;

        public parallelToolCall: boolean;

        public client: OpenAI;

        public constructor(options: AliyunEngine.Options<fdm>) {
            ({
                baseUrl: this.baseUrl,
                apiKey: this.apiKey,
                model: this.model,
                name: this.name,
                inputPrice: this.inputPrice,
                outputPrice: this.outputPrice,
                cachePrice: this.cachePrice,
                fdm: this.fdm,
                additionalOptions: this.additionalOptions,
                throttle: this.throttle,
                timeout: this.timeout,
                maxTokens: this.maxTokens,
                proxyAgent: this.proxyAgent,
            } = (Engine.OwnProps.init<fdm>).call(this, options));
            ({ toolChoice: this.toolChoice } = (CompatibleEngine.OwnProps.init<fdm>).call(this, options));
            ({ parallelToolCall: this.parallelToolCall } = (OpenAIChatCompletionsEngine.OwnProps.init<fdm>).call(this, options));
            ({ client: this.client } = (AliyunEngine.OwnProps.init<fdm>).call(this, options));
        }

        public getDeltaThoughts(delta: OpenAI.ChatCompletionChunk.Choice.Delta): string {
            return (AliyunEngine.getDeltaThoughts).call(this, delta);
        }
    }


    export function create<fdm extends Function.Declaration.Map>(options: CompatibleEngine.Options<fdm>): CompatibleEngine<fdm> {
        return new AliyunEngine.Instance<fdm>(options);
    }
}
