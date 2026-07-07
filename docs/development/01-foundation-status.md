# 第一阶段基础骨架实现状态

## 已实现

- Monorepo 工程结构
- React/Vite 桌面与 Web 入口
- Tauri 2 Rust 宿主
- SQLite 初始数据库迁移
- Stronghold 插件初始化
- 项目列表与创建项目的跨平台仓储
- 小说领域类型和生成状态机
- Provider、Prompt、记忆、RAG、平台服务接口
- 章节编辑器骨架，现已迁移为纯文本实现
- 工作台基础界面
- 单元测试和 CI

## 后续演进

1. Provider 配置和 Stronghold 密钥写入界面
2. OpenAI Compatible 流式生成
3. 卷、章节、人物、世界观 CRUD
4. 自动保存和章节版本
5. 结构化项目记忆写入
6. FTS5 检索和上下文构建
7. 生成任务持久化与恢复

富文本方案已废弃，当前决策见 `docs/design/10-纯文本编辑器决策.md`。
