import { Type, type Static } from "@sinclair/typebox";


export type EndpointSpec = Static<typeof EndpointSpec.schema>;
export namespace EndpointSpec {
    export const schema = Type.Object({
        baseUrl: Type.String(),
        proxy: Type.Optional(Type.String()),
        apiKey: Type.String(),
        model: Type.String(),
        name: Type.String(),
        apiType: Type.Union([
            Type.Literal('openai-chatcompletions'),
            Type.Literal('openai-responses'),
            Type.Literal('google'),
            Type.Literal('aliyun-stream'),
            Type.Literal('openrouter-monolith'),
            Type.Literal('openrouter-stream'),
        ]),
        inputPrice: Type.Optional(Type.Number()),
        outputPrice: Type.Optional(Type.Number()),
        cachedPrice: Type.Optional(Type.Number()),
        customOptions: Type.Optional(Type.Record(Type.String(), Type.Any())),
        rpm: Type.Optional(Type.Number()),
        timeout: Type.Optional(Type.Number()),
        tokenLimit: Type.Optional(Type.Number()),
    });
}
