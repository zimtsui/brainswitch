import * as Google from '@google/genai';


export interface GoogleRestfulRequest {
    contents: Google.Content[];
    tools?: Google.Tool[];
    toolConfig?: Google.ToolConfig;
    systemInstruction?: Google.Content;
    generationConfig?: Google.GenerationConfig;
}
