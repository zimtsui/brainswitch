

export interface GenericSession<userm, aim, devm> {
    chatMessages: GenericSession.ChatMessage<userm, aim>[];
    developerMessage?: devm;
}

export namespace GenericSession {
    export type ChatMessage<userm, aim> = userm | aim;
}
