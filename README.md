# Brainswitch

Brainswitch 是一个为 AI 工作流设计的 LLM 推理 API 适配器，支持在会话中切换模型。

## Motivation

大多数 LLM 推理服务商不支持[严格函数调用](https://platform.openai.com/docs/guides/function-calling#strict-mode)，在 AI 批处理工作流中难以达到生产级的可靠性。如果仅使用 OpenAI、Google 等支持严格函数调用的服务商，那么可选的模型型号会大幅受限。

Brainswitch 支持在一次会话中途切换模型并保持对话上下文，包括 OpenAI、Google 的深度思考模型的加密思考内容。有了 Brainswitch 就可以在会话的大量推理阶段使用最合适的模型生成自然语言结果，在最后的总结阶段切换成支持严格函数调用的模型进行结构化提交。
