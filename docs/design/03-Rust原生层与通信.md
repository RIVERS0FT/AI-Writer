## 八、Rust 原生层职责

Rust 层不需要承担全部小说业务逻辑。

推荐使用“薄 Rust 宿主”：

```text id="qqxdzm"
Rust 负责：
├── SQLite 数据访问
├── 数据库迁移
├── API Key 安全保存
├── 文件读取和写入
├── 操作系统目录
├── 原生对话框
├── 模型网络请求
├── 后台任务
├── 进程生命周期
├── 应用更新
└── 平台权限
```

TypeScript 负责：

```text id="8ml1zb"
TypeScript 负责：
├── 小说生成流程
├── Prompt 模板
├── Provider 参数转换
├── 上下文选择
├── Token 预算
├── 人物和设定组合
└── 生成结果解释
```

这样团队不需要把全部业务都写成 Rust，只需使用 Rust 实现安全、稳定和平台相关的能力。

---

## 九、React 与 Rust 的通信

Tauri 提供 Command、Event 和 Channel 三种常用通信方式。

### Command

适合请求—响应操作：

```ts id="efd7gn"
const project = await invoke<NovelProject>("get_project", {
  projectId,
});
```

Rust：

```rust id="4bf2wz"
#[tauri::command]
async fn get_project(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<NovelProject, AppError> {
    state.project_repository.get(&project_id).await
}
```

Tauri Command 支持参数、返回值、错误和异步操作。([v2.tauri.app](https://v2.tauri.app/develop/calling-rust/))

### Event

适合低频状态通知：

```text id="xu2xtd"
project-saved
generation-started
generation-failed
database-migrated
```

### Channel

适合模型流式输出：

```text id="52kr76"
模型 Token
下载进度
后台进程输出
大量有序数据
```

Tauri 官方说明，普通 Event 不适合高吞吐场景，而 Channel 针对有序、流式数据进行了设计。([v2.tauri.app](https://v2.tauri.app/develop/calling-frontend/))

生成章节时的数据流是：

```text id="qajs9e"
React 发起 generate_chapter
        ↓
Rust 创建生成任务
        ↓
模型返回流式文本
        ↓
Rust 通过 Channel 发送 Chunk
        ↓
React 更新编辑器临时内容
        ↓
生成完成
        ↓
Rust 事务保存章节和任务记录
```
