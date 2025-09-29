import { Type } from '@sinclair/typebox';
import { Function } from '@zimtsui/brainswitch';



const fdm = {
	foo: {
		description: 'foo' as const,
		paraschema: Type.Object({
			bar: Type.String(),
		}),
	},
	bar: {
		description: 'bar' as const,
		paraschema: Type.Object({
			baz: Type.String(),
		}),
	},
} satisfies Function.Declaration.Map;

type fdm = typeof fdm;
type fdu = Function.Declaration.From<fdm>;
const fd: fdu = {
	name: 'foo',
	paraschema: Type.Object({
		bar: Type.String(),
	}),
};
