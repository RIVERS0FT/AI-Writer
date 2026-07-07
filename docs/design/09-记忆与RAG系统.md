# AI-Writer 记忆与 RAG 系统设计

## 一、设计目标

AI-Writer 的记忆与 RAG 系统用于解决长篇小说创作中的以下问题：

- 小说正文超过模型上下文窗口
- 人物状态随剧情不断变化
- 模型遗忘早期设定、事件和伏笔
- 人物提前知道其不应知道的信息
- 不同章节之间出现时间、地点和状态冲突
- 用户需要在多个项目之间复用写作偏好
- 检索结果过多，无法全部发送给模型
- 用户修改正文后，旧记忆和索引没有同步更新
- 不同小说项目之间发生记忆串扰

系统必须实现：

```text
用户级长期记忆
+ 项目级长期记忆
+ 会话级短期记忆
+ 当前任务工作记忆
+ 结构化检索
+ 全文检索
+ 向量检索
+ 关系检索
+ 重排与 Token 预算
+ 记忆更新与冲突处理
```

当前设计文档已经包含四层上下文、章节摘要、人物状态、时间线、伏笔、FTS5 和后续向量检索等基础能力。本设计在此基础上补充完整的数据结构、生命周期和检索流程。

---

## 二、核心设计原则

### 1. 项目隔离

每一本小说拥有独立记忆空间。

任何项目记忆、检索文档、向量和事件都必须包含：

```text
project_id
```

查询项目记忆时，`project_id` 必须是强制过滤条件，不能只依赖向量相似度。

### 2. 用户记忆与项目记忆分离

```text
用户记忆：
描述作者通常怎样写，可以跨项目复用。

项目记忆：
描述这一本小说中真实发生或明确设定的内容，只能在本项目中使用。
```

用户记忆不能覆盖项目事实。

### 3. 结构化事实优先

人物状态、关系、时间线、伏笔等明确事实，优先从结构化数据库获取。

向量检索只用于发现语义相关内容，不能作为判断事实真伪的唯一依据。

### 4. 来源可追溯

每条长期记忆必须能够回答：

- 来自哪里
- 由谁创建
- 何时创建
- 是否经过用户确认
- 当前是否有效
- 被哪一章修改
- 是否与其他记忆冲突

### 5. 用户可控

用户必须能够：

- 查看记忆
- 修改记忆
- 锁定记忆
- 禁用记忆
- 删除记忆
- 查看记忆来源
- 查看本次生成使用了哪些记忆
- 关闭自动记忆
- 清空项目或用户记忆

### 6. 本地优先

桌面和移动版本默认将记忆保存在本地 SQLite 中。

API Key、密码和访问令牌不属于用户记忆，必须使用安全存储处理，不能写入普通记忆表。

---

## 三、记忆分层

整个系统划分为四个层级。

```text
Memory System
├── User Memory
├── Project Memory
├── Session Memory
└── Working Memory
```

---

## 四、用户记忆 User Memory

用户记忆描述作者的长期创作偏好，可以跨小说项目使用。

### 4.1 用户档案

```text
显示名称
默认语言
默认模型
默认章节字数
默认生成参数
默认导出格式
编辑器偏好
```

### 4.2 写作偏好

```text
偏好题材
偏好视角
叙事节奏
对话比例
描写密度
章节长度
语言复杂度
段落长度
标题风格
```

示例：

```text
默认使用第三人称有限视角。
章节长度保持在 3000 至 5000 字。
对话比例偏高。
避免连续使用多个华丽比喻。
重要场景应优先通过动作而不是解释表现。
```

### 4.3 内容约束

```text
不希望出现的题材
敏感内容边界
禁止使用的套路
希望避免的表达
固定术语
```

### 4.4 工作流偏好

```text
生成正文前是否先生成场景计划
生成后是否自动进行一致性检查
人物重大变化是否必须确认
是否自动提取章节摘要
是否自动更新项目记忆
```

### 4.5 可复用资产

```text
人物模板
世界观模板
组织模板
力量体系模板
Prompt 模板
写作风格模板
导出模板
```

### 4.6 用户记忆来源

用户记忆必须区分来源：

```ts
type UserMemorySource =
  | "user_explicit"
  | "user_confirmed"
  | "system_inferred"
  | "imported";
```

优先级：

```text
user_explicit
    >
user_confirmed
    >
imported
    >
system_inferred
```

`system_inferred` 只表示系统推测，默认不能直接作为强制规则，必须允许用户确认。

---

## 五、项目记忆 Project Memory

项目记忆描述单本小说内部的事实和历史。

```text
Project Memory
├── Canonical Memory
├── Character Memory
├── Relationship Memory
├── Event Memory
├── Timeline Memory
├── Foreshadowing Memory
├── Summary Memory
├── Semantic Memory
└── Style Memory
```

### 5.1 权威设定记忆 Canonical Memory

包含作者明确设定且应当优先遵守的内容：

- 世界规则
- 力量体系
- 地理规则
- 国家和组织设定
- 核心人物基础设定
- 全书总纲
- 当前卷大纲
- 专有名词
- 禁止修改的事实

权威设定支持以下状态：

```ts
type CanonicalStatus =
  | "draft"
  | "active"
  | "locked"
  | "deprecated";
```

`locked` 记忆不能被 AI 自动修改。

### 5.2 人物记忆 Character Memory

人物记忆分为基础信息和动态状态。

#### 基础信息

```text
姓名
别名
年龄
外貌
性格
背景
动机
核心目标
行为原则
语言习惯
```

#### 动态状态

```text
当前地点
身体状态
心理状态
阵营
社会身份
持有物品
当前目标
当前计划
已完成目标
未完成目标
```

每次人物状态变化都要保存生效章节：

```text
valid_from_chapter_id
valid_to_chapter_id
```

不能只覆盖当前值，否则无法查询人物在历史章节中的状态。

### 5.3 角色知识记忆 Character Knowledge

必须区分：

```text
作者知道什么
读者知道什么
角色 A 知道什么
角色 B 知道什么
```

数据示例：

```text
事实：王子仍然活着
作者：知道
读者：尚不知道
林墨：不知道
城主：知道
```

角色知识记录：

```ts
interface CharacterKnowledge {
  id: string;
  projectId: string;
  characterId: string;
  factId: string;
  learnedChapterId: string;
  sourceCharacterId?: string;
  certainty: number;
  isBelief: boolean;
  isTrue: boolean | null;
}
```

`isBelief` 表示角色认为这是真的，但事实可能不是这样。

### 5.4 人物关系记忆

关系必须支持时间变化：

```text
陌生人
→ 合作者
→ 朋友
→ 产生怀疑
→ 敌对
```

关系记录包括：

```text
关系类型
关系强度
信任程度
公开关系
真实关系
开始章节
结束章节
变化原因
```

### 5.5 剧情事件记忆 Event Memory

每个重要事件保存为结构化对象：

```ts
interface StoryEvent {
  id: string;
  projectId: string;
  chapterId: string;
  sceneId?: string;

  title: string;
  summary: string;
  eventType: string;

  participants: string[];
  locationId?: string;
  itemIds: string[];

  storyTime?: string;
  duration?: string;

  causes: string[];
  consequences: string[];

  importance: number;
  status: "proposed" | "confirmed" | "retracted";
}
```

事件类型示例：

```text
相遇
冲突
战斗
死亡
受伤
获得物品
失去物品
发现秘密
关系变化
地点变化
阵营变化
承诺
背叛
伏笔埋设
伏笔回收
```

### 5.6 时间线记忆 Timeline Memory

章节顺序与故事时间必须分离。

```text
章节顺序：
第 20 章、第 21 章、第 22 章

故事时间：
帝国历 312 年 4 月 3 日上午
帝国历 312 年 4 月 2 日夜晚
帝国历 300 年的回忆
```

时间线记录：

```text
故事时间
结束时间
持续时间
章节
场景
人物
地点
前置事件
后续事件
是否为回忆
是否为梦境
是否为推测
```

### 5.7 伏笔记忆 Foreshadowing Memory

```ts
interface Foreshadowing {
  id: string;
  projectId: string;

  title: string;
  description: string;

  introducedChapterId: string;
  plannedResolutionChapterId?: string;
  resolvedChapterId?: string;

  status:
    | "planned"
    | "planted"
    | "developing"
    | "resolved"
    | "abandoned";

  relatedEntityIds: string[];
  appearanceCount: number;
  importance: number;
}
```

伏笔还应记录每次强化：

```text
第 3 章：首次出现青铜钥匙
第 8 章：钥匙上的王室徽记被提及
第 15 章：发现钥匙可以打开地下室
第 24 章：伏笔回收
```

### 5.8 摘要记忆 Summary Memory

每章至少生成四类摘要：

```text
一句话摘要
短摘要
详细摘要
结构化变化摘要
```

结构化变化摘要包括：

```text
新增事件
人物状态变化
关系变化
角色获得的新知识
新增世界观
新增伏笔
已回收伏笔
地点变化
时间推进
物品变化
```

### 5.9 风格记忆 Style Memory

项目可以覆盖用户全局风格：

```text
本项目叙述视角
本项目语气
禁用词
角色语言风格
句式特征
对白格式
章节标题规则
```

---

## 六、会话记忆 Session Memory

会话记忆只在当前创作会话中使用。

包括：

```text
用户最近的指令
本次对话中确认的临时要求
尚未提交的修改
当前选中的文字
最近一次生成结果
最近一次拒绝的方案
```

会话结束后：

- 临时指令可以丢弃
- 用户明确要求保存的内容可以提升为用户记忆
- 与小说事实相关的内容可以提升为项目记忆
- 不应自动保存完整对话

---

## 七、工作记忆 Working Memory

工作记忆是执行一次生成任务时临时组装的上下文。

例如生成第 20 章：

```text
当前任务
├── 用户当前指令
├── 当前章目标
├── 当前卷大纲
├── 当前场景计划
├── 出场人物当前状态
├── 出场人物知识边界
├── 当前地点设定
├── 上一章结尾
├── 最近章节摘要
├── 相关历史事件
├── 相关伏笔
├── 相关世界规则
└── 写作风格要求
```

任务完成后，工作记忆不直接长期保存。

应保存：

- 本次检索用了哪些记忆
- 每条记忆的得分
- 最终发送给模型的上下文
- 生成后提取出的新记忆

---

## 八、记忆优先级

发生冲突时使用以下优先级：

```text
1. 用户当前明确指令
2. 项目锁定的权威设定
3. 当前章节和当前卷大纲
4. 已确认的项目事实
5. 已确认的事件和人物状态
6. 用户全局偏好
7. AI 推断的项目记忆
8. AI 推断的用户偏好
9. 系统默认值
```

需要注意：

> 用户当前指令可以要求修改项目设定，但必须形成明确的设定变更，而不能让新旧设定长期同时有效。

---

## 九、统一记忆数据模型

建议建立统一的 `memory_items` 表，保存所有可检索记忆的公共字段。

```sql
CREATE TABLE memory_items (
  id TEXT PRIMARY KEY,

  scope TEXT NOT NULL,
  user_id TEXT,
  project_id TEXT,

  memory_type TEXT NOT NULL,
  subtype TEXT,

  title TEXT,
  content TEXT NOT NULL,
  structured_data TEXT,

  source_type TEXT NOT NULL,
  source_id TEXT,
  source_chapter_id TEXT,

  importance REAL NOT NULL DEFAULT 0.5,
  confidence REAL NOT NULL DEFAULT 1.0,

  canonical_level INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,

  valid_from_chapter_id TEXT,
  valid_to_chapter_id TEXT,

  status TEXT NOT NULL DEFAULT 'active',

  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

`scope`：

```text
user
project
session
```

`memory_type`：

```text
preference
canonical
character
character_state
character_knowledge
relationship
event
timeline
foreshadowing
summary
location
item
organization
style
constraint
```

业务专用表仍然保留，例如：

```text
characters
character_states
story_events
timeline_events
foreshadowings
```

`memory_items` 作为统一检索索引，不替代业务表。

---

## 十、记忆来源模型

```sql
CREATE TABLE memory_sources (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,

  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,

  excerpt TEXT,
  start_offset INTEGER,
  end_offset INTEGER,

  created_at TEXT NOT NULL
);
```

来源类型：

```text
user_input
project_setting
outline
chapter_content
chapter_summary
model_extraction
imported_document
system_inference
```

一条记忆可以有多个来源。

例如：

```text
“青铜钥匙属于王室”

来源一：第 8 章正文
来源二：世界观设定
来源三：用户手动确认
```

---

## 十一、记忆版本

任何重要记忆都不能直接覆盖。

```sql
CREATE TABLE memory_versions (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,

  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  structured_data TEXT,

  change_type TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  change_reason TEXT,

  created_at TEXT NOT NULL
);
```

`change_type`：

```text
create
update
confirm
lock
unlock
deprecate
restore
merge
```

---

## 十二、记忆关系图

建立统一实体关系：

```sql
CREATE TABLE memory_links (
  id TEXT PRIMARY KEY,

  project_id TEXT,
  from_memory_id TEXT NOT NULL,
  to_memory_id TEXT NOT NULL,

  relation_type TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,

  source_id TEXT,
  created_at TEXT NOT NULL
);
```

关系类型示例：

```text
involves_character
happened_at
caused_by
causes
mentions
contradicts
supports
depends_on
owns
knows
believes
related_to
resolves
foreshadows
```

首期可以用 SQLite 关系表实现，不需要立即引入图数据库。

---

## 十三、记忆写入流程

```text
正文或用户输入
        ↓
候选记忆提取
        ↓
Schema 校验
        ↓
实体解析与去重
        ↓
来源绑定
        ↓
冲突检测
        ↓
风险分类
        ↓
自动写入或等待确认
        ↓
生成全文索引
        ↓
生成向量索引
```

### 13.1 候选记忆提取

模型必须输出结构化结果：

```ts
interface MemoryExtractionResult {
  chapterSummary: ChapterSummary;

  newEvents: StoryEvent[];
  characterChanges: CharacterStateChange[];
  relationshipChanges: RelationshipChange[];
  knowledgeChanges: KnowledgeChange[];

  newWorldFacts: MemoryCandidate[];
  newForeshadowings: ForeshadowingCandidate[];
  resolvedForeshadowings: string[];

  possibleConflicts: MemoryConflictCandidate[];
}
```

### 13.2 风险分类

#### 可以自动写入

- 章节摘要
- 低风险事件
- 人物所在地点
- 已明确描写的物品获得和失去
- 生成任务日志
- 检索日志

#### 建议确认后写入

- 人物死亡
- 核心关系改变
- 阵营改变
- 身份揭示
- 核心世界规则变化
- 总纲改变
- 重要伏笔废弃
- 锁定设定被修改

### 13.3 正文修改后的处理

用户修改章节正文后：

```text
计算正文内容哈希
        ↓
发现正文发生变化
        ↓
标记原记忆为待验证
        ↓
重新提取本章记忆
        ↓
对比新旧记忆
        ↓
保留、更新或撤回
        ↓
重新生成索引
```

不能继续使用由旧正文提取出的无效事实。

---

## 十四、冲突检测系统

```sql
CREATE TABLE memory_conflicts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,

  old_memory_id TEXT NOT NULL,
  new_memory_id TEXT,

  conflict_type TEXT NOT NULL,
  description TEXT NOT NULL,

  severity TEXT NOT NULL,
  status TEXT NOT NULL,

  resolution TEXT,
  resolved_by TEXT,
  resolved_at TEXT,

  created_at TEXT NOT NULL
);
```

冲突类型：

```text
fact_conflict
timeline_conflict
location_conflict
character_state_conflict
knowledge_leak
relationship_conflict
inventory_conflict
canonical_conflict
```

严重度：

```text
info
warning
error
blocking
```

处理方式：

```text
保留旧记忆
接受新记忆
合并两条记忆
设置生效时间范围
将其中一条标记为角色误解
将其中一条标记为叙述不可靠
用户手动编辑
```

---

## 十五、RAG 总体流程

```text
生成任务
   ↓
查询理解
   ↓
实体和意图提取
   ↓
强制结构化检索
   ↓
全文检索
   ↓
向量检索
   ↓
关系扩展
   ↓
结果合并和去重
   ↓
规则过滤
   ↓
重排
   ↓
Token 预算裁剪
   ↓
上下文组装
   ↓
模型生成
   ↓
一致性检查
   ↓
记忆提取与回写
```

---

## 十六、查询理解

系统先把用户任务转换为检索计划：

```ts
interface RetrievalPlan {
  projectId: string;
  chapterId?: string;

  taskType:
    | "chapter_generation"
    | "rewrite"
    | "consistency_check"
    | "question_answering"
    | "outline_generation";

  entities: {
    characterIds: string[];
    locationIds: string[];
    itemIds: string[];
    organizationIds: string[];
  };

  keywords: string[];
  semanticQueries: string[];

  requiredMemoryTypes: string[];
  excludedMemoryTypes: string[];

  storyTime?: string;
  tokenBudget: number;
}
```

例如：

```text
任务：
生成主角在地下室发现王室档案的场景。

实体：
主角、地下室、王室档案、青铜钥匙

结构化检索：
主角当前状态
主角知道的信息
地下室地点设定
青铜钥匙状态
未回收的王室相关伏笔

语义检索：
过去与王室秘密相关的事件
关于地下室的早期描写
```

---

## 十七、结构化检索

结构化检索必须最先执行。

查询内容包括：

```text
当前章节规划
当前卷大纲
出场人物当前状态
人物知识边界
人物关系
当前地点
相关物品
故事时间
相关伏笔
权威世界规则
```

结构化结果默认具有较高权重。

---

## 十八、全文检索

使用 SQLite FTS5 建立关键词检索。

FTS5 支持短语、前缀、NEAR、列过滤、布尔组合以及基于相关性的排序，适合检索人物名称、专有名词、地点、物品和原文细节。

建议索引字段：

```sql
CREATE VIRTUAL TABLE memory_fts USING fts5(
  memory_id UNINDEXED,
  project_id UNINDEXED,
  memory_type UNINDEXED,

  title,
  content,
  entity_names,
  keywords,

  tokenize = 'trigram'
);
```

中文项目应实际测试：

```text
unicode61
trigram
自定义中文分词器
```

MVP 可以优先评估 `trigram`，正式发布前必须使用真实长篇中文小说做召回率和性能测试。

FTS 查询必须附带项目过滤：

```sql
SELECT m.*, bm25(memory_fts) AS keyword_score
FROM memory_fts
JOIN memory_items m
  ON m.id = memory_fts.memory_id
WHERE memory_fts MATCH ?
  AND m.project_id = ?
  AND m.is_enabled = 1
LIMIT ?;
```

---

## 十九、语义检索

语义检索用于查找表达不同但含义相近的内容。

例如查询：

```text
“角色对父亲的怨恨”
```

可能检索到正文：

```text
“他从未原谅那个在雨夜离开家的人。”
```

### 19.1 向量存储

本地版本建议采用可替换接口：

```ts
interface VectorStore {
  upsert(items: VectorItem[]): Promise<void>;

  search(query: VectorQuery): Promise<VectorResult[]>;

  deleteBySource(sourceId: string): Promise<void>;

  rebuild(projectId: string): Promise<void>;
}
```

首期可以不启用向量检索。

后续桌面版本可以评估 `sqlite-vec`。它提供 `vec0` 虚拟表、KNN 风格查询、元数据和分区字段，并提供 Rust 绑定；但集成前仍需验证各目标平台的扩展加载、构建和发布流程。

### 19.2 Embedding Provider

```ts
interface EmbeddingProvider {
  id: string;
  model: string;
  dimensions: number;

  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}
```

可支持：

```text
远程 Embedding API
Ollama Embedding
本地模型
用户自定义兼容接口
```

### 19.3 模型版本管理

向量必须记录：

```text
embedding_provider
embedding_model
embedding_dimensions
embedding_version
content_hash
created_at
```

模型发生变化时，旧向量不能和新向量直接混用。

---

## 二十、文本切块

不同记忆类型采用不同切块方式。

### 20.1 章节正文

优先按照场景和段落切块：

```text
章节
  → 场景
    → 若干相邻段落
```

建议目标：

```text
中文 500～1200 字一个块
重叠 100～200 字
```

具体数值必须根据 Embedding 模型和实际召回效果调整。

### 20.2 人物设定

每个人物基础资料作为一个或多个独立块：

```text
人物基础信息
人物动机
人物语言风格
人物当前状态
人物知识
```

### 20.3 世界观

按独立主题切块：

```text
力量体系
地理
历史
组织
法律
宗教
技术
```

### 20.4 事件

每个事件单独作为一个检索块。

### 20.5 伏笔

伏笔主体和每次强化记录可以分别建立块。

---

## 二十一、检索结果融合

不同检索渠道统一输出：

```ts
interface RetrievalCandidate {
  memoryId: string;
  sourceType: string;

  structuredScore: number;
  keywordScore: number;
  semanticScore: number;
  relationScore: number;
  recencyScore: number;
  importanceScore: number;
  canonicalScore: number;

  finalScore: number;
}
```

### 21.1 推荐评分公式

```text
finalScore =
  structuredScore × 0.25
+ canonicalScore  × 0.20
+ relationScore   × 0.15
+ keywordScore    × 0.15
+ semanticScore   × 0.15
+ importanceScore × 0.07
+ recencyScore    × 0.03
```

不同任务使用不同权重。

#### 章节生成

更重视：

```text
结构化关系
权威设定
人物当前状态
近期事件
```

#### 查找原文

更重视：

```text
关键词
语义相似度
章节定位
```

#### 一致性检查

更重视：

```text
权威设定
结构化事实
时间线
人物知识边界
```

---

## 二十二、去重与多样性

同一事实可能出现在：

- 世界观
- 章节正文
- 章节摘要
- 事件表
- 人物状态

不能重复占用上下文。

去重依据：

```text
memory_id
source_id
content_hash
实体组合
语义相似度
```

保留原则：

```text
锁定权威设定
    >
用户确认的结构化事实
    >
最新有效人物状态
    >
章节原文
    >
章节摘要
    >
AI 推断
```

同时要控制结果多样性，避免十条结果都来自同一章。

---

## 二十三、关系扩展

检索到核心实体后，可以扩展一跳关系。

例如检索到“青铜钥匙”：

```text
青铜钥匙
├── 持有者：林墨
├── 关联地点：地下室
├── 关联组织：王室
├── 关联伏笔：失踪王子
└── 首次出现：第 3 章
```

默认只扩展一跳。

只有一致性检查或复杂问答才考虑两跳，避免上下文无限扩张。

---

## 二十四、重排 Reranking

首期采用规则重排。

```text
权威级别
实体精确匹配
当前人物相关度
当前地点相关度
当前卷相关度
章节距离
故事时间距离
伏笔优先级
```

后续可增加模型重排：

```text
输入：
当前任务 + 候选记忆列表

输出：
相关性顺序 + 选择理由
```

重排模型只负责排序，不允许修改记忆事实。

---

## 二十五、Token 预算

上下文总预算由模型上下文窗口决定。

```ts
interface ContextBudget {
  total: number;

  systemPrompt: number;
  userInstruction: number;
  currentOutline: number;
  canonicalMemory: number;
  characterMemory: number;
  recentMemory: number;
  retrievedMemory: number;

  generationReserve: number;
}
```

推荐比例：

| 内容 | 比例 |
|---|---:|
| 系统和任务指令 | 10% |
| 当前章节与大纲 | 20% |
| 权威设定 | 15% |
| 人物状态与知识 | 15% |
| 最近章节 | 15% |
| RAG 检索结果 | 15% |
| 输出保留 | 10% |

比例根据任务动态调整。

一致性检查会提高权威设定和结构化记忆预算；正文续写会提高最近正文和当前场景预算。

---

## 二十六、上下文组装格式

不要把所有内容混合成一段文本。

推荐使用明确分区：

```text
[当前任务]

[不可违背的权威设定]

[当前卷与章节规划]

[出场人物当前状态]

[人物知识边界]

[当前地点和物品]

[最近剧情]

[相关历史事件]

[相关伏笔]

[用户写作偏好]

[输出要求]
```

每条检索记忆携带内部来源标识：

```text
memory_id
source_chapter
memory_type
confidence
```

这些标识供系统追踪，不要求模型在正文中输出。

---

## 二十七、生成后记忆更新

```text
模型生成正文
    ↓
结构化记忆提取
    ↓
与当前记忆对比
    ↓
一致性检查
    ↓
展示建议更新
    ↓
自动提交或用户确认
    ↓
写入业务表
    ↓
写入统一记忆索引
    ↓
更新 FTS
    ↓
更新 Embedding
```

数据库写入、版本记录和索引任务应当使用同一任务事务或可恢复任务。

如果向量生成失败：

- 正文和结构化记忆仍可保存
- 将向量任务标记为待重试
- 不能回滚用户正文

---

## 二十八、用户反馈闭环

系统记录用户对生成和检索结果的反馈：

```sql
CREATE TABLE memory_feedback (
  id TEXT PRIMARY KEY,

  memory_id TEXT,
  retrieval_log_id TEXT,

  feedback_type TEXT NOT NULL,
  value REAL,

  comment TEXT,
  created_at TEXT NOT NULL
);
```

反馈类型：

```text
helpful
irrelevant
incorrect
outdated
duplicate
should_be_locked
should_be_deleted
```

反馈可以影响后续排序，但不能自动改变权威事实。

---

## 二十九、检索日志

```sql
CREATE TABLE retrieval_logs (
  id TEXT PRIMARY KEY,

  project_id TEXT,
  task_type TEXT NOT NULL,
  query_text TEXT NOT NULL,

  retrieval_plan TEXT NOT NULL,
  candidate_count INTEGER NOT NULL,
  selected_memory_ids TEXT NOT NULL,

  token_count INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,

  created_at TEXT NOT NULL
);
```

需要支持在开发模式下查看：

- 使用了哪些查询
- 各渠道返回多少结果
- 每条结果得分
- 哪些结果被去重
- 哪些结果因 Token 预算被丢弃
- 最终上下文是什么

---

## 三十、用户界面

### 30.1 用户记忆中心

```text
用户记忆
├── 写作偏好
├── 内容约束
├── 工作流偏好
├── 写作风格
└── 可复用模板
```

每条记忆显示：

- 内容
- 来源
- 生效范围
- 是否启用
- 是否由系统推测
- 最后更新时间

### 30.2 项目记忆中心

```text
项目记忆
├── 权威设定
├── 人物状态
├── 人物知识
├── 人物关系
├── 剧情事件
├── 时间线
├── 伏笔
├── 章节摘要
└── 冲突
```

### 30.3 本次生成上下文

生成任务详情页显示：

```text
本次使用了 23 条记忆

权威设定：4 条
人物状态：5 条
最近摘要：4 条
伏笔：3 条
全文检索：4 条
语义检索：3 条
```

用户可以查看具体来源并标记不相关结果。

---

## 三十一、安全与隐私

### 禁止写入记忆

```text
API Key
密码
访问令牌
Cookie
支付信息
未授权的外部账号数据
```

API Key 应继续通过 Stronghold 或平台安全存储保存。

### 用户控制

必须提供：

```text
关闭用户记忆
关闭项目自动记忆
仅手动保存
删除某条记忆
删除全部用户记忆
删除全部项目记忆
导出记忆
重新构建索引
```

### 删除语义

删除一条记忆时必须同步删除：

```text
memory_items
memory_sources
memory_links
memory_fts
memory_embeddings
相关缓存
```

历史版本是否保留由用户设置决定。

---

## 三十二、Tauri 与 Rust 实现职责

### React / TypeScript

负责：

```text
用户界面
记忆管理页面
检索计划业务规则
Token 预算规则
上下文模板
Provider 抽象
展示检索解释
```

### Rust

负责：

```text
SQLite 事务
FTS5 查询
向量扩展
安全存储
文件导入
后台索引任务
Embedding 请求代理
检索日志
任务取消和恢复
```

Tauri SQL 插件支持 SQLite，并提供迁移能力；迁移在事务中执行，失败时整体回滚。它同时支持桌面和移动目标，但实际插件、SQLite 扩展和向量能力仍需分别进行平台验证。

---

## 三十三、核心服务接口

```ts
interface MemoryService {
  createMemory(input: CreateMemoryInput): Promise<MemoryItem>;

  updateMemory(
    id: string,
    input: UpdateMemoryInput
  ): Promise<MemoryItem>;

  confirmMemory(id: string): Promise<void>;
  lockMemory(id: string): Promise<void>;
  disableMemory(id: string): Promise<void>;
  deleteMemory(id: string): Promise<void>;

  extractFromChapter(
    chapterId: string
  ): Promise<MemoryExtractionResult>;

  rebuildProjectMemory(projectId: string): Promise<void>;
}
```

```ts
interface RetrievalService {
  createPlan(
    request: RetrievalRequest
  ): Promise<RetrievalPlan>;

  retrieve(
    plan: RetrievalPlan
  ): Promise<RetrievalCandidate[]>;

  rerank(
    plan: RetrievalPlan,
    candidates: RetrievalCandidate[]
  ): Promise<RetrievalCandidate[]>;

  buildContext(
    plan: RetrievalPlan,
    candidates: RetrievalCandidate[]
  ): Promise<BuiltContext>;
}
```

```ts
interface ConsistencyService {
  detectConflicts(
    projectId: string,
    candidates: MemoryCandidate[]
  ): Promise<MemoryConflictCandidate[]>;

  checkGeneratedContent(
    projectId: string,
    chapterId: string,
    content: string
  ): Promise<ConsistencyReport>;
}
```

---

## 三十四、后台任务

```text
memory_extract
memory_validate
memory_index_fts
memory_embed
memory_rebuild
memory_conflict_scan
memory_cleanup
```

任务状态：

```text
queued
running
completed
failed
cancelled
waiting_for_confirmation
```

所有任务都应支持：

- 重试
- 错误记录
- 进度
- 取消
- 应用重启后恢复

---

## 三十五、性能策略

### 数据库索引

```sql
CREATE INDEX idx_memory_project_type
ON memory_items(project_id, memory_type, status);

CREATE INDEX idx_memory_user_type
ON memory_items(user_id, memory_type, status);

CREATE INDEX idx_memory_source
ON memory_items(source_type, source_id);

CREATE INDEX idx_memory_validity
ON memory_items(
  project_id,
  valid_from_chapter_id,
  valid_to_chapter_id
);
```

### 缓存

可以缓存：

```text
当前项目权威设定
当前人物状态
当前卷大纲
最近章节摘要
常用用户偏好
```

缓存失效依据：

```text
memory updated_at
project revision
chapter revision
content_hash
```

---

## 三十六、测试方案

### 单元测试

```text
记忆优先级
项目隔离
角色知识边界
冲突检测
记忆版本
FTS 查询构造
向量结果归一化
混合评分
去重
Token 裁剪
```

### 集成测试

```text
章节生成后自动更新人物状态
修改正文后旧记忆失效
删除章节后相关索引清理
切换项目后不出现其他项目记忆
更换 Embedding 模型后重新索引
应用重启后后台任务恢复
```

### RAG 质量测试集

建立固定测试问题：

```text
角色当前在哪里？
角色是否知道某个秘密？
某件物品现在由谁持有？
某个伏笔首次在哪章出现？
人物关系为什么发生变化？
某个地点过去发生过什么？
```

评估指标：

```text
Recall@K
Precision@K
MRR
冲突检出率
角色知识泄漏率
无关上下文比例
Token 利用率
生成事实错误率
```

---

## 三十七、分阶段实现

### 第一阶段：结构化记忆

实现：

```text
用户偏好
权威设定
人物状态
剧情事件
时间线
伏笔
章节摘要
记忆来源
记忆版本
项目隔离
```

检索：

```text
结构化查询
+ 最近章节
```

### 第二阶段：全文 RAG

增加：

```text
FTS5
关键词提取
混合去重
规则重排
Token 预算
检索日志
```

### 第三阶段：向量 RAG

增加：

```text
Embedding Provider
文本切块
向量存储
语义检索
混合评分
索引重建
```

### 第四阶段：记忆智能化

增加：

```text
人物知识边界
自动冲突检测
关系图扩展
模型重排
用户反馈学习
记忆质量评分
```

### 第五阶段：高级图检索

根据实际数据规模评估：

```text
多跳关系推理
GraphRAG
独立图数据库
跨项目素材库
```

不要在 MVP 阶段直接引入复杂 GraphRAG。

---

## 三十八、验收标准

系统达到以下条件后，可以认为基础记忆与 RAG 已经完成：

1. 不同项目之间不存在记忆串扰。
2. 可以查询任意人物在当前章节的有效状态。
3. 可以查询每个角色知道和不知道的信息。
4. 每个重要事实都能够追溯来源。
5. 用户修改正文后，旧记忆和索引能够失效或重建。
6. 检索结果能够说明来源和选择原因。
7. 锁定设定不会被 AI 自动覆盖。
8. 生成章节后能自动提取摘要、事件和人物变化。
9. 用户能够查看、编辑、禁用和删除记忆。
10. API Key 和其他机密信息不会进入记忆系统。
11. RAG 上下文不会超过设定的 Token 预算。
12. 即使向量索引不可用，结构化检索和全文检索仍能正常工作。

---

## 三十九、最终架构结论

AI-Writer 的完整记忆系统应采用：

```text
用户记忆
    +
项目结构化记忆
    +
章节摘要记忆
    +
人物知识与状态
    +
事件、时间线和伏笔
    +
SQLite FTS5
    +
可选 sqlite-vec 向量检索
    +
关系扩展
    +
规则与模型重排
    +
Token 预算组装
    +
生成后记忆回写
```

系统默认以结构化事实为核心，以全文检索保证精确召回，以向量检索补充语义召回。

最终原则是：

> 向量检索负责找到可能相关的内容，结构化记忆负责确认事实，权威设定负责决定什么不能被违反，用户负责决定什么值得长期记住。
