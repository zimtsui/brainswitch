import test from 'ava';
import * as VerbatimCodec from '../build/verbatim/codec.js';


const verbatimDeclarationMap = {
    submit: {
        description: 'Submit an article.',
        parameters: {
            title: {
                description: 'Article title.',
                mimeType: 'text/plain',
            },
            body: {
                description: 'Article body.',
                mimeType: 'text/markdown',
            },
        },
    },
    attachment: {
        description: 'Attach a file.',
        parameters: {
            file: {
                description: 'File content.',
                mimeType: 'application/octet-stream',
            },
        },
    },
};

test('Verbatim declarations codec renders channel metadata', t => {
    const xml = VerbatimCodec.Declarations.encode(verbatimDeclarationMap);

    t.regex(xml, /<verbatim:declaration name="submit">/);
    t.regex(xml, /<verbatim:description>Submit an article\.<\/verbatim:description>/);
    t.regex(xml, /<verbatim:parameter name="title">/);
    t.regex(xml, /<verbatim:mime-type>text\/markdown<\/verbatim:mime-type>/);
    t.regex(xml, /<verbatim:declaration name="attachment">/);
});

test('Verbatim request codec decodes multiple requests with CDATA payloads', t => {
    const requests = VerbatimCodec.Request.decode(`
        <verbatim:request name="submit">
            <verbatim:argument name="title"><![CDATA[Hello]]></verbatim:argument>
            <verbatim:argument name="body"><![CDATA[# Heading
math: $x^2$
]]></verbatim:argument>
        </verbatim:request>
        <verbatim:request name="attachment">
            <verbatim:argument name="file"><![CDATA[binary-ish <content>]]></verbatim:argument>
        </verbatim:request>
    `, verbatimDeclarationMap);

    t.is(requests.length, 2);
    t.is(requests[0]!.name, 'submit');
    t.deepEqual(requests[0]!.args, {
        title: 'Hello',
        body: '# Heading\nmath: $x^2$\n',
    });
    t.is(requests[1]!.name, 'attachment');
    t.deepEqual(requests[1]!.args, {
        file: 'binary-ish <content>',
    });
});

test('Verbatim request codec accepts flexible whitespace around request and argument attributes', t => {
    const requests = VerbatimCodec.Request.decode(`
        prefix text ignored
        <verbatim:request   name = "submit"   >
            <verbatim:argument   name = "title"   ><![CDATA[Hello]]></verbatim:argument   >
            <verbatim:argument   name = "body"   ><![CDATA[Body]]></verbatim:argument   >
        </verbatim:request   >
        suffix text ignored
    `, verbatimDeclarationMap);

    t.is(requests.length, 1);
    t.is(requests[0]!.name, 'submit');
    t.deepEqual(requests[0]!.args, {
        title: 'Hello',
        body: 'Body',
    });
});

test('Verbatim request codec accepts single-quoted attribute values', t => {
    const requests = VerbatimCodec.Request.decode(`
        <verbatim:request name='submit'>
            <verbatim:argument name='title'><![CDATA[Hello]]></verbatim:argument>
            <verbatim:argument name='body'><![CDATA[Body]]></verbatim:argument>
        </verbatim:request>
    `, verbatimDeclarationMap);

    t.is(requests.length, 1);
    t.deepEqual(requests[0]!.args, {
        title: 'Hello',
        body: 'Body',
    });
});

test('Verbatim request codec accepts mixed quotes and blank lines around CDATA', t => {
    const requests = VerbatimCodec.Request.decode(`
        <verbatim:request name='submit'>
            <verbatim:argument name="title">

                <![CDATA[Hello]]>

            </verbatim:argument>
            <verbatim:argument name='body'>
                <![CDATA[Body]]>
            </verbatim:argument>
        </verbatim:request>
    `, verbatimDeclarationMap);

    t.is(requests.length, 1);
    t.deepEqual(requests[0]!.args, {
        title: 'Hello',
        body: 'Body',
    });
});

test('Verbatim request codec accepts requests packed together without separators', t => {
    const requests = VerbatimCodec.Request.decode(
        '<verbatim:request name="submit">' +
        '<verbatim:argument name="title"><![CDATA[A]]></verbatim:argument>' +
        '<verbatim:argument name="body"><![CDATA[B]]></verbatim:argument>' +
        '</verbatim:request>' +
        '<verbatim:request name="attachment">' +
        '<verbatim:argument name="file"><![CDATA[C]]></verbatim:argument>' +
        '</verbatim:request>',
        verbatimDeclarationMap,
    );

    t.is(requests.length, 2);
    t.deepEqual(requests[0]!.args, {
        title: 'A',
        body: 'B',
    });
    t.deepEqual(requests[1]!.args, {
        file: 'C',
    });
});

test('Verbatim request codec preserves whitespace inside CDATA payloads', t => {
    const requests = VerbatimCodec.Request.decode(`
        <verbatim:request name="submit">
            <verbatim:argument name="title"><![CDATA[  Hello  ]]></verbatim:argument>
            <verbatim:argument name="body"><![CDATA[
  line 1

    line 2
]]></verbatim:argument>
        </verbatim:request>
    `, verbatimDeclarationMap);

    t.deepEqual(requests[0]!.args, {
        title: '  Hello  ',
        body: '\n  line 1\n\n    line 2\n',
    });
});

test('Verbatim request codec rejects unknown channels', t => {
    const error = t.throws(() => VerbatimCodec.Request.decode(`
        <verbatim:request name="missing">
            <verbatim:argument name="title"><![CDATA[Hello]]></verbatim:argument>
        </verbatim:request>
    `, verbatimDeclarationMap));

    t.regex(error.message, /Channel not found: missing/);
});

test('Verbatim request codec rejects missing arguments', t => {
    const error = t.throws(() => VerbatimCodec.Request.decode(`
        <verbatim:request name="submit">
            <verbatim:argument name="title"><![CDATA[Hello]]></verbatim:argument>
        </verbatim:request>
    `, verbatimDeclarationMap));

    t.regex(error.message, /Argument body of channel submit is missing\./);
});

test('Verbatim request codec rejects duplicate arguments', t => {
    const error = t.throws(() => VerbatimCodec.Request.decode(`
        <verbatim:request name="submit">
            <verbatim:argument name="title"><![CDATA[A]]></verbatim:argument>
            <verbatim:argument name="title"><![CDATA[B]]></verbatim:argument>
            <verbatim:argument name="body"><![CDATA[Body]]></verbatim:argument>
        </verbatim:request>
    `, verbatimDeclarationMap));

    t.regex(error.message, /Duplicate argument: title/);
});
