

export interface Session<userm, aim, devm> {
    chatMessages: Session.ChatMessage<userm, aim>[];
    developerMessage?: devm;
}

export namespace Session {
    export type ChatMessage<userm, aim> = userm | aim;
}
