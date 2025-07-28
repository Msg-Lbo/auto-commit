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

            return generatedMessage;
        } catch (error) {
            return this.generateFallbackMessage(files);
        }
    }

    private analyzeCommitPattern(commits: CommitInfo[]): string {
        if (commits.length === 0) {
            return 'conventional';
        }

        const patterns = {
            conventional: 0, // feat:, fix:, docs:, etc.
            simple: 0,       // Simple descriptive messages
            detailed: 0      // Longer descriptive messages
        };

        commits.forEach(commit => {
            const message = commit.message.toLowerCase();

            if (/^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?:/.test(message)) {
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
        fileChanges: { file: string; changes: string }[],
        pattern: string,
        recentCommits: CommitInfo[]
    ): string {
        const config = vscode.workspace.getConfiguration('auto-commit');
        const userPromptTemplate = config.get<string>('userPromptTemplate') ||
            '请为以下代码变更生成一个提交消息：\n\n文件变更：\n{files}\n\n变更详情：\n{changes}\n\n历史提交消息参考：\n{history}\n\n请生成一个简洁、准确的提交消息，只返回消息内容，不要其他解释。';

        const filesText = fileChanges.map(change => `- ${change.file}`).join('\n');

        const changesText = fileChanges.map(change => {
            const truncatedChanges = change.changes.length > 500
                ? change.changes.substring(0, 500) + '...'
                : change.changes;
            return `${change.file}:\n${truncatedChanges}`;
        }).join('\n\n');

        let historyText = '无历史记录';
        if (recentCommits.length > 0) {
            historyText = recentCommits.slice(0, 5).map(commit => `- ${commit.message}`).join('\n');

            switch (pattern) {
                case 'conventional':
                    historyText += '\n\n注意：请遵循约定式提交格式（type: description），使用合适的类型如 feat, fix, docs, style, refactor, test, chore。';
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
            .replace('{history}', historyText);

        return prompt;
    }

    private generateFallbackMessage(files: string[]): string {
        const config = vscode.workspace.getConfiguration('auto-commit');
        const template = config.get<string>('defaultCommitTemplate') || 'feat: {description}';

        const fileTypes = this.analyzeFileTypes(files);
        let description = '';

        if (fileTypes.includes('test')) {
            description = '更新测试';
        } else if (fileTypes.includes('doc')) {
            description = '更新文档';
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
}
