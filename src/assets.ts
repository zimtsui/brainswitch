import { loadtext } from '@zimtsui/node-loaders';
import { RoleMessage } from '@zimtsui/brainswitch';


export default {
	verbatim: {
        instruction: RoleMessage.Part.Text.paragraph(loadtext(import.meta.resolve('../assets/verbatim/instruction.md'))),
        declarations: RoleMessage.Part.Text.paragraph(loadtext(import.meta.resolve('../assets/verbatim/declarations.handlebars'))),
        requests: RoleMessage.Part.Text.paragraph(loadtext(import.meta.resolve('../assets/verbatim/requests.handlebars'))),
        response: RoleMessage.Part.Text.paragraph(loadtext(import.meta.resolve('../assets/verbatim/response.handlebars'))),
	},
} as const;
