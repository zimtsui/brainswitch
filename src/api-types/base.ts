import { Function } from '../function.ts';
import { type Engine } from '../engine.ts';
import { Throttle } from '../throttle.ts';
import { ProxyAgent } from 'undici';
import { type InferenceContext } from '../inference-context.ts';
import { type Session, type RoleMessage } from '../session.ts';

export abstract class EngineBase<in out fdm extends Function.Declaration.Map = {}>
	implements Engine<Function.Declaration.From<fdm>>
{
	protected baseUrl: string;
	protected apiKey: string;
	protected model: string;
	public name: string;
	protected inputPrice: number;
	protected outputPrice: number;
	protected cachedPrice: number;
	protected functionDeclarationMap: fdm;
	protected toolChoice: Function.ToolChoice<fdm>;
	protected customOptions?: Record<string, unknown>;
	protected throttle: Throttle;
	protected timeout?: number;
	protected tokenLimit?: number;

	protected proxyAgent?: ProxyAgent;

	public abstract stateless(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.AI<Function.Declaration.From<fdm>>>;
	public async stateful(ctx: InferenceContext, session: Session<Function.Declaration.From<fdm>>): Promise<RoleMessage.AI<Function.Declaration.From<fdm>>> {
		const response = await this.stateless(ctx, session);
        session.chatMessages.push(response);
        return response;
	}
	public appendUserMessage(session: Session<Function.Declaration.From<fdm>>, message: RoleMessage.User<Function.Declaration.From<fdm>>): Session<Function.Declaration.From<fdm>> {
		return {
			...session,
			chatMessages: [...session.chatMessages, message],
		};
	}

	public constructor(options: Engine.Options<fdm>) {
		this.baseUrl = options.baseUrl;
		this.apiKey = options.apiKey;
		this.model = options.model;
		this.name = options.name;
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
		this.proxyAgent = options.proxy ? new ProxyAgent(options.proxy) : undefined;
	}
}

export class TransientError extends Error {}
