import { Verbatim } from '#@/verbatim.ts';
import Handlebars from 'handlebars';
import Assets from '#@/assets.ts';


export namespace Template {
    export const requests = Handlebars.compile(Assets.verbatim.requests);
    export namespace requests {
        export interface Args {
            requests: Args.Request[];
        }
        export namespace Args {
            export interface Request {
                name: string;
                args: [name: string, value: string][];
            }
        }
    }
}

export function encode<vdu extends Verbatim.Decl.Proto>(
    requests: Verbatim.Request.Of<vdu>[],
): string {
    return Template.requests({
        requests: requests.map(
            request => ({
                name: request.name,
                args: Object.entries(request.args),
            }),
        ),
    });
}

/**
 * @throws {@link RequestInvalid}
 */
export function decode<
    vdm extends Verbatim.Decl.Map.Proto,
>(str: string, vdm: vdm): Verbatim.Request.From<vdm>[] {
    type vdu = Verbatim.Decl.From<vdm>;
    const parts: Verbatim.Request.Of<vdu>[] = [];
    const requests = extractRequests(str);
    for (const [name, args] of requests) {
        const vditem = vdm[name];
        if (vditem) {} else throw new RequestInvalid('Channel not found: ' + name);
        const options = { name, args } as Verbatim.Request.Options.Of<vdu>;
        parts.push(Verbatim.Request.create(options));
    }
    return parts;
}

export class RequestInvalid extends Error{}


export const XML_ATTR_VAL = /(?<attr_val_quote>['"])(?<attr_val_body>[\s\S]+?)\k<attr_val_quote>/;
export const REQUEST = new RegExp(
    `<verbatim:request\\s+name\\s*=\\s*(?:${XML_ATTR_VAL.source})\\s*>` +
    `(?<verbatim_body>[\\s\\S]*?)` +
    `</verbatim:request\\s*>`,
);
export const ARG_CDATA = new RegExp(
    `<verbatim:argument\\s+name\\s*=\\s*(?:${XML_ATTR_VAL.source})\\s*>` +
    `\\s*<!\\[CDATA\\[(?<arg_cdata_body>[\\s\\S]*?)\\]\\]>\\s*` +
    `</verbatim:argument\\s*>`,
);

function extractArgs(str: string): Record<string, string> {
    const results: Record<string, string> = {};
    for (const match of str.matchAll(new RegExp(ARG_CDATA, 'g'))) {
        if (results[match.groups!.arg_cdata_name!] === undefined) {} else
            throw new RequestInvalid('Duplicate argument: ' + match.groups!.arg_cdata_name!);
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
