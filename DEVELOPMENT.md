```mermaid
classDiagram

OpenAIResponsesEngine <|.. OpenAIResponsesNativeEngine

CompatibleEngine <|.. OpenAIResponsesCompatibleEngine
OpenAIResponsesEngine <|.. OpenAIResponsesCompatibleEngine
Engine <|.. OpenAIResponsesEngine

Engine <|.. CompatibleEngine

Engine <|.. OpenAIChatCompletionsEngine
OpenAIChatCompletionsEngine <|.. OpenAIChatCompletionsCompatibleEngine
CompatibleEngine <|.. OpenAIChatCompletionsCompatibleEngine
OpenAIChatCompletionsCompatibleEngine <|.. OpenAIChatCompletionsCompatibleMonolithEngine
OpenAIChatCompletionsCompatibleEngine <|.. OpenAIChatCompletionsCompatibleStreamEngine
```
