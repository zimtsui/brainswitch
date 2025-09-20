import * as Evaluate from './nodes/evaluate.summarize.ts';
import * as Optimize from './nodes/optimize.summarize.ts';
import * as Edit from './nodes/edit/agentloop.ts';
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
	edit: {
		agentloop: Edit.Agentloop;
	};
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
			edit: {
				agentloop: Edit.Agentloop.create(adaptor, config),
			},
		};
	}

}
