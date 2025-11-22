import { type Engine } from '../engine.ts';
import { type Function } from '../function.ts';
import { OpenAIChatCompletionsMonolithEngineBase } from './openai-chatcompletions-monolith-base.ts';
import { type InferenceContext } from '../inference-context.ts';
import { type Session, type RoleMessage } from '../session.ts';

export namespace OpenAIChatCompletionsEngine {
	export function create<fdm extends Function.Declaration.Map = {}>(options: Engine.Options<fdm>): Engine<Function.Declaration.From<fdm>> {
		return new Constructor<fdm>(options);
	}

	export class Constructor<in out fdm extends Function.Declaration.Map = {}> extends OpenAIChatCompletionsMonolithEngineBase<fdm> {
		public override stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.AI<Function.Declaration.From<fdm>>> {
			return this.monolith(ctx, session);
		}
	}
}
