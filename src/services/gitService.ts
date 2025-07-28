import * as vscode from 'vscode';
import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import * as path from 'path';

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

    async getFileChanges(files: string[]): Promise<{ file: string; changes: string }[]> {
        const changes: { file: string; changes: string }[] = [];

        for (const file of files) {
            try {
                const diff = await this.git.diff(['--cached', file]);
                changes.push({
                    file,
                    changes: diff || '新文件或二进制变更'
                });
            } catch (error) {
                changes.push({
                    file,
                    changes: '无法获取变更内容'
                });
            }
        }

        return changes;
    }
}
