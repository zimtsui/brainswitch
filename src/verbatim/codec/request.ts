import { Verbatim } from '../../verbatim.ts';


/**
 * @throws {@link RequestInvalid}
 */
export function decode<
    vdm extends Verbatim.Decl.Map.Proto,
>(str: string, vdm: vdm): Verbatim.Request.From<vdm>[] {
    type vdu = Verbatim.Decl.From<vdm>;
    const parts: Verbatim.Request.Of<vdu>[] = [];
    const requests = extractRequests(str);
    for (const [channelName, args] of requests) {
        const vdbody = vdm[channelName];
        if (vdbody) {} else throw new Invalid('Channel not found: ' + channelName);
        for (const paramName of Object.keys(vdbody.parameters))
            if (typeof args[paramName] === 'string') {} else
                throw new Invalid(`Argument ${paramName} of channel ${channelName} is missing.`);
        const options = { name: channelName, args } as Verbatim.Request.Options.Of<vdu>;
        parts.push(Verbatim.Request.create(options));
    }
    return parts;
}

export class Invalid extends Error{}


const XML_ATTR_VAL = /(?<attr_val_quote>['"])(?<attr_val_body>[\s\S]+?)\k<attr_val_quote>/;
const REQUEST = new RegExp(
    `<verbatim:request\\s+name\\s*=\\s*(?:${XML_ATTR_VAL.source})\\s*>` +
    `(?<verbatim_body>[\\s\\S]*?)` +
    `</verbatim:request\\s*>`,
);
const ARG_CDATA = new RegExp(
    `<verbatim:argument\\s+name\\s*=\\s*(?:${XML_ATTR_VAL.source})\\s*>` +
    `\\s*<!\\[CDATA\\[(?<arg_cdata_body>[\\s\\S]*?)\\]\\]>\\s*` +
    `</verbatim:argument\\s*>`,
);

function extractArgs(str: string): Record<string, string> {
    const results: Record<string, string> = {};
    for (const match of str.matchAll(new RegExp(ARG_CDATA, 'g'))) {
        if (results[match.groups!.arg_cdata_name!] === undefined) {} else
            throw new Invalid('Duplicate argument: ' + match.groups!.arg_cdata_name!);
        results[match.groups!.arg_cdata_name!] = match.groups!.arg_cdata_body!;
    }
    return results;
}

function extractRequests(requests: string): [name: string, params: Record<string, string>][] {
    const results: [name: string, params: Record<string, string>][] = [];
    for (const match of requests.matchAll(new RegExp(REQUEST, 'g')))
        results.push([match.groups!.attr_val_body!, extractArgs(match.groups!.verbatim_body!)]);
    return results;
}
