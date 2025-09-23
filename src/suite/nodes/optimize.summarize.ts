import Optimize from '#suite/assets';
import { Adaptor, Function, type InferenceContext, RoleMessage, type Session } from '@zimtsui/brainswitch/adaptor';
import { Type } from '@sinclair/typebox';
import { Config } from '#suite/config';
import assert from 'node:assert';
import { Opposition, Rejection, Thrown } from '../exceptions.ts';

export interface Summarize {
	(ctx: InferenceContext, session: Session<Summarize.fdu>): Promise<string | Opposition>;
}
export namespace Summarize {
	export function create(adaptor: Adaptor, config: Config): Summarize {
		const cc = adaptor.createEngine(
			config.brainswitch.suite.summarize,
			Summarize.fdm,
			Function.ToolChoice.REQUIRED,
		);
		return async (ctx, session) => {
			const response = session.chatMessages.at(-1);
			assert(response instanceof RoleMessage.AI, new Error('Invalid response of optimize', { cause: response }));
			const message = new RoleMessage.User([new RoleMessage.Text(Optimize.Optimize.summarize)]);
			const ssession: Session<Summarize.fdu> = {
				...session,
				chatMessages: [...session.chatMessages, message],
			};
			const sresponse = await cc(ctx, ssession);
			const fc = sresponse.getOnlyFunctionCall();
			if (fc.name === 'throw') throw new Thrown(response.getOnlyText());
			else if (fc.name === 'reject') throw new Rejection(response.getOnlyText());
			else if (fc.name === 'oppose') return new Opposition(response.getOnlyText());
			else if (fc.name === 'submit') return response.getOnlyText();
			else throw new Error();
		};
	}

	export const fdm = {
		submit: {
			description: '成功完成了任务，或根据下游节点的反馈重新完成了任务。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		reject: {
			description: '因任务信息本身有误而未能完成任务。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		oppose: {
			description: '因下游节点对你的反馈有误而未能完成任务。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		throw: {
			description: '因任何其他原因未能完成任务。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
	} satisfies Function.Declaration.Map;
	export type fdm = typeof fdm;
	export type fdu = Function.Declaration.From<fdm>;
}
