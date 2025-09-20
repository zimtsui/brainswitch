import { Finalized, type Draft } from '@zimtsui/amenda';


export interface WorkflowContext {
	logger: WorkflowContext.Logger;
}
export namespace WorkflowContext {
	export interface Logger {
		stage?: (stage: string) => void;
	}
}

export function beginning(ctx: WorkflowContext, nextStage: string) {
	return async function *<input>(input: input): Draft<input> {
		if (nextStage) ctx.logger.stage?.(nextStage);
		return yield input;
	}
}

export function ending(ctx: WorkflowContext, lastStage: string) {
	return async function *<input>(input: input): Draft<input> {
		try {
			return yield input;
		} catch (e) {
			if (e instanceof Finalized) {}
			else if (lastStage) ctx.logger.stage?.(lastStage);
			throw e;
		}
	}
}
