# AI-Writer

AI-Writer 是一个本地优先的跨平台 AI 小说创作应用。用户配置自己的模型服务后，可以管理小说项目、人物、世界观、章节、项目记忆和生成任务。

## 当前实现状态

当前仓库已完成基础骨架、Provider 运行时、内容持久化和章节管理闭环：

- pnpm workspace + Turborepo 单仓库结构
- React + TypeScript + Vite 桌面端和 Web 端入口
- Tauri 2 Rust 宿主
- SQLite 插件、迁移和跨平台仓储
- Stronghold 密钥库及 API Key 保存
- Provider 与模型档案配置页面
- OpenAI Compatible 连接测试和流式生成
- 卷、章节创建、重命名、排序和软删除
- 删除后的即时撤销恢复
- 章节 900ms 防抖自动保存
- 章节版本快照、差异摘要和一键恢复
- 生成任务状态、Token 和输出持久化
- 中断任务识别与生成输出恢复
- 模型请求按档案 `maxRetries` 自动重试
- Provider、Prompt、记忆、RAG、平台抽象接口
- Tiptap 章节编辑器
- 响应式三栏工作台
- Vitest 基础测试和 GitHub Actions CI

完整功能仍按 `docs/design/` 中的设计文档分阶段实现。

## 目录

```text
apps/
├── native/        Tauri 2 桌面与移动应用
└── web/           React PWA/Web 入口

packages/
├── core/          小说领域模型、内容工具和工作流
├── editor/        富文本编辑器
├── memory/        记忆与 RAG 核心
├── platform/      平台能力与仓储抽象
├── prompts/       Prompt 构建
├── providers/     模型 Provider 与流解析
├── schemas/       Zod 数据校验
├── shared/        通用工具
└── ui/            跨平台界面
```

## 本地开发

需要 Node.js 20+、pnpm 10、Rust stable，以及对应平台的 Tauri 系统依赖。

```bash
pnpm install
pnpm dev:web
```

启动桌面端：

```bash
pnpm dev:native
```

检查代码：

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 内容管理

创建小说项目时会同时创建默认卷和第一章。编辑器内容会在停止输入 900ms 后保存：

- 原生端保存到 SQLite
- Web 端保存到 `localStorage`
- 卷和章节支持重命名、上下移动和软删除
- 删除后可通过工作台提示立即撤销
- “保存版本”会写入独立的章节版本快照
- 版本面板显示相对当前正文的字符差异，并支持恢复
- 恢复旧版本会额外创建一条 `recovery` 快照，保留审计链

## 生成任务

AI 生成任务会保存状态、Token、错误和输出。应用重启后，未结束任务会标记为中断，已有输出仍可恢复。

模型请求失败时，应用会按照模型档案中的 `maxRetries` 自动重试，并采用指数退避；取消生成会同时阻止后续重试。

## Provider 配置

桌面端点击“模型设置”，输入：

- Provider 名称
- OpenAI Compatible Base URL
- 密钥库密码
- API Key
- 模型 ID 和生成参数

密钥库密码只用于本次应用会话解锁 Stronghold，不会保存到项目数据库。编辑器与业务组件只使用 `apiKeyRef`，实际凭据由平台运行时从密钥库解析。

## 设计与开发记录

- 系统设计位于 [`docs/design`](docs/design)
- 分阶段实现记录位于 [`docs/development`](docs/development)
