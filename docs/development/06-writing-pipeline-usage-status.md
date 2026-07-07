# 第六阶段写作任务与 Token 统计状态

## 本阶段目标

建立统一 AI 写作任务和请求级 Token 统计基础，为后续 WritingOrchestrator、章节规划、审查、定向改写和记忆闭环提供持久化结构。

## 已实现

- 统一写作任务类型
- 写作流水线阶段开关
- 写作步骤类型和状态
- Prompt ID 与版本字段
- 步骤输入、输出、延迟和错误记录
- 请求级 Token 使用记录
- 精确、估算和未知用量来源
- 缓存输入 Token 与推理 Token 字段
- 任务、章节、项目和模型维度汇总接口
- 自动重试的独立请求记录
- 重试 Token 累加
- 未知 Token 不再写为零
- SQLite 第四版迁移
- Web localStorage 写作步骤和用量仓储
- 上下文固定 Token 预算删除
- 上下文容量报告
- 记忆上下文默认保留全部启用资料
- Token 聚合单元测试

## 当前执行链

```text
创建 GenerationJob
  -> 创建 draft WritingStep
  -> Provider 请求
  -> 记录 GenerationRequest
  -> 失败时独立记录并重试
  -> 成功后汇总任务 Token
  -> 更新 WritingStep
  -> 保存正文输出
```

## 数据库迁移

`0004_writing_pipeline_usage.sql`：

- 扩充 `generation_jobs` 任务元数据
- 扩充 `generation_steps` 步骤与统计字段
- 新建 `generation_requests` 请求明细表
- 重建 `usage_records` 统计表
- 将旧零值用量转换为未知值
- 新增任务、项目、章节和模型查询索引

## Token 规则

- 不设置应用层用量限制
- 不因 Token 用量停止任务
- 不因 Token 用量跳过写作步骤
- Provider 未返回用量时保存为未知
- 请求级明细是事实来源
- 任务和步骤 Token 是派生汇总
- 统计写入失败不应中断正文生成

## 当前限制

- 当前界面仍负责章节续写 Prompt 拼接。
- 当前只有 `draft` 步骤进入统一步骤仓储。
- 尚未实现章节规划、审查、定向改写和记忆提取执行器。
- 尚未实现 Token 统计管理页面。
- 尚未实现官方 tokenizer 估算器。
- 尚未保存完整上下文来源快照。
- SQLite 迁移仍需使用历史数据库副本进行桌面端升级验收。

## 下一阶段

1. 新增 WritingOrchestrator。
2. 将 UI Provider 调用迁出 AppShell。
3. 实现 ContextBuilder 和上下文来源快照。
4. 实现章节规划与分场景生成。
5. 实现一致性、人物和风格审查。
6. 实现定向改写和章节合并。
7. 实现 Token 统计面板。
