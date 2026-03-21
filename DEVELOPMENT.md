## Architecture Diagram

```mermaid
classDiagram

Engine <|.. OpenAIResponsesNativeEngine
OpenAIResponsesNativeEngine o--> OpenAIResponsesHelpers

CompatibleEngine <|.. OpenAIResponsesCompatibleEngine
OpenAIResponsesCompatibleEngine o--> OpenAIResponsesHelpers

Engine <|.. CompatibleEngine

CompatibleEngine <|.. OpenAIChatCompletionsCompatibleEngine
OpenAIChatCompletionsCompatibleEngine o--> OpenAIChatCompletionsHelpers
OpenAIChatCompletionsCompatibleEngine <|.. OpenAIChatCompletionsCompatibleMonolithEngine
OpenAIChatCompletionsCompatibleEngine <|.. OpenAIChatCompletionsCompatibleStreamEngine
OpenAIChatCompletionsCompatibleStreamEngine <|.. AliyunEngine
```
