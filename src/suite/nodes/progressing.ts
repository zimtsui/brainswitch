import { Finalized, type Draft } from '@zimtsui/amenda';


export function progressing(ctx: progressing.WorkflowContext, delta: number) {
	return async function *<input>(input: input): Draft<input> {
		ctx.logger.progress?.(delta);
		try {
			return yield input;
		} catch (e) {
			if (e instanceof Finalized) {} else ctx.logger.progress?.(-delta);
			throw e;
		}
	}
}

export namespace progressing {
	export interface WorkflowContext {
		logger: WorkflowContext.Logger;
	}
	export namespace WorkflowContext {
		export interface Logger {
			progress?: (deltaProgress: number) => void;
		}
	}
}
