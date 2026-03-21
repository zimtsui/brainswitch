## Architecture Diagram

```mermaid
classDiagram

Engine <|.. CompatibleEngine

Engine <|.. OpenAIResponsesNativeEngine
OpenAIResponsesNativeEngine o--> OpenAIResponsesNativeHelpers
OpenAIResponsesNativeHelpers o--> OpenAIResponsesHelpers

CompatibleEngine <|.. AliyunEngine
OpenAIChatCompletionsCompatibleHelpers o--> OpenAIChatCompletionsHelpers
OpenAIChatCompletionsCompatibleMonolithHelpers o--> OpenAIChatCompletionsCompatibleHelpers
OpenAIChatCompletionsCompatibleStreamHelpers o--> OpenAIChatCompletionsCompatibleHelpers
AliyunEngine o--> OpenAIChatCompletionsCompatibleStreamHelpers

CompatibleEngine <|.. OpenAICompatibleEngine
OpenAICompatibleEngine o--> OpenAIResponsesCompatibleHelpers
OpenAIResponsesCompatibleHelpers o--> OpenAIResponsesHelpers

```
