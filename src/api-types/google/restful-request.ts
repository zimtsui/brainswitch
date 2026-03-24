import * as Google from '@google/genai';


export interface RestfulRequest {
    contents: Google.Content[];
    tools?: Google.Tool[];
    toolConfig?: Google.ToolConfig;
    systemInstruction?: Google.Content;
    generationConfig?: Google.GenerationConfig;
}
