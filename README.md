# AI-Writer

AI-Writer 是一个本地优先的跨平台 AI 小说创作应用。用户配置自己的模型服务后，可以管理小说项目、人物、世界观、章节、项目记忆和生成任务。

## 当前实现状态

当前仓库已完成基础骨架、Provider 运行时、纯文本内容持久化、章节管理、小说资料库、统一写作任务、请求级 Token 统计和多阶段写作编排器：

- pnpm workspace + Turborepo 单仓库结构
- React + TypeScript + Vite 桌面端和 Web 端入口
- Tauri 2 Rust 宿主
- SQLite 插件、迁移和跨平台仓储
- Stronghold 密钥库及 API Key 保存
- Provider 与模型档案配置页面
- OpenAI Compatible 连接测试和流式生成
- 卷、章节创建、重命名、排序和软删除
- 删除后的即时撤销恢复
- 纯文本章节编辑器，不依赖富文本框架
- 章节正文只保留 `plain_text` 单一存储字段
- 章节 900ms 防抖自动保存
- 章节版本快照、差异摘要和一键恢复
- 人物、世界观和大纲跨平台管理
- 权威资料锁定标记
- 统一写作任务、流水线版本和阶段开关
- 项目资料与最近章节上下文构建
- 章节规划、正文生成、联合审查和定向修订
- 模型窗口容量检测与非锁定资料优先级适配
- 写作步骤状态、Prompt 版本和恢复信息持久化
- 每次 Provider 请求和每次重试独立记录 Token
- Token 精确、估算和未知来源区分
- 任务、章节、项目和模型维度用量汇总接口
- Token 仅统计，不设置应用层额度或停止阈值
- 中断任务识别与生成输出恢复
- 模型请求按档案 `maxRetries` 自动重试
- Provider、Prompt、记忆、RAG、平台抽象接口
- 响应式三栏工作台
- Vitest 基础测试和 GitHub Actions CI

完整功能仍按 `docs/design/` 中的设计文档分阶段实现。

## 目录

```text
apps/
├── native/        Tauri 2 桌面与移动应用
└── web/           React PWA/Web 入口

packages/
├── core/          小说领域模型、内容工具和写作工作流
├── editor/        纯文本章节编辑器
├── memory/        记忆与 RAG 核心
├── platform/      平台能力、仓储和写作编排器
├── prompts/       版本化 Prompt 构建
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

## 纯文本内容模型

章节正文只使用纯文本：

- SQLite `chapters` 表只保存 `plain_text`
- SQLite `chapter_versions` 表只保存版本的 `plain_text`
- TypeScript `Chapter` 和 `ChapterVersion` 不包含 JSON 或 Markdown 正文字段
- 保存、版本恢复、生成结果恢复和 Web 本地存储都只处理 `plainText`
- 项目不支持富文本样式或富文本快捷输入

历史数据库通过迁移先保留已有纯文本，再删除 `content_json` 和 `content_markdown` 两列。Web 端读取旧本地数据时会移除同名遗留属性。

## 内容管理

创建小说项目时会同时创建默认卷和第一章。编辑器内容会在停止输入 900ms 后保存：

- 原生端保存到 SQLite
- Web 端保存到 `localStorage`
- 卷和章节支持重命名、上下移动和软删除
- 删除后可通过工作台提示立即撤销
- “保存版本”会写入独立的章节版本快照
- 版本面板显示相对当前正文的字符差异，并支持恢复
- 恢复旧版本会额外创建一条 `recovery` 快照，保留审计链

## 小说资料库

资料库维护生成和一致性检查所需的权威内容：

- 人物姓名、别名、设定、动机和当前状态
- 世界观条目类型、标题和详细内容
- 全书、卷、章、场景和备注大纲节点
- 锁定资料不会被后续自动记忆提取直接覆盖

资料库内容全部使用纯文本。原生端保存到 SQLite，Web 端保存到浏览器本地存储。

## AI 写作流程

每个写作任务保存任务类型、用户要求、流水线版本、Prompt 集版本和阶段开关。当前章节续写会自动执行：

```text
构建上下文
  -> 规划章节
  -> 生成新增正文
  -> 连续性、人物和风格联合审查
  -> 必要时定向修订
  -> 返回最终新增正文
```

上下文来自项目简介、人物、世界观、大纲和最近章节。锁定资料优先保留。审查未通过、评分低于 80，或存在中高严重度问题时，会触发定向修订；无需修订时保存跳过原因。

当前使用以下版本化 Prompt：

- `chapter-planner@1`
- `chapter-draft-writer@1`
- `continuity-reviewer@1`
- `targeted-rewriter@1`

## Token 统计

Token 只用于统计、审计和模型上下文容量判断：

- 不设置单任务、章节、项目或时间周期额度
- 不因 Token 用量较高停止写作任务
- 不因 Token 用量跳过规划、审查、改写或记忆提取
- 每个写作步骤分别统计
- 每次请求和每次自动重试分别记录
- Provider 未返回用量时标记为“未知”，不写成零
- 统计数据区分 `provider`、`estimated` 和 `unknown`
- 支持任务、章节、项目和模型维度汇总

模型上下文窗口是唯一的技术容量边界。预计输入和请求输出超过模型窗口时，系统保留锁定资料，并按优先级省略非锁定资料。该过程不属于用量限制。

## 生成任务

AI 生成任务会保存状态、Token、错误和输出。应用重启后，未结束任务会标记为中断，已有输出仍可恢复。

模型请求失败时，应用会按照模型档案中的 `maxRetries` 自动重试，并采用指数退避；取消生成会同时阻止后续重试。每次重试拥有独立请求记录，不会覆盖先前请求的 Token 和错误信息。

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
