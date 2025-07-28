# 🚀 自动提交消息生成器

一个智能的VSCode插件，使用DeepSeek AI自动生成符合项目风格的Git提交消息。

## ✨ 功能特性

- 🤖 **AI驱动**: 使用DeepSeek API智能生成提交消息
- 📝 **格式分析**: 自动分析项目历史提交格式并保持一致性
- 🎯 **智能优先级**: 优先分析暂存区文件，无暂存文件时分析所有修改文件
- ⚡ **多种访问方式**: 状态栏按钮、快捷键、右键菜单
- 🔧 **高度可配置**: 支持自定义API Key、系统提示词、用户提示词模板
- 📋 **自动填入**: 生成的消息自动填入提交消息输入框
- 🇨🇳 **完全中文化**: 所有界面和提示信息均为中文

## 📦 安装

1. 克隆或下载此项目
2. 在项目根目录运行：
   ```bash
   npm install
   npm run compile
   ```
3. 在VSCode中按 `F5` 启动调试

## ⚙️ 配置

### 必需配置
在VSCode设置中配置DeepSeek API Key：

```json
{
  "auto-commit.deepseekApiKey": "your-deepseek-api-key-here"
}
```

### 可选配置
```json
{
  "auto-commit.defaultCommitTemplate": "feat: {description}",
  "auto-commit.systemPrompt": "你是一个专业的Git提交消息生成助手...",
  "auto-commit.userPromptTemplate": "请为以下代码变更生成提交消息：\n{files}\n{changes}\n{history}"
}
```

## 🎯 使用方法

### 访问方式
1. **状态栏按钮** (推荐): 点击底部状态栏的 "✨ 生成提交消息"
2. **快捷键**: `Ctrl+Shift+Alt+G`
3. **源代码控制**: 在源代码控制视图标题栏点击按钮
4. **右键菜单**: 在变更文件上右键选择"生成提交消息"
5. **命令面板**: `Ctrl+Shift+P` 搜索 "生成提交消息"

### 使用步骤
1. 在VSCode中打开Git仓库
2. 修改文件
3. 使用任一方式触发消息生成
4. 等待AI分析并生成提交消息
5. 消息自动填入输入框或复制到剪贴板

## 🔄 工作流程

1. **文件分析**: 优先分析暂存区文件，无暂存文件时分析所有修改文件
2. **格式学习**: 分析最近20个提交的格式，识别项目提交风格
3. **AI生成**: 使用配置的提示词和DeepSeek API生成提交消息
4. **自动填入**: 将生成的消息填入提交输入框或提供复制选项

## 🔧 配置项详解

### 系统提示词 (systemPrompt)
定义AI助手的角色和基本行为规则。在VSCode设置中以**多行文本框**形式编辑，默认值：
```
你是一个专业的Git提交消息生成助手。请根据代码变更生成简洁、准确的提交消息。遵循约定式提交格式（feat:, fix:, docs:, style:, refactor:, test:, chore:）。提交消息的第一行应控制在72个字符以内。
```

### 用户提示词模板 (userPromptTemplate)
支持变量替换的提示词模板，在VSCode设置中以**多行文本框**形式编辑。可用变量：
- `{files}`: 变更文件列表
- `{changes}`: 详细变更内容
- `{history}`: 历史提交消息参考

## 🛠️ 开发

### 项目结构
```
src/
├── extension.ts                    # 主入口文件
└── services/
    ├── gitService.ts              # Git操作服务
    ├── deepSeekService.ts         # DeepSeek API服务
    └── commitMessageGenerator.ts  # 提交消息生成器
```

### 构建命令
```bash
npm install          # 安装依赖
npm run compile      # 编译TypeScript
npm run watch        # 监听文件变化
```

## 📄 许可证

MIT License
