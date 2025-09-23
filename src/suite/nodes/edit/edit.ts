import { Editor } from './editor.ts';
import { Function, type InferenceContext, Adaptor, type Session, agentloop } from '@zimtsui/brainswitch/adaptor';
import { Type } from '@sinclair/typebox';
import { Config } from '#suite/config';


/**
 * @param session mutable
 */
export interface Edit {
	(ctx: InferenceContext, session: Session<Edit.fdu>, text: string, limit?: number): Promise<string>;
}

export namespace Edit {
	export function create(adaptor: Adaptor, config: Config): Edit {
		const engine = adaptor.createEngine<Edit.fdm>(
			config.brainswitch.suite.agentloop,
			Edit.fdm,
			Function.ToolChoice.REQUIRED,
		);

		return async function edit(ctx, session, text, limit = Number.POSITIVE_INFINITY): Promise<string> {
			const editor = new Editor(text);
			const finished = new Error();

			// const functionMap: Function.Map<Edit.fdm> = {
			// 	view: editor.view.bind(editor),
			// 	read: editor.read.bind(editor),
			// 	headings: editor.headings.bind(editor),
			// 	size: editor.size.bind(editor),
			// 	find: editor.find.bind(editor),
			// 	splice: editor.splice.bind(editor),
			// 	copy: editor.copy.bind(editor),
			// 	move: editor.move.bind(editor),
			// 	slice: editor.slice.bind(editor),
			// 	undo: editor.undo.bind(editor),
			// 	reset: editor.reset.bind(editor),
			// 	async submit() {
			// 		if (editor.finalChecked) {
			// 			throw finished;
			// 		} else {
			// 			return '提交失败。请在提交编辑结果之前调用 `view` 工具读取全文，检查编辑结果是否符合预期。';
			// 		}
			// 	},
			// 	async throw({ reason }: { reason: string }) {
			// 		throw new Error(reason);
			// 	},
			// };
			try {
				for await (const _ of agentloop(ctx, session, engine, editor, limit)) {}
			} catch(e) {
				if (e == finished) {} else throw e;
			}
			return editor.getText({});
			// for (let i = 0; i < limit; i++) {
			// 	const response = await Engine.apply(ctx, session, engine);
			// 	const fcs = response.getFunctionCalls();
			// 	if (fcs.length > 1) {
			// 		const message = '操作失败，每一轮对话中最多只能调用一次工具。';
			// 		session.chatMessages.push(makeFunctionResponse(fcs, message));
			// 		ctx.logger.message?.debug(message);
			// 	} else if (fcs[0]!.name === 'throw') {
			// 		throw new Error(fcs[0]!.args.reason);
			// 	} else throw new Error();
			// }
			// throw new Error('Function call limit exceeded.');
		}
	}

	export const fdm = {
		view: {
			description: '读取编辑器中当前的全文。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		read: {
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
		headings: {
			description: '总览当前全文中所有 Markdown headings。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		size: {
			description: '获取当前的全文总字符数。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		find: {
			description: '查找指定文本在全文中的起止位置。当且仅当恰好找到一个匹配项时，才能查找成功。',
			paraschema: Type.Object({
				fragment: Type.String(),
			}, { additionalProperties: false }),
		},
		splice: {
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
		copy: {
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
		move: {
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
		slice: {
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
		undo: {
			description: '撤销指定次数的操作。',
			paraschema: Type.Object({
				limit: Type.Number({
					description: '要撤销的次数。',
				}),
			}, { additionalProperties: false }),
		},
		reset: {
			description: '撤销所有操作，重置为初始文本。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		submit: {
			description: '结束编辑。',
			paraschema: Type.Object({}, { additionalProperties: false }),
		},
		throw: {
			description: '因任何原因无法完成编辑。',
			paraschema: Type.Object({
				reason: Type.String(),
			}, { additionalProperties: false }),
		},
	} satisfies Function.Declaration.Map;
	export type fdm = typeof fdm;
	export type fdu = Function.Declaration.From<fdm>;
}
