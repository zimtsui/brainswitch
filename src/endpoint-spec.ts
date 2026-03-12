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
            Type.Literal('openai-responses'),
            Type.Literal('google'),
            Type.Literal('aliyun'),
            Type.Literal('anthropic'),
        ]),
        inputPrice: Type.Optional(Type.Number()),
        outputPrice: Type.Optional(Type.Number()),
        cachePrice: Type.Optional(Type.Number()),
        additionalOptions: Type.Optional(Type.Record(Type.String(), Type.Any())),
        rpm: Type.Optional(Type.Number({ minimum: 0 })),
        timeout: Type.Optional(Type.Number({ minimum: 0 })),
        maxTokens: Type.Optional(Type.Number({ minimum: 0 })),
    });
}
