import Evaluate from '#suite/assets';
import { Adaptor, Function, RoleMessage, type InferenceContext, type Session } from '@zimtsui/brainswitch/adaptor';
import { Type } from '@sinclair/typebox';
import { Config } from '#suite/config';
import assert from 'node:assert';
import { Rejection, Thrown } from '../exceptions.ts';

export interface Summarize {
	(ctx: InferenceContext, session: Session<Summarize.fd>): Promise<void>;
}
export namespace Summarize {
	export function create(adaptor: Adaptor, config: Config): Summarize {
		const cc = adaptor.createEngine(
			config.brainswitch.suite.summarize,
			Summarize.fd,
			Function.ToolChoice.REQUIRED,
		);
		return async (ctx, session) => {
			const response = session.chatMessages.at(-1);
			assert(response instanceof RoleMessage.AI, new Error('Invalid response of evaluate', { cause: response }));
			const message = new RoleMessage.User([new RoleMessage.Text(Evaluate.Evaluate.summarize)]);
			const ssession: Session<Summarize.fd> = {
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

	export const fd = [
		{
			name: 'accept' as const,
			description: '通过了审查',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		{
			name: 'reject' as const,
			description: '不通过审查',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		{
			name: 'throw' as const,
			description: '无法完成审查',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
	] satisfies Function.Declaration[];
	export type fd = typeof fd[number];
}
