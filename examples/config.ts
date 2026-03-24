import { type Config } from '@zimtsui/brainswitch';


// 配置推理服务商 API 接入点
export const config: Config = {
    brainswitch: {
        endpoints: {
            'gpt-5.4-mini': {
                name: 'GPT-5.4 mini',
                apiType: 'openai-responses',
                baseUrl: 'https://api.openai.com/v1',
                apiKey: process.env.OPENAI_API_KEY!,
                model: 'gpt-5-mini',
            },
            'gemini-3-flash': {
                name: 'Gemini 3 Flash',
                apiType: 'google',
                baseUrl: 'https://generativelanguage.googleapis.com',
                apiKey: process.env.GOOGLE_API_KEY!,
                model: 'gemini-3-flash',
            },
        }
    }
}
