import { Verbatim } from '#@/verbatim.ts';
import Handlebars from 'handlebars';
import Assets from '#@/assets.ts';


const template = Handlebars.compile<template.Input>(Assets.verbatim.declarations);
namespace template {
    export interface Input {
        declarations: Input.Declaration[];
    }
    export namespace Input {
        export interface Declaration {
            name: string;
            description: string;
            parameters: Declaration.Parameter[];
        }
        export namespace Declaration {
            export interface Parameter {
                name: string;
                description: string;
                mimeType: string;
            }
        }
    }
}

export function encode<vdu extends Verbatim.Decl.Proto>(
    declarations: vdu[],
): string {
    return template({
        declarations: declarations.map(
            declaration => ({
                name: declaration.name,
                description: declaration.description,
                parameters: Object.entries(declaration.parameters).map(
                    ([name, parameter]) => ({
                        name,
                        description: parameter.description,
                        mimeType: parameter.mimeType,
                    }),
                ),
            }),
        ),
    });
}
