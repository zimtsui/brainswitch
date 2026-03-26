# XML Verbatim Channel

## Motivation

When a LLM outputs structured data in JSON format, if there are too many special characters in the parameters (for example, a large Markdown document containing a lot of LaTeX math formulas), the LLM is prone to make mistakes in JSON escaping.

**XML Verbatim Channel** is designed to avoid escaping in structured output of large text.

## Declaration

The system or the user will declare all available XML Verbatim Channels in the form of

<verbatim:declaration name="CHANNEL_1_NAME">
    <verbatim:description>DESCRIPTION_OF_CHANNEL_1</verbatim:description>
    <verbatim:parameter name="PARAMETER_1_NAME">
        <verbatim:description>DESCRIPTION_OF_PARAMETER_1</verbatim:description>
        <verbatim:mime-type>VALUE_MIME_TYPE_OF_PARAMETER_1</verbatim:mime-type>
    </verbatim:parameter>
    <verbatim:parameter name="PARAMETER_2_NAME">
        <verbatim:description>DESCRIPTION_OF_PARAMETER_2</verbatim:description>
        <verbatim:mime-type>VALUE_MIME_TYPE_OF_PARAMETER_2</verbatim:mime-type>
    </verbatim:parameter>
    <verbatim:response>
        <verbatim:description>DESCRIPTION_OF_RESPONSES_OF_CHANNEL_1</verbatim:description>
        <verbatim:mime-type>VALUE_MIME_TYPE_OF_CHANNEL_1_RESPONSE</verbatim:mime-type>
    </verbatim:response>
</verbatim:declaration>

## 使用

You can output through the channel CHANNEL_1_NAME in the form of

<verbatim:request name="CHANNEL_1_NAME">
    <verbatim:argument name="PARAMETER_1_NAME"><![CDATA[PARAMETER_1_VALUE]]></verbatim:argument>
    <verbatim:argument name="PARAMETER_2_NAME"><![CDATA[PARAMETER_2_VALUE]]></verbatim:argument>
</verbatim:request>

-   All parameters are required
-   All arguments must be wrapped in CDATA

## Response

The channel CHANNEL_1_NAME returns response in the form of

<verbatim:response name="CHANNEL_1_NAME">
    <verbatim:status>successful</verbatim:status>
    <verbatim:body><![CDATA[RESPONSE_BODY]]></verbatim:body>
</verbatim:response>

or

<verbatim:response name="CHANNEL_1_NAME">
    <verbatim:status>failed</verbatim:status>
    <verbatim:detail><![CDATA[ERROR_DETAIL]]></verbatim:detail>
</verbatim:response>

# Available XML Verbatim Channels

<verbatim:declaration name="submit">
    <verbatim:description>提交文章</verbatim:description>
    <verbatim:parameter name="title">
        <verbatim:description>文章标题</verbatim:description>
        <verbatim:mime-type>text/plain</verbatim:mime-type>
    </verbatim:parameter>
    <verbatim:parameter name="body">
        <verbatim:description>文章内容</verbatim:description>
        <verbatim:mime-type>text/markdown;dialect=gfm+tex_math_dollars</verbatim:mime-type>
    </verbatim:parameter>
</verbatim:declaration>
