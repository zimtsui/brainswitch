import { OpenAIChatCompletionsEngine } from '../../api-types/openai-chat-completions.ts';
import { CompatibleEngine } from '../../compatible-engine.ts';
import { Engine } from '../../engine.ts';
import { type Function } from '../../function.ts';
import { type InferenceContext } from '../../inference-context.ts';
import { OpenAIChatCompletionsCompatibleEngine } from '../openai-chatcompletions.ts';
import { OpenAIChatCompletionsCompatibleMonolithEngine } from './monolith.ts';
import { type Session, RoleMessage } from '../../session.ts';
import OpenAI from 'openai';


export namespace OpenAIChatCompletionsCompatibleDefaultEngine {
    export function create<fdm extends Function.Declaration.Map>(options: CompatibleEngine.Options<fdm>): CompatibleEngine<fdm> {
        return new OpenAIChatCompletionsCompatibleDefaultEngine.Instance<fdm>(options);
    }

    export class Instance<in out fdm extends Function.Declaration.Map> implements OpenAIChatCompletionsCompatibleMonolithEngine.Instance<fdm> {
        protected engineBase: Engine.Base<fdm>;
        protected compatibleEngineBase: CompatibleEngine.Base<fdm>;
        protected openAIChatCompletionsEngineBase: OpenAIChatCompletionsEngine.Base<fdm>;
        protected openAIChatCompletionsCompatibleEngineBase: OpenAIChatCompletionsCompatibleEngine.Base<fdm>;
        protected openAIChatCompletionsCompatibleMonolithEngineBase: OpenAIChatCompletionsCompatibleMonolithEngine.Base<fdm>;

        public constructor(options: Engine.Options<fdm>) {
            this.engineBase = new Engine.Base.Instance<fdm>(this, options);
            this.compatibleEngineBase = new CompatibleEngine.Base.Instance<fdm>(this, options);
            this.openAIChatCompletionsEngineBase = new OpenAIChatCompletionsEngine.Base.Instance<fdm>(this, options);
            this.openAIChatCompletionsCompatibleEngineBase = new OpenAIChatCompletionsCompatibleEngine.Base.Instance<fdm>(this);
            this.openAIChatCompletionsCompatibleMonolithEngineBase = new OpenAIChatCompletionsCompatibleMonolithEngine.Base.Instance<fdm>(this);
        }


        public get baseUrl(): string {
            return this.engineBase.baseUrl;
        }
        public set baseUrl(value: string) {
            this.engineBase.baseUrl = value;
        }
        public get apiKey(): string {
            return this.engineBase.apiKey;
        }
        public set apiKey(value: string) {
            this.engineBase.apiKey = value;
        }
        public get model(): string {
            return this.engineBase.model;
        }
        public set model(value: string) {
            this.engineBase.model = value;
        }
        public get name(): string {
            return this.engineBase.name;
        }
        public set name(value: string) {
            this.engineBase.name = value;
        }
        public get inputPrice(): number {
            return this.engineBase.inputPrice;
        }
        public set inputPrice(value: number) {
            this.engineBase.inputPrice = value;
        }
        public get outputPrice(): number {
            return this.engineBase.outputPrice;
        }
        public set outputPrice(value: number) {
            this.engineBase.outputPrice = value;
        }
        public get cachedPrice(): number {
            return this.engineBase.cachedPrice;
        }
        public set cachedPrice(value: number) {
            this.engineBase.cachedPrice = value;
        }
        public get fdm(): fdm {
            return this.engineBase.fdm;
        }
        public set fdm(value: fdm) {
            this.engineBase.fdm = value;
        }
        public get additionalOptions(): Record<string, unknown> | undefined {
            return this.engineBase.additionalOptions;
        }
        public set additionalOptions(value: Record<string, unknown> | undefined) {
            this.engineBase.additionalOptions = value;
        }
        public get throttle() {
            return this.engineBase.throttle;
        }
        public set throttle(value) {
            this.engineBase.throttle = value;
        }
        public get timeout(): number | undefined {
            return this.engineBase.timeout;
        }
        public set timeout(value: number | undefined) {
            this.engineBase.timeout = value;
        }
        public get maxTokens(): number | undefined {
            return this.engineBase.maxTokens;
        }
        public set maxTokens(value: number | undefined) {
            this.engineBase.maxTokens = value;
        }
        public get proxyAgent() {
            return this.engineBase.proxyAgent;
        }
        public set proxyAgent(value) {
            this.engineBase.proxyAgent = value;
        }


        public get toolChoice(): Function.ToolChoice<fdm> {
            return this.compatibleEngineBase.toolChoice;
        }
        public set toolChoice(value: Function.ToolChoice<fdm>) {
            this.compatibleEngineBase.toolChoice = value;
        }
        public stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return this.compatibleEngineBase.stateless(ctx, session);
        }
        public stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>) {
            return this.compatibleEngineBase.stateful(ctx, session);
        }
        public appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return this.compatibleEngineBase.appendUserMessage(session, message);
        }
        public pushUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>) {
            return this.compatibleEngineBase.pushUserMessage(session, message);
        }


        public get parallel(): boolean {
            return this.openAIChatCompletionsEngineBase.parallel;
        }
        public set parallel(value: boolean) {
            this.openAIChatCompletionsEngineBase.parallel = value;
        }
        public convertFromFunctionCall(fc: Function.Call.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionMessageToolCall {
            return this.openAIChatCompletionsEngineBase.convertFromFunctionCall(fc);
        }
        public convertFromFunctionResponse(fr: Function.Response.Distributive<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionToolMessageParam {
            return this.openAIChatCompletionsEngineBase.convertFromFunctionResponse(fr);
        }
        public convertFromToolChoice(mode: Function.ToolChoice<fdm>): OpenAI.ChatCompletionToolChoiceOption {
            return this.openAIChatCompletionsEngineBase.convertFromToolChoice(mode);
        }
        public convertToFunctionCall(apifc: OpenAI.ChatCompletionMessageFunctionToolCall): Function.Call.Distributive<Function.Declaration.From<fdm>> {
            return this.openAIChatCompletionsEngineBase.convertToFunctionCall(apifc);
        }
        public convertFromFunctionDeclarationEntry(fdentry: Function.Declaration.Entry.From<fdm>): OpenAI.ChatCompletionTool {
            return this.openAIChatCompletionsEngineBase.convertFromFunctionDeclarationEntry(fdentry);
        }
        public calcCost(usage: OpenAI.CompletionUsage): number {
            return this.openAIChatCompletionsEngineBase.calcCost(usage);
        }
        public extractContent(completionContent: string): string {
            return this.openAIChatCompletionsEngineBase.extractContent(completionContent);
        }
        public handleFinishReason(completion: OpenAI.ChatCompletion, finishReason: OpenAI.ChatCompletion.Choice['finish_reason']): void {
            return this.openAIChatCompletionsEngineBase.handleFinishReason(completion, finishReason);
        }


        public fetch(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal) {
            return this.openAIChatCompletionsCompatibleEngineBase.fetch(ctx, session, signal);
        }
        public convertToAiMessage(message: OpenAI.ChatCompletionMessage): RoleMessage.Ai<Function.Declaration.From<fdm>> {
            return this.openAIChatCompletionsCompatibleEngineBase.convertToAiMessage(message);
        }
        public convertFromAiMessage(aiMessage: RoleMessage.Ai<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionAssistantMessageParam {
            return this.openAIChatCompletionsCompatibleEngineBase.convertFromAiMessage(aiMessage);
        }
        public convertFromDeveloperMessage(developerMessage: RoleMessage.Developer): OpenAI.ChatCompletionSystemMessageParam {
            return this.openAIChatCompletionsCompatibleEngineBase.convertFromDeveloperMessage(developerMessage);
        }
        public convertFromUserMessage(userMessage: RoleMessage.User<Function.Declaration.From<fdm>>): [OpenAI.ChatCompletionUserMessageParam] | OpenAI.ChatCompletionToolMessageParam[] {
            return this.openAIChatCompletionsCompatibleEngineBase.convertFromUserMessage(userMessage);
        }
        public convertFromRoleMessage(roleMessage: RoleMessage): OpenAI.ChatCompletionMessageParam[] {
            return this.openAIChatCompletionsCompatibleEngineBase.convertFromRoleMessage(roleMessage);
        }
        public validateToolCallsByToolChoice(toolCalls: Function.Call.Distributive<Function.Declaration.From<fdm>>[]): void {
            return this.openAIChatCompletionsCompatibleEngineBase.validateToolCallsByToolChoice(toolCalls);
        }


        public fetchRaw(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>, signal?: AbortSignal) {
            return this.openAIChatCompletionsCompatibleMonolithEngineBase.fetchRaw(ctx, session, signal);
        }
        public makeParams(session: Session<Function.Declaration.From<fdm>>): OpenAI.ChatCompletionCreateParamsNonStreaming {
            return this.openAIChatCompletionsCompatibleMonolithEngineBase.makeParams(session);
        }
    }
}
