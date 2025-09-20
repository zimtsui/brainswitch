import { Editor } from './editor.ts';
import { Function, RoleMessage, ChatCompletion, type InferenceContext, Adaptor, type Session } from '@zimtsui/brainswitch/adaptor';
import { Type } from '@sinclair/typebox';
import { Config } from '#suite/config';


function makeFunctionResponse(fcs: Function.Call<Agentloop.fd>[], text: string) {
	return new RoleMessage.User<Agentloop.fd>(
		fcs.map(fc => new Function.Response<Agentloop.fd>({
			id: fc.id,
			name: fc.name,
			text,
		})),
	);
}

export interface Agentloop {
	(session: Session<Agentloop.fd>, text: string, ctx: InferenceContext, limit?: number): Promise<string>;
}

export namespace Agentloop {
	export function create(adaptor: Adaptor, config: Config): Agentloop {
		const cc = adaptor.createChatCompletion(
			config.brainswitch.suite.agentloop,
			Agentloop.fd,
			Function.ToolChoice.REQUIRED,
		);

		/**
		 * @param session mutable
		 */
		async function agentloop(
			session: Session<Agentloop.fd>, text: string, ctx: InferenceContext, limit = Number.POSITIVE_INFINITY
		): Promise<string> {
			const editor = new Editor(text);
			for (let i = 0; i < limit; i++) {
				const response = await ChatCompletion.apply(ctx, session, cc);
				const fcs = response.getFunctionCalls();
				if (fcs.length > 1) {
					const message = '操作失败，每一轮对话中最多只能调用一次工具。';
					session.chatMessages.push(makeFunctionResponse(fcs, message));
					ctx.logger.message?.debug(message);
				} else if (fcs[0]!.name === 'submit') {
					if (editor.finalChecked) {
						const rv = editor.getText();
						// ctx.logger?.message.debug('\n'+rv);
						return rv;
					} else {
						const message = '提交失败。请在提交编辑结果之前调用 `view` 工具读取全文，检查编辑结果是否符合预期。';
						session.chatMessages.push(makeFunctionResponse(fcs, message));
						ctx.logger.message?.debug(message);
					}
				} else if (fcs[0]!.name === 'throw')
					throw new Error(fcs[0]!.args.reason);
				else if (fcs[0]!.name === 'view') {
					const message = editor.view();
					session.chatMessages.push(makeFunctionResponse(fcs, message));
					ctx.logger.message?.debug('\n'+message);
				} else if (fcs[0]!.name === 'read') {
					const { begin, end } = fcs[0]!.args;
					const message = editor.read(begin, end);
					session.chatMessages.push(makeFunctionResponse(fcs, message));
					ctx.logger.message?.debug('\n'+message);
				} else if (fcs[0]!.name === 'headings') {
					const message = editor.headings();
					session.chatMessages.push(makeFunctionResponse(fcs, message));
					ctx.logger.message?.debug('\n'+message);
				} else if (fcs[0]!.name === 'size') {
					const message = editor.size();
					session.chatMessages.push(makeFunctionResponse(fcs, message));
					ctx.logger.message?.debug(message);
				} else if (fcs[0]!.name === 'find') {
					const { fragment } = fcs[0]!.args;
					const message = editor.find(fragment);
					session.chatMessages.push(makeFunctionResponse(fcs, message));
					ctx.logger.message?.debug(message);
				} else if (fcs[0]!.name === 'splice') {
					const { fragment, begin, end } = fcs[0]!.args;
					const message = editor.splice(fragment, begin, end);
					session.chatMessages.push(makeFunctionResponse(fcs, message));
					ctx.logger.message?.debug(message);
				} else if (fcs[0]!.name === 'copy') {
					const { destOffset, srcBegin, srcEnd } = fcs[0]!.args;
					const message = editor.copy(destOffset, srcBegin, srcEnd);
					session.chatMessages.push(makeFunctionResponse(fcs, message));
					ctx.logger.message?.debug(message);
				} else if (fcs[0]!.name === 'move') {
					const { destOffset, srcBegin, srcEnd } = fcs[0]!.args;
					const message = editor.move(destOffset, srcBegin, srcEnd);
					session.chatMessages.push(makeFunctionResponse(fcs, message));
					ctx.logger.message?.debug(message);
				} else if (fcs[0]!.name === 'slice') {
					const { begin, end } = fcs[0]!.args;
					const message = editor.slice(begin, end);
					session.chatMessages.push(makeFunctionResponse(fcs, message));
					ctx.logger.message?.debug(message);
				} else if (fcs[0]!.name === 'undo') {
					const { limit } = fcs[0]!.args;
					const message = editor.undo(limit);
					session.chatMessages.push(makeFunctionResponse(fcs, message));
					ctx.logger.message?.debug(message);
				} else if (fcs[0]!.name === 'reset') {
					const message = editor.reset();
					session.chatMessages.push(makeFunctionResponse(fcs, message));
					ctx.logger.message?.debug(message);
				} else throw new Error();
			}
			throw new Error('Function call limit exceeded.');
		}
		return agentloop;
	}

	export const fd = [
		{
			name: 'view' as const,
			description: '读取编辑器中当前的全文。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		{
			name: 'read' as const,
			description: '读取编辑器中指定范围的文本。',
			paraschema: Type.Object({
				begin: Type.Number({
					description: '从这里开始读取。',
				}),
				end: Type.Number({
					description: '读取到这里。',
				}),
			}, { additionalProperties: false }),
		},
		{
			name: 'headings' as const,
			description: '总览当前全文中所有 Markdown headings。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		{
			name: 'size' as const,
			description: '获取当前的全文总字符数。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		{
			name: 'find' as const,
			description: '查找指定文本在全文中的起止位置。当且仅当恰好找到一个匹配项时，才能查找成功。',
			paraschema: Type.Object({
				fragment: Type.String(),
			}, { additionalProperties: false }),
		},
		{
			name: 'splice' as const,
			description: '替换指定区间的文本。',
			paraschema: Type.Object({
				fragment: Type.String({
					description: '待换入的文本。',
				}),
				begin: Type.Number({
					description: '待换出的文本的起始位置。',
				}),
				end: Type.Number({
					description: '待换出的文本的结束位置。',
				}),
			}, { additionalProperties: false }),
		},
		{
			name: 'copy' as const,
			description: '复制指定区间的文本到指定位置。',
			paraschema: Type.Object({
				destOffset: Type.Number({
					description: '复制目的地的起始位置。',
				}),
				srcBegin: Type.Number({
					description: '待复制的文本的起始位置。',
				}),
				srcEnd: Type.Number({
					description: '待复制的文本的结束位置。',
				}),
			}, { additionalProperties: false }),
		},
		{
			name: 'move' as const,
			description: '移动指定区间的文本到指定位置。',
			paraschema: Type.Object({
				destOffset: Type.Number({
					description: '移动目的地的起始位置。',
				}),
				srcBegin: Type.Number({
					description: '待移动的文本的起始位置。',
				}),
				srcEnd: Type.Number({
					description: '待移动的文本的结束位置。',
				}),
			}, { additionalProperties: false }),
		},
		{
			name: 'slice' as const,
			description: '将全文替换为指定区间的文本。',
			paraschema: Type.Object({
				begin: Type.Number({
					description: '截取的起始位置。',
				}),
				end: Type.Number({
					description: '截取的结束位置。',
				}),
			}, { additionalProperties: false }),
		},
		{
			name: 'undo' as const,
			description: '撤销指定次数的操作。',
			paraschema: Type.Object({
				limit: Type.Number({
					description: '要撤销的次数。',
				}),
			}, { additionalProperties: false }),
		},
		{
			name: 'reset' as const,
			description: '撤销所有操作，重置为初始文本。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		{
			name: 'submit' as const,
			description: '结束编辑。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		{
			name: 'throw' as const,
			description: '因任何原因无法完成编辑。',
			paraschema: Type.Object({
				reason: Type.String(),
			}, { additionalProperties: false }),
		},
	] satisfies Function.Declaration[];
	export type fd = typeof fd[number];
}
