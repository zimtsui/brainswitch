import { loadtext } from '@zimtsui/node-loaders';


export default {
    verbatim: {
        instruction: loadtext(import.meta.resolve('../assets/verbatim/instruction.md')),
        declarations: loadtext(import.meta.resolve('../assets/verbatim/declarations.handlebars')),
        request: loadtext(import.meta.resolve('../assets/verbatim/request.handlebars')),
    },
} as const;
