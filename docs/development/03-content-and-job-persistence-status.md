# 第三阶段内容与生成任务持久化状态

## 已实现

- `Volume`、`Chapter`、`ChapterVersion`、`GenerationJob` 和 `GenerationOutput` 领域模型
- 卷和章节的跨平台仓储接口
- 原生 SQLite 卷、章节和章节版本仓储
- Web `localStorage` 卷、章节和章节版本仓储
- 创建项目时自动创建第一卷和第一章
- 项目、卷、章节三级导航
- 章节内容加载和切换
- 章节编辑 900ms 防抖自动保存
- 章节状态从 `planned` 自动进入 `drafting`
- 手动创建章节版本快照
- 生成任务创建、状态更新和 Token 用量持久化
- 生成输出持久化
- 取消或失败任务保存已有输出
- 启动时识别并关闭未结束任务
- 从历史生成任务恢复输出到当前章节
- 文本内容哈希和基础单元测试

## 数据流

```text
Tiptap onChange
  -> UI 本地状态
  -> 900ms 防抖
  -> ContentRepository.saveChapterContent
  -> SQLite / localStorage

AI 续写
  -> GenerationJob queued
  -> GenerationJob generating
  -> ProviderRuntime 流式输出
  -> GenerationOutput
  -> GenerationJob completed / failed / cancelled
  -> 用户恢复或写入章节
```

## 当前限制

- `content_markdown` 当前保存的是编辑器 HTML，字段名沿用初始数据库设计；后续迁移会拆分为标准 JSON、HTML 和 Markdown 表示。
- 自动保存目前只更新章节主记录，不自动创建版本，避免高频版本膨胀。
- 恢复输出会追加到当前选中章节，不会自动分析原任务对应章节是否已发生冲突。
- 生成任务重试计数已经建模，但自动重试调度尚未实现。
- 当前只实现卷和章节的创建、读取及内容更新，重命名、排序和删除尚未开放。
- Web 端数据仍是本地浏览器存储，不包含跨设备同步。
- Rust 全权管理密钥和模型请求仍属于后续安全阶段。

## 下一阶段

1. 卷和章节重命名、排序、删除及撤销
2. 章节版本浏览、差异比较和恢复
3. 生成任务自动重试和继续生成
4. 人物、世界观和大纲 CRUD
5. 章节保存后触发结构化记忆提取
6. FTS5 全文索引和上下文检索
