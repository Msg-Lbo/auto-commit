import * as vscode from 'vscode';
import { simpleGit, SimpleGit, StatusResult } from 'simple-git';

export interface CommitInfo {
    hash: string;
    message: string;
    author: string;
    date: string;
}

export class GitService {
    private git: SimpleGit;

    constructor() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        this.git = simpleGit(workspaceFolder.uri.fsPath);
    }

    async isGitRepository(): Promise<boolean> {
        try {
            await this.git.status();
            return true;
        } catch (error) {
            return false;
        }
    }

    async getStagedFiles(): Promise<string[]> {
        try {
            const status: StatusResult = await this.git.status();
            return status.staged;
        } catch (error) {
            return [];
        }
    }

    async getModifiedFiles(): Promise<string[]> {
        try {
            const status: StatusResult = await this.git.status();
            return [...status.modified, ...status.not_added];
        } catch (error) {
            return [];
        }
    }

    async stageFiles(files: string[]): Promise<void> {
        try {
            await this.git.add(files);
        } catch (error) {
            throw new Error(`Failed to stage files: ${error}`);
        }
    }

    async commit(message: string): Promise<void> {
        try {
            await this.git.commit(message);
        } catch (error) {
            throw new Error(`Failed to commit: ${error}`);
        }
    }

    async getRecentCommits(count: number = 10): Promise<CommitInfo[]> {
        try {
            const log = await this.git.log({ maxCount: count });
            return log.all.map(commit => ({
                hash: commit.hash,
                message: commit.message,
                author: commit.author_name,
                date: commit.date
            }));
        } catch (error) {
            return [];
        }
    }

    async getFileChanges(files: string[]): Promise<{ file: string; changes: string; status: string }[]> {
        const changes: { file: string; changes: string; status: string }[] = [];

        // 获取文件状态
        const status = await this.git.status();

        for (const file of files) {
            try {
                let diff = '';
                let fileStatus = 'unknown';

                // 检查文件状态
                if (status.staged.includes(file)) {
                    // 暂存区文件，使用 --cached
                    diff = await this.git.diff(['--cached', file]);
                    fileStatus = 'staged';
                } else if (status.modified.includes(file)) {
                    // 修改的文件，使用工作区diff
                    diff = await this.git.diff([file]);
                    fileStatus = 'modified';
                } else if (status.not_added.includes(file)) {
                    // 新文件
                    diff = await this.git.diff([file]);
                    fileStatus = 'new';
                } else {
                    // 对于其他情况，需要更仔细地判断
                    const isTracked = await this.isFileTracked(file);
                    if (isTracked) {
                        // 已跟踪的文件，即使没有在status中显示，也是修改
                        diff = await this.git.diff([file]);
                        fileStatus = 'modified';
                    } else {
                        // 未跟踪的文件，是新文件
                        diff = await this.git.diff([file]);
                        fileStatus = 'new';
                    }
                }

                changes.push({
                    file,
                    changes: diff || '新文件或二进制变更',
                    status: fileStatus
                });
            } catch (error) {
                changes.push({
                    file,
                    changes: '无法获取变更内容',
                    status: 'error'
                });
            }
        }

        return changes;
    }

    private async isFileTracked(file: string): Promise<boolean> {
        try {
            // 使用 git ls-files 检查文件是否被跟踪
            const result = await this.git.raw(['ls-files', file]);
            return result.trim().length > 0;
        } catch (error) {
            // 如果命令失败，尝试另一种方法
            try {
                await this.git.show([`HEAD:${file}`]);
                return true;
            } catch (showError) {
                return false;
            }
        }
    }
}
