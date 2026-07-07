# 第二阶段 Provider 运行时实现状态

## 已实现

- Provider 配置列表、新建、编辑和删除
- 模型档案配置
- 自定义 Base URL 和请求头
- Stronghold 密钥库解锁
- API Key 加密保存、读取和删除
- Web 端会话级密钥存储
- OpenAI Compatible `/models` 连接测试
- Tauri HTTP Client 模型请求与流式响应
- OpenAI Compatible SSE 解析
- 生成任务取消
- 编辑器流式预览和结果写入
- Token 用量显示
- OpenAI Compatible 请求解析单元测试
- 修复无锁文件时 GitHub Actions 的 pnpm 缓存初始化失败
- UI 与生成调用只持有 `apiKeyRef`，凭据解析封装在平台运行时内部

## 当前限制

- 原生平台运行时通过 Stronghold JavaScript API 读取密钥，再使用 Tauri HTTP 插件发送请求。密钥不会写入 SQLite、React 状态或日志，但请求期间仍会短暂存在于 WebView 运行时内存中。
- 后续需要实现 Rust 所有的密钥代理，使 Rust 网络层只接收 `apiKeyRef`。
- 当前只启用 OpenAI Compatible Provider；Anthropic、Gemini 和 Ollama 适配器尚未启用。
- `/models` 连接测试依赖服务实现该兼容端点；特殊服务后续需要专用测试策略。
- Web 端密钥只保存在 `sessionStorage`，关闭浏览器会话后需要重新输入。
- 生成任务记录尚未写入 `generation_jobs`。
- 为支持用户自定义 Base URL，当前原生 HTTP capability 允许 HTTP/HTTPS 地址；后续应增加域名确认和更细粒度的权限策略。

## 下一阶段

1. Rust 所有密钥访问和 Provider 请求代理
2. Provider 默认档案和多档案选择
3. 生成任务持久化、重试和恢复
4. 卷、章节、人物和世界观 CRUD
5. 章节自动保存和版本管理
6. 结构化项目记忆提取
7. FTS5 检索和上下文构建
