import { Function } from '../function.ts';
import { ChatCompletion } from '../chat-completion.ts';
import { Throttle } from '../throttle.ts';


export abstract class APIBase<in out fd extends Function.Declaration = never> {
	protected baseUrl: string;
	protected apiKey: string;
	protected model: string;
	protected inputPrice: number;
	protected outputPrice: number;
	protected cachedPrice: number;
	protected functionDeclarations: fd[];
	protected toolChoice: Function.ToolChoice<fd>;
	protected customOptions?: Record<string, unknown>;
	protected throttle: Throttle;
	protected timeout?: number;

	public constructor(options: ChatCompletion.Options<fd>) {
		this.baseUrl = options.baseUrl;
		this.apiKey = options.apiKey;
		this.model = options.model;
		this.inputPrice = options.inputPrice ?? 0;
		this.outputPrice = options.outputPrice ?? 0;
		this.cachedPrice = options.cachedPrice ?? this.inputPrice;
		this.functionDeclarations = options.functionDeclarations ?? [];
		if (this.functionDeclarations.length)
			this.toolChoice = options.functionCallMode ?? Function.ToolChoice.AUTO;
		else this.toolChoice = Function.ToolChoice.NONE;
		this.customOptions = options.customOptions;
		this.throttle = options.throttle;
		this.timeout = options.timeout;
	}
}

export class TransientError extends Error {}
export class RetryLimitError extends Error {}
