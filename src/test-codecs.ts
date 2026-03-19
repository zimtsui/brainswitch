import test from 'ava';
import { Function } from './function.ts';
import { ResponseInvalid } from './engine.ts';
import { ToolCallValidator } from './compatible/tool-call-validator.ts';
import { GoogleToolCodec } from './api-types/google/tool-codec.ts';
import { GoogleCompatibleMessageCodec } from './compatible.d/google/message-codec.ts';
import { GoogleNativeMessageCodec } from './native-engines.d/google/message-codec.ts';
import { OpenAIResponsesToolCodec } from './api-types/openai-responses/tool-codec.ts';
import { OpenAIResponsesCompatibleMessageCodec } from './compatible.d/openai-responses/message-codec.ts';
import { OpenAIResponsesNativeMessageCodec } from './native-engines.d/openai-responses/message-codec.ts';
import { OpenAIResponsesNativeToolCallValidator } from './native-engines.d/openai-responses/tool-call-validator.ts';
import { Tool } from './native-engines.d/openai-responses/tool.ts';
import { GoogleBilling } from './api-types/google/billing.ts';
import { OpenAIResponsesBilling } from './api-types/openai-responses/billing.ts';
import { AnthropicBilling } from './api-types/anthropic/billing.ts';
import { RoleMessage } from './session.ts';
import * as Google from '@google/genai';
import * as OpenAIResponsesNative from './native-engines.d/openai-responses/session.ts';
import { fdm, type fdm as fdm_, type fdu } from './test-helpers.ts';


function makeFooCall() {
    return Function.Call.create<fdu>({
        id: 'fc-1',
        name: 'foo',
        args: { x: 1 },
    });
}

function makeBarCall() {
    return Function.Call.create<fdu>({
        id: 'fc-2',
        name: 'bar',
        args: { y: 'x' },
    });
}


test('ToolCallValidator enforces REQUIRED / allowlist / NONE', t => {
    const validator = new ToolCallValidator<fdm_>({ toolChoice: Function.ToolChoice.REQUIRED });
    const fooCall = makeFooCall();
    const barCall = makeBarCall();

    t.throws(() => validator.validate([]), { instanceOf: ResponseInvalid });
    t.notThrows(() => validator.validate([fooCall]));

    validator['ctx'].toolChoice = ['foo'];
    t.notThrows(() => validator.validate([fooCall]));
    t.throws(() => validator.validate([barCall]), { instanceOf: ResponseInvalid });

    validator['ctx'].toolChoice = Function.ToolChoice.NONE;
    t.notThrows(() => validator.validate([]));
    t.throws(() => validator.validate([fooCall]), { instanceOf: ResponseInvalid });
});

test('OpenAIResponsesNativeToolCallValidator enforces apply_patch allowlist', t => {
    const fooCall = makeFooCall();
    const applyPatchCall = Tool.ApplyPatch.Call.create({
        id: 'patch-1',
        call_id: 'call-1',
        operation: {
            type: 'update_file',
            path: 'a.ts',
            diff: 'diff',
        },
        status: 'completed',
        type: 'apply_patch_call',
    });

    const validator = new OpenAIResponsesNativeToolCallValidator<fdm_>({
        toolChoice: ['foo', Tool.Choice.APPLY_PATCH],
    });
    t.notThrows(() => validator.validate([fooCall, applyPatchCall]));

    const validatorWithoutPatch = new OpenAIResponsesNativeToolCallValidator<fdm_>({
        toolChoice: ['foo'],
    });
    t.throws(() => validatorWithoutPatch.validate([applyPatchCall]), { instanceOf: ResponseInvalid });
});

test('GoogleCompatibleMessageCodec converts user and ai messages', t => {
    const toolCodec = new GoogleToolCodec({ fdm, parallelToolCall: true });
    const codec = new GoogleCompatibleMessageCodec({ toolCodec });

    const userMessage = RoleMessage.User.create<fdu>([
        RoleMessage.Part.Text.create('hello'),
        Function.Response.create<Function.Declaration.From<fdm_, 'foo'>>({
            id: 'fc-1',
            name: 'foo',
            text: '{"ok":true}',
        }),
    ]);
    const userContent = codec.convertFromUserMessage(userMessage);
    t.is(userContent.role, 'user');
    t.is(userContent.parts?.[0]?.text, 'hello');
    t.truthy(userContent.parts?.[1]?.functionResponse);

    const aiContent = {
        role: 'model',
        parts: [
            { text: 'hi' },
            { functionCall: { id: 'fc-1', name: 'foo', args: { x: 1 } } },
        ],
    };
    const aiMessage = codec.convertToAiMessage(aiContent);
    t.is(aiMessage.getText(), 'hi');
    t.is(aiMessage.getFunctionCalls()[0]?.name, 'foo');
});

test('GoogleNativeMessageCodec reuses compatible message codec and decodes code execution parts', t => {
    const toolCodec = new GoogleToolCodec({ fdm, parallelToolCall: true });
    const compatibleMessageCodec = new GoogleCompatibleMessageCodec({ toolCodec });
    const codec = new GoogleNativeMessageCodec({
        toolCodec,
        compatibleMessageCodec,
        codeExecution: true,
    });

    const userContent = codec.convertFromUserMessage(RoleMessage.User.create<fdu>([
        RoleMessage.Part.Text.create('hello'),
    ]));
    t.is(userContent.role, 'user');

    const aiMessage = codec.convertToAiMessage({
        role: 'model',
        parts: [
            { text: 'hi' },
            { functionCall: { id: 'fc-1', name: 'foo', args: { x: 1 } } },
            { executableCode: { code: 'print(1)', language: Google.Language.PYTHON } },
            { codeExecutionResult: { outcome: Google.Outcome.OUTCOME_OK, output: '1' } },
        ],
    });
    t.is(aiMessage.getText(), 'hi');
    t.is(aiMessage.getFunctionCalls()[0]?.name, 'foo');
    t.is(aiMessage.getParts().length, 4);
});

test('OpenAIResponsesCompatibleMessageCodec converts user and ai messages', t => {
    const toolCodec = new OpenAIResponsesToolCodec({ fdm });
    const codec = new OpenAIResponsesCompatibleMessageCodec({ toolCodec });

    const userMessage = RoleMessage.User.create<fdu>([
        RoleMessage.Part.Text.create('hello'),
        Function.Response.create<Function.Declaration.From<fdm_, 'foo'>>({
            id: 'fc-1',
            name: 'foo',
            text: '{"ok":true}',
        }),
    ]);
    const input = codec.convertFromUserMessage(userMessage);
    t.is(input[0]?.type, 'message');
    t.is(input[1]?.type, 'function_call_output');

    const aiMessage = codec.convertToAiMessage([
        {
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: 'hi', annotations: [] }],
        },
        {
            id: 'fc_1',
            type: 'function_call',
            call_id: 'call_1',
            name: 'foo',
            arguments: '{"x":1}',
            status: 'completed',
        },
    ]);
    t.is(aiMessage.getText(), 'hi');
    t.is(aiMessage.getFunctionCalls()[0]?.name, 'foo');
});

test('OpenAIResponsesNativeMessageCodec converts apply_patch response', t => {
    const toolCodec = new OpenAIResponsesToolCodec({ fdm });
    const compatibleMessageCodec = new OpenAIResponsesCompatibleMessageCodec({ toolCodec });
    const codec = new OpenAIResponsesNativeMessageCodec({
        toolCodec,
        compatibleMessageCodec,
    });

    const input = codec.convertFromUserMessage(OpenAIResponsesNative.RoleMessage.User.create<
        Function.Declaration.From<fdm_>
    >([
        OpenAIResponsesNative.RoleMessage.Part.Text.create('hello'),
        Function.Response.create<Function.Declaration.From<fdm_, 'foo'>>({
            id: 'fc-1',
            name: 'foo',
            text: '{"ok":true}',
        }),
        Tool.ApplyPatch.Response.create({
            id: 'patch-1',
            failure: 'failure',
        }),
    ]));
    t.is(input[0]?.type, 'message');
    t.is(input[1]?.type, 'function_call_output');
    t.is(input[2]?.type, 'apply_patch_call_output');
});

test('GoogleBilling calculates cache hit / miss / thinking cost', t => {
    const billing = new GoogleBilling({
        pricing: {
            inputPrice: 1,
            cachePrice: 2,
            outputPrice: 3,
        },
    });
    const charge = billing.charge({
        promptTokenCount: 100,
        cachedContentTokenCount: 25,
        candidatesTokenCount: 10,
        thoughtsTokenCount: 5,
    });
    t.is(charge, (75 + 50 + 30 + 15) / 1e6);
});

test('OpenAIResponsesBilling calculates cache hit / miss cost', t => {
    const billing = new OpenAIResponsesBilling({
        pricing: {
            inputPrice: 1,
            cachePrice: 2,
            outputPrice: 3,
        },
    });
    const charge = billing.charge({
        input_tokens: 100,
        input_tokens_details: { cached_tokens: 20 },
        output_tokens: 10,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 110,
    });
    t.true(Math.abs(charge - (80 + 40 + 30) / 1e6) < 1e-12);
});

test('AnthropicBilling calculates cache hit / miss cost', t => {
    const billing = new AnthropicBilling({
        pricing: {
            inputPrice: 1,
            cachePrice: 2,
            outputPrice: 3,
        },
    });
    const charge = billing.charge({
        input_tokens: 100,
        output_tokens: 10,
        cache_read_input_tokens: 20,
        cache_creation_input_tokens: 0,
        cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
        inference_geo: 'unknown',
        server_tool_use: { web_fetch_requests: 0, web_search_requests: 0 },
        service_tier: 'standard',
    });
    t.true(Math.abs(charge - (80 + 40 + 30) / 1e6) < 1e-12);
});
