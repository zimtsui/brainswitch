import { loadtext } from '@zimtsui/node-loaders';


export default {
	System: {
		instruction: loadtext(import.meta.resolve('../../assets/suite/system.md')),
	},
	Optimize: {
		instruction: loadtext(import.meta.resolve('../../assets/suite/optimize/instruction.md')),
		summarize: loadtext(import.meta.resolve('../../assets/suite/optimize/summarize.md')),
	},
	Evaluate: {
		instruction: loadtext(import.meta.resolve('../../assets/suite/evaluate/instruction.md')),
		summarize: loadtext(import.meta.resolve('../../assets/suite/evaluate/summarize.md')),
	},
	Edit: {
		instruction: loadtext(import.meta.resolve('../../assets/suite/edit.instruction.md')),
		markdown: loadtext(import.meta.resolve('../../assets/suite/edit.markdown.md')),
	},
};
