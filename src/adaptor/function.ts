import { type Static, type TSchema } from '@sinclair/typebox';


export namespace Function {
	export interface Declaration<out tschema extends TSchema = TSchema> {
		name: string;
		description?: string;
		paraschema: tschema;
	}

	export class Call<out pfd extends Declaration> {
		public static readonly CALL_NOMINAL = Symbol();
		private declare readonly [Call.CALL_NOMINAL]: void;
		public id?: string;
		public name: pfd['name'];
		public args: Static<pfd['paraschema']>;
		public constructor(fc: Omit<Call<pfd>, never>) {
			this.id = fc.id;
			this.name = fc.name;
			this.args = fc.args;
		}
	}
	export namespace Call {
		export type Union<fd extends Declaration> = fd extends infer pfd extends Declaration ? Call<pfd> : never;
	}

	export class Response<out pfd extends Declaration> {
		public static readonly RESPONSE_NOMINAL = Symbol();
		private declare readonly [Response.RESPONSE_NOMINAL]: void;
		public id?: string;
		public name: pfd['name'];
		public text: string;
		public constructor(fr: Omit<Response<pfd>, never>) {
			this.id = fr.id;
			this.name = fr.name;
			this.text = fr.text;
		}
	}
	export namespace Response {
		export type Union<fd extends Declaration> = fd extends infer pfd extends Declaration ? Response<pfd> : never;
	}

	export type ToolChoice<fd extends Declaration> =
		| fd['name'][]
		| typeof ToolChoice.NONE
		| typeof ToolChoice.REQUIRED
		| typeof ToolChoice.AUTO;
	export namespace ToolChoice {
		export const NONE = Symbol();
		export const REQUIRED = Symbol();
		export const AUTO = Symbol();
	}
}
