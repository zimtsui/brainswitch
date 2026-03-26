import { loadtext } from '@zimtsui/node-loaders';
import { RoleMessage } from '@zimtsui/brainswitch';


export default {
    verbatim: {
        instruction: RoleMessage.Part.Text.paragraph(loadtext(import.meta.resolve('../assets/verbatim/instruction.md'))),
        declarations: RoleMessage.Part.Text.paragraph(loadtext(import.meta.resolve('../assets/verbatim/declarations.handlebars'))),
        request: RoleMessage.Part.Text.paragraph(loadtext(import.meta.resolve('../assets/verbatim/request.handlebars'))),
    },
} as const;
