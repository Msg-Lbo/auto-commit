import * as vscode from 'vscode';
import { GitService, CommitInfo } from './gitService';
import { DeepSeekService } from './deepSeekService';

export class CommitMessageGenerator {
    constructor(
        private gitService: GitService,
        private deepSeekService: DeepSeekService
    ) {}

    async generateCommitMessage(files: string[]): Promise<string> {
        try {
            const recentCommits = await this.gitService.getRecentCommits(20);
            const fileChanges = await this.gitService.getFileChanges(files);
            const commitPattern = this.analyzeCommitPattern(recentCommits);
            const prompt = this.buildPrompt(fileChanges, commitPattern, recentCommits);
            const generatedMessage = await this.deepSeekService.generateCommitMessage(prompt);

            // 后处理：检查并修正错误的提交类型
            const correctedMessage = this.correctCommitType(generatedMessage, fileChanges);

            // 确保只返回一条消息
            const singleMessage = this.ensureSingleMessage(correctedMessage);

            return singleMessage;
        } catch (error) {
            return this.generateFallbackMessage(files);
        }
    }

    private analyzeCommitPattern(commits: CommitInfo[]): string {
        if (commits.length === 0) {
            return 'conventional';
        }

        const patterns = {
            conventional: 0, // feat:, fix:, etc.
            simple: 0,       // Simple descriptive messages
            detailed: 0      // Longer descriptive messages
        };

        commits.forEach(commit => {
            const message = commit.message.toLowerCase();

            if (/^(feat|fix|style|refactor|test|chore|perf|ci|build)(\(.+\))?:/.test(message)) {
                patterns.conventional++;
            } else if (message.length < 50 && !message.includes('\n')) {
                patterns.simple++;
            } else {
                patterns.detailed++;
            }
        });

        const maxPattern = Object.keys(patterns).reduce((a, b) =>
            patterns[a as keyof typeof patterns] > patterns[b as keyof typeof patterns] ? a : b
        );

        return maxPattern;
    }

    private buildPrompt(
        fileChanges: { file: string; changes: string; status: string }[],
        pattern: string,
        recentCommits: CommitInfo[]
    ): string {
        const config = vscode.workspace.getConfiguration('auto-commit');
        const userPromptTemplate = config.get<string>('userPromptTemplate') ||
            '请为以下代码变更生成一个提交消息：\n\n文件变更：\n{files}\n\n变更详情：\n{changes}\n\n历史提交消息参考：\n{history}\n\n请生成一个简洁、准确的提交消息，只返回消息内容，不要其他解释。';

        // 分析文件变更类型
        const changeTypes = this.analyzeChangeTypes(fileChanges);

        const filesText = fileChanges.map(change => {
            const statusText = this.getStatusText(change.status);
            return `- ${change.file} (${statusText})`;
        }).join('\n');

        const changesText = fileChanges.map(change => {
            const truncatedChanges = change.changes.length > 500
                ? change.changes.substring(0, 500) + '...'
                : change.changes;
            const statusText = this.getStatusText(change.status);
            return `${change.file} (${statusText}):\n${truncatedChanges}`;
        }).join('\n\n');

        // 构建变更类型提示
        const changeTypeSummary = this.buildChangeTypeSummary(changeTypes);

        let historyText = '无历史记录';
        if (recentCommits.length > 0) {
            historyText = recentCommits.slice(0, 5).map(commit => `- ${commit.message}`).join('\n');

            switch (pattern) {
                case 'conventional':
                    historyText += '\n\n注意：请遵循约定式提交格式（type: description），使用合适的类型如 feat, fix, style, refactor, test, chore。';
                    break;
                case 'simple':
                    historyText += '\n\n注意：请生成简洁的提交消息（50字符以内）。';
                    break;
                case 'detailed':
                    historyText += '\n\n注意：请生成详细的提交消息，说明变更内容和原因。';
                    break;
            }
        }

        const prompt = userPromptTemplate
            .replace('{files}', filesText)
            .replace('{changes}', changesText)
            .replace('{history}', historyText + '\n\n' + changeTypeSummary);

        return prompt;
    }

    private generateFallbackMessage(files: string[]): string {
        const config = vscode.workspace.getConfiguration('auto-commit');
        const template = config.get<string>('defaultCommitTemplate') || 'feat: {description}';

        const fileTypes = this.analyzeFileTypes(files);
        let description = '';

        if (fileTypes.includes('test')) {
            description = '更新测试';
        } else if (fileTypes.includes('config')) {
            description = '更新配置';
        } else if (fileTypes.includes('style')) {
            description = '更新样式';
        } else {
            description = `更新${files.length}个文件`;
        }

        return template.replace('{description}', description);
    }

    private analyzeFileTypes(files: string[]): string[] {
        const types: string[] = [];
        
        files.forEach(file => {
            const fileName = file.toLowerCase();
            
            if (fileName.includes('test') || fileName.includes('spec')) {
                types.push('test');
            } else if (fileName.includes('readme') || fileName.includes('doc') || fileName.endsWith('.md')) {
                types.push('doc');
            } else if (fileName.includes('config') || fileName.endsWith('.json') || fileName.endsWith('.yml') || fileName.endsWith('.yaml')) {
                types.push('config');
            } else if (fileName.endsWith('.css') || fileName.endsWith('.scss') || fileName.endsWith('.less')) {
                types.push('style');
            }
        });

        return [...new Set(types)];
    }

    private analyzeChangeTypes(fileChanges: { file: string; changes: string; status: string }[]): {
        new: number;
        modified: number;
        deleted: number;
        renamed: number;
    } {
        const types = { new: 0, modified: 0, deleted: 0, renamed: 0 };

        fileChanges.forEach(change => {
            switch (change.status) {
                case 'new':
                    types.new++;
                    break;
                case 'modified':
                case 'staged':
                    types.modified++;
                    break;
                default:
                    // 通过diff内容判断
                    if (change.changes.includes('new file mode')) {
                        types.new++;
                    } else if (change.changes.includes('deleted file mode')) {
                        types.deleted++;
                    } else if (change.changes.includes('rename from')) {
                        types.renamed++;
                    } else {
                        types.modified++;
                    }
            }
        });

        return types;
    }

    private getStatusText(status: string): string {
        switch (status) {
            case 'new':
                return '新文件';
            case 'modified':
                return '已修改';
            case 'staged':
                return '已暂存';
            case 'deleted':
                return '已删除';
            case 'renamed':
                return '已重命名';
            default:
                return '变更';
        }
    }

    private buildChangeTypeSummary(changeTypes: { new: number; modified: number; deleted: number; renamed: number }): string {
        const parts: string[] = [];

        if (changeTypes.new > 0) {
            parts.push(`${changeTypes.new}个新文件`);
        }
        if (changeTypes.modified > 0) {
            parts.push(`${changeTypes.modified}个修改文件`);
        }
        if (changeTypes.deleted > 0) {
            parts.push(`${changeTypes.deleted}个删除文件`);
        }
        if (changeTypes.renamed > 0) {
            parts.push(`${changeTypes.renamed}个重命名文件`);
        }

        let summary = '变更类型分析：' + parts.join('，');

        // 根据变更类型给出强制性建议
        if (changeTypes.new > 0 && changeTypes.modified === 0) {
            summary += '\n【强制要求】：这些是新文件，必须使用 feat: 类型';
        } else if (changeTypes.modified > 0 && changeTypes.new === 0) {
            summary += '\n【强制要求】：这些是修改的已存在文件，禁止使用 feat: 类型！必须使用 fix:、refactor: 或 style: 类型';
        } else if (changeTypes.deleted > 0) {
            summary += '\n【强制要求】：包含删除文件，使用 chore: 或 refactor: 类型';
        } else if (changeTypes.new > 0 && changeTypes.modified > 0) {
            summary += '\n【强制要求】：混合变更，根据主要变更选择类型，修改文件不能用 feat:';
        } else {
            summary += '\n【强制要求】：根据文件状态严格选择提交类型';
        }

        return summary;
    }

    private correctCommitType(
        message: string,
        fileChanges: { file: string; changes: string; status: string }[]
    ): string {
        // 分析文件变更类型
        const changeTypes = this.analyzeChangeTypes(fileChanges);

        // 如果消息以 feat: 开头，但没有新文件，则需要修正
        if (message.startsWith('feat:') && changeTypes.new === 0 && changeTypes.modified > 0) {
            // 根据变更内容选择合适的类型
            if (message.includes('修复') || message.includes('修正') || message.includes('解决')) {
                return message.replace(/^feat:/, 'fix:');
            } else if (message.includes('重构') || message.includes('优化') || message.includes('改进')) {
                return message.replace(/^feat:/, 'refactor:');
            } else if (message.includes('样式') || message.includes('格式') || message.includes('布局')) {
                return message.replace(/^feat:/, 'style:');
            } else {
                // 默认改为 refactor
                return message.replace(/^feat:/, 'refactor:');
            }
        }

        // 如果是新文件但没有使用feat:，可能需要修正
        if (changeTypes.new > 0 && changeTypes.modified === 0 &&
            !message.startsWith('feat:')) {
            return message.replace(/^[a-z]+:/, 'feat:');
        }

        return message;
    }

    private ensureSingleMessage(message: string): string {
        // 移除多余的换行和空行
        let cleanMessage = message.trim().replace(/\n+/g, '\n');

        // 如果包含多条消息（通过换行或句号分隔），只取第一条
        const lines = cleanMessage.split('\n');
        if (lines.length > 1) {
            // 取第一行作为主要消息
            cleanMessage = lines[0].trim();
        }

        // 如果包含多个句子（通过句号分隔），合并为一条
        if (cleanMessage.includes('。')) {
            const sentences = cleanMessage.split('。');
            if (sentences.length > 1) {
                // 移除句号，用逗号连接
                cleanMessage = sentences.filter(s => s.trim()).join('，');
            }
        }

        // 如果消息包含多个提交类型（如 "feat: ... refactor: ..."），只保留第一个
        const commitTypePattern = /^(feat|fix|style|refactor|test|chore):\s*/;
        const match = cleanMessage.match(commitTypePattern);
        if (match) {
            const restOfMessage = cleanMessage.substring(match[0].length);
            // 移除后续的提交类型
            const cleanRest = restOfMessage.replace(/\s+(feat|fix|style|refactor|test|chore):\s*/g, '，');
            cleanMessage = match[0] + cleanRest;
        }

        // 确保长度不超过200字符
        if (cleanMessage.length > 200) {
            cleanMessage = cleanMessage.substring(0, 197) + '...';
        }

        return cleanMessage;
    }
}
