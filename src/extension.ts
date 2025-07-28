import * as vscode from 'vscode';
import { GitService } from './services/gitService';
import { DeepSeekService } from './services/deepSeekService';
import { CommitMessageGenerator } from './services/commitMessageGenerator';

export function activate(context: vscode.ExtensionContext) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'auto-commit.generateMessage';
    statusBarItem.text = '$(sparkle) 生成提交消息';
    statusBarItem.tooltip = '使用AI生成提交消息';

    const updateStatusBarVisibility = async () => {
        try {
            const gitService = new GitService();
            const isGitRepo = await gitService.isGitRepository();
            if (isGitRepo) {
                statusBarItem.show();
            } else {
                statusBarItem.hide();
            }
        } catch (error) {
            statusBarItem.hide();
        }
    };

    vscode.workspace.onDidChangeWorkspaceFolders(updateStatusBarVisibility);
    updateStatusBarVisibility();

    const disposable = vscode.commands.registerCommand('auto-commit.generateMessage', async () => {
        try {
            const gitService = new GitService();
            const isGitRepo = await gitService.isGitRepository();
            if (!isGitRepo) {
                vscode.window.showErrorMessage('当前不在Git仓库中');
                return;
            }

            await generateCommitMessage();
        } catch (error) {
            vscode.window.showErrorMessage(`生成提交消息失败: ${error}`);
        }
    });

    const quickGenerateDisposable = vscode.commands.registerCommand('auto-commit.quickGenerate', async () => {
        await vscode.commands.executeCommand('auto-commit.generateMessage');
    });

    context.subscriptions.push(disposable, quickGenerateDisposable, statusBarItem);

    vscode.window.showInformationMessage('自动提交消息生成器已激活！');
}

async function generateCommitMessage() {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "生成提交消息",
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: "检查Git状态..." });

        const gitService = new GitService();
        const deepSeekService = new DeepSeekService();
        const commitMessageGenerator = new CommitMessageGenerator(gitService, deepSeekService);

        const isGitRepo = await gitService.isGitRepository();
        if (!isGitRepo) {
            throw new Error('当前不在Git仓库中');
        }

        progress.report({ increment: 20, message: "获取文件变更..." });

        const stagedFiles = await gitService.getStagedFiles();
        const modifiedFiles = await gitService.getModifiedFiles();

        let filesToAnalyze: string[] = [];
        if (stagedFiles.length > 0) {
            filesToAnalyze = stagedFiles;
        } else if (modifiedFiles.length > 0) {
            filesToAnalyze = modifiedFiles;
        } else {
            throw new Error('没有文件变更需要提交');
        }

        progress.report({ increment: 60, message: "生成提交消息..." });

        const commitMessage = await commitMessageGenerator.generateCommitMessage(filesToAnalyze);

        progress.report({ increment: 100, message: "提交消息已生成!" });

        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (gitExtension && gitExtension.isActive) {
                const git = gitExtension.exports.getAPI(1);
                if (git.repositories.length > 0) {
                    const repo = git.repositories[0];
                    repo.inputBox.value = commitMessage;
                    vscode.window.showInformationMessage('✅ 提交消息已填入输入框');
                } else {
                    throw new Error('未找到Git仓库');
                }
            } else {
                throw new Error('Git扩展未激活');
            }
        } catch (error) {
            const action = await vscode.window.showInformationMessage(
                `📝 生成的提交消息:\n${commitMessage}`,
                '复制到剪贴板'
            );
            if (action === '复制到剪贴板') {
                await vscode.env.clipboard.writeText(commitMessage);
                vscode.window.showInformationMessage('📋 提交消息已复制到剪贴板');
            }
        }
    });
}



export function deactivate() {}
