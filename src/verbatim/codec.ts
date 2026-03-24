import { Verbatim } from '#@/verbatim.ts';
import Ajv from 'ajv';

const ajv = new Ajv();



export function encode<vdu extends Verbatim.Declaration.Prototype>(
    message: Verbatim.Message.Of<vdu>,
): string {
    let result = `<verbatim name="${message.name}">\n`;
    for (const [key, value] of Object.entries(message.args)) {
        result += `<${key}><![CDATA[\n${value}\n]]></${key}>\n`;
    }
    result += `</verbatim>`;
    return result;
}

/**
 * @throws {@link InvalidSchema}
 * @throws {@link ChannelNotFound}
 */
export function decode<
    vdm extends Verbatim.Declaration.Map.Prototype,
>(str: string, vdm: vdm): Verbatim.Message.From<vdm>[] {
    type vdu = Verbatim.Declaration.From<vdm>;
    const parts: Verbatim.Message.Of<vdu>[] = [];
    const rawMessages = extractVerbatim(str);
    for (const [name, args] of rawMessages) {
        const vditem = vdm[name];
        if (vditem) {} else throw new ChannelNotFound();
        if (ajv.validate(vditem.paraschema, args)) {} else throw new InvalidSchema();
        const options = { name, args } as Verbatim.Message.Options.Of<vdu>;
        parts.push(Verbatim.Message.create(options));
    }
    return parts;
}

export class InvalidSchema {}
export class ChannelNotFound {}


export const XML_PHRASE_START = /[a-zA-Z_]/;
export const XML_PHRASE_CHAR = /[a-zA-Z0-9_\-.]/;
export const XML_TAG_NAME = new RegExp(`(?:${XML_PHRASE_START.source})(?:${XML_PHRASE_CHAR.source})*`);
export const XML_TAG_NS_NAME = new RegExp(`(?:(?<tag_ns>${XML_TAG_NAME.source}):)?(?<tag_name>${XML_TAG_NAME.source})`);


export const XML_ARG_CDATA = new RegExp(
    `<(?<arg_cdata_name>${XML_TAG_NS_NAME.source})\\s*>` +
    `\\s*<!\\[CDATA\\[(?<arg_cdata_body>[\\s\\S]*?)\\]\\]>\\s*` +
    `</\\k<arg_cdata_name>\\s*>`,
);


export const XML_ATTR_VAL = /(?<attr_val_quote>['"])(?<attr_val_body>[\s\S]+?)\k<attr_val_quote>/;
export const XML_VERBATIM = new RegExp(
    `<verbatim\\s+name\\s*=\\s*(?:${XML_ATTR_VAL.source})\\s*>` +
    `(?<verbatim_body>[\\s\\S]*?)` +
    `<\\/verbatim\\s*>`,
);

function extractArgs(str: string): Record<string, string> {
    const results: Record<string, string> = {};
    for (const match of str.matchAll(new RegExp(XML_ARG_CDATA, 'g')))
        results[match.groups!.arg_cdata_name!] = match.groups!.arg_cdata_body!;
    return results;
}

function extractVerbatim(str: string): [name: string, params: Record<string, string>][] {
    const results: [name: string, params: Record<string, string>][] = [];
    for (const match of str.matchAll(new RegExp(XML_VERBATIM, 'g')))
        results.push([match.groups!.attr_val_body!, extractArgs(match.groups!.verbatim_body!)]);
    return results;
}
