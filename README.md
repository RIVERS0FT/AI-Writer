# AI-Writer

AI-Writer 是一个本地优先的跨平台 AI 小说创作应用。用户配置自己的模型服务后，可以管理小说项目、人物、世界观、章节、项目记忆和生成任务。

## 当前实现状态

当前仓库已完成基础骨架和 Provider 运行时的首个闭环：

- pnpm workspace + Turborepo 单仓库结构
- React + TypeScript + Vite 桌面端和 Web 端入口
- Tauri 2 Rust 宿主
- SQLite 插件、初始迁移和项目仓储
- Stronghold 密钥库及 API Key 保存
- Provider 与模型档案配置页面
- OpenAI Compatible 连接测试
- Tauri HTTP Client 流式生成
- 生成取消、实时预览和 Token 用量显示
- Provider、Prompt、记忆、RAG、平台抽象接口
- Tiptap 章节编辑器骨架
- 响应式三栏工作台
- Vitest 基础测试和 GitHub Actions CI

完整功能仍按 `docs/design/` 中的设计文档分阶段实现。

## 目录

```text
apps/
├── native/        Tauri 2 桌面与移动应用
└── web/           React PWA/Web 入口

packages/
├── core/          小说领域模型和工作流
├── editor/        富文本编辑器
├── memory/        记忆与 RAG 核心
├── platform/      平台能力抽象
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
