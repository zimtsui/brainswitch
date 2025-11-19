import { Function } from '../function.ts';
import { Engine } from '../engine.ts';
import { Throttle } from '../throttle.ts';


export abstract class APIBase<in out fdm extends Function.Declaration.Map = {}> {
	protected baseUrl: string;
	protected apiKey: string;
	protected model: string;
	protected inputPrice: number;
	protected outputPrice: number;
	protected cachedPrice: number;
	protected functionDeclarationMap: fdm;
	protected toolChoice: Function.ToolChoice<fdm>;
	protected customOptions?: Record<string, unknown>;
	protected throttle: Throttle;
	protected timeout?: number;
	protected tokenLimit?: number;

	public constructor(options: Engine.Options<fdm>) {
		this.baseUrl = options.baseUrl;
		this.apiKey = options.apiKey;
		this.model = options.model;
		this.inputPrice = options.inputPrice ?? 0;
		this.outputPrice = options.outputPrice ?? 0;
		this.cachedPrice = options.cachedPrice ?? this.inputPrice;
		this.functionDeclarationMap = options.functionDeclarationMap;
		if (Object.keys(this.functionDeclarationMap).length)
			this.toolChoice = options.functionCallMode ?? Function.ToolChoice.AUTO;
		else this.toolChoice = Function.ToolChoice.NONE;
		this.customOptions = options.customOptions;
		this.throttle = options.throttle;
		this.timeout = options.timeout;
		this.tokenLimit = options.tokenLimit;
	}
}

export class TransientError extends Error {}
