import * as vscode from 'vscode';
import axios from 'axios';

export interface DeepSeekResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

export class DeepSeekService {
    private readonly apiUrl = 'https://api.deepseek.com/v1/chat/completions';

    private getApiKey(): string {
        const config = vscode.workspace.getConfiguration('auto-commit');
        const apiKey = config.get<string>('deepseekApiKey');
        
        if (!apiKey) {
            throw new Error('DeepSeek API密钥未配置，请在设置中配置。');
        }
        
        return apiKey;
    }

    async generateCommitMessage(prompt: string): Promise<string> {
        try {
            const apiKey = this.getApiKey();
            const config = vscode.workspace.getConfiguration('auto-commit');
            const systemPrompt = config.get<string>('systemPrompt') ||
                '你是一个专业的Git提交消息生成助手。请根据代码变更生成简洁、准确的提交消息。遵循约定式提交格式（feat:, fix:, docs:, style:, refactor:, test:, chore:）。提交消息的第一行应控制在72个字符以内。';

            const response = await axios.post<DeepSeekResponse>(
                this.apiUrl,
                {
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 150,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            if (response.data.choices && response.data.choices.length > 0) {
                const message = response.data.choices[0].message.content.trim();
                // 移除可能的引号
                return message.replace(/^["']|["']$/g, '');
            } else {
                throw new Error('DeepSeek API未返回响应');
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    throw new Error('DeepSeek API密钥无效，请检查配置。');
                } else if (error.response?.status === 429) {
                    throw new Error('DeepSeek API请求频率超限，请稍后重试。');
                } else {
                    throw new Error(`DeepSeek API错误: ${error.response?.data?.error?.message || error.message}`);
                }
            } else {
                throw new Error(`生成提交消息失败: ${error}`);
            }
        }
    }

    async testApiKey(): Promise<boolean> {
        try {
            const apiKey = this.getApiKey();
            
            const response = await axios.post(
                this.apiUrl,
                {
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'user',
                            content: 'Hello'
                        }
                    ],
                    max_tokens: 10
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
}
