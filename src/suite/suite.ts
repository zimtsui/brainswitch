import * as Evaluate from './nodes/evaluate.summarize.ts';
import * as Optimize from './nodes/optimize.summarize.ts';
import { Edit } from './nodes/edit/edit.ts';
import { Adaptor } from '@zimtsui/brainswitch/adaptor';
import { Config } from '#suite/config';
export { Config };


export interface Suite {
	adaptor: Adaptor;
	optimize: {
		summarize: Optimize.Summarize;
	};
	evaluate: {
		summarize: Evaluate.Summarize;
	};
	edit: Edit;
}
export namespace Suite {

	export function create(adaptor: Adaptor, config: Config): Suite {
		return {
			adaptor,
			optimize: {
				summarize: Optimize.Summarize.create(adaptor, config),
			},
			evaluate: {
				summarize: Evaluate.Summarize.create(adaptor, config),
			},
			edit:Edit.create(adaptor, config),
		};
	}

}
