import { RoleMessage, type Session } from './session.ts';
import { Function } from './function.ts';
import { EndpointSpec } from './endpoint-spec.ts';
import { type InferenceContext } from './inference-context.ts';
import { Throttle } from './throttle.ts';


export interface Engine<in out fd extends Function.Declaration = never> {
	(ctx: InferenceContext, session: Session<fd>): Promise<RoleMessage.AI<fd>>;
}

export namespace Engine {
	export namespace Options {
		export interface Functions<out fd extends Function.Declaration = never> {
			functionDeclarations?: fd[];
			functionCallMode?: Function.ToolChoice<fd>;
		}
	}

	export interface Options<out fd extends Function.Declaration = never> extends EndpointSpec, Options.Functions<fd> {
		throttle: Throttle;
	}

	/**
	 * @param session mutable
	 */
	export async function apply<fd extends Function.Declaration = never>(
		ctx: InferenceContext,
		session: Session<fd>,
		cc: Engine<fd>,
	): Promise<RoleMessage.AI<fd>> {
		const response = await cc(ctx, session);
		session.chatMessages.push(response);
		return response;
	}
}
