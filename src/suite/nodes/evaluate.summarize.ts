import Evaluate from '#suite/assets';
import { Adaptor, Function, RoleMessage, type InferenceContext, type Session } from '@zimtsui/brainswitch/adaptor';
import { Type } from '@sinclair/typebox';
import { Config } from '#suite/config';
import assert from 'node:assert';
import { Rejection, Thrown } from '../exceptions.ts';

export interface Summarize {
	(ctx: InferenceContext, session: Session<Summarize.fdu>): Promise<void>;
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
			assert(response instanceof RoleMessage.AI, new Error('Invalid response of evaluate', { cause: response }));
			const message = new RoleMessage.User([new RoleMessage.Text(Evaluate.Evaluate.summarize)]);
			const ssession: Session<Summarize.fdu> = {
				...session,
				chatMessages: [...session.chatMessages, message],
			};
			const sresponse = await cc(ctx, ssession);
			const fc = sresponse.getOnlyFunctionCall();
			if (fc.name === 'throw') throw new Thrown(response.getOnlyText());
			else if (fc.name === 'reject') throw new Rejection(response.getOnlyText());
			else if (fc.name === 'accept') return;
			else throw new Error();
		}
	}

	export const fdm = {
		accept: {
			description: '通过了审查',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		reject: {
			description: '不通过审查',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		throw: {
			description: '无法完成审查',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
	} satisfies Function.Declaration.Map;
	export type fdm = typeof fdm;
	export type fdu = Function.Declaration.From<fdm>;
}
