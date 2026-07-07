import type { NovelProject } from "@ai-writer/core";
import { ChapterEditor } from "@ai-writer/editor";
import type { PlatformService } from "@ai-writer/platform";
import type { ModelProfile, ProviderConfig } from "@ai-writer/providers";
import { createProjectInputSchema } from "@ai-writer/schemas";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProviderSettings } from "./ProviderSettings";

export interface AppShellProps {
  platform: PlatformService;
}

const starterContent = `
<h2>第一章：未命名章节</h2>
<p>在左侧创建或选择一个小说项目，然后从这里开始写作。</p>
<p>Provider 配置完成后，可以使用右侧的 AI 助手进行流式续写。</p>
`;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function AppShell({ platform }: AppShellProps) {
  const [projects, setProjects] = useState<NovelProject[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<ProviderConfig>();
  const [activeProfile, setActiveProfile] = useState<ModelProfile>();
  const [editorContent, setEditorContent] = useState(starterContent);
  const [streamText, setStreamText] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string>();
  const [usageText, setUsageText] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? projects[0],
    [projects, selectedId],
  );

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    try {
      const nextProjects = await platform.projects.list();
      setProjects(nextProjects);
      setSelectedId((current) => current ?? nextProjects[0]?.id);
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [platform]);

  const refreshProvider = useCallback(async () => {
    const providers = await platform.providers.listProviders();
    const provider = providers[0];
    setActiveProvider(provider);
    if (!provider) {
      setActiveProfile(undefined);
      return;
    }
    const profiles = await platform.providers.listModelProfiles(provider.id);
    setActiveProfile(profiles[0]);
  }, [platform]);

  useEffect(() => {
    void refreshProjects();
    void refreshProvider().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }, [refreshProjects, refreshProvider]);

  async function createProject() {
    setCreating(true);
    try {
      const input = createProjectInputSchema.parse({
        title: `未命名小说 ${projects.length + 1}`,
        genre: "",
        summary: "",
      });
      const project = await platform.projects.create(input);
      await refreshProjects();
      setSelectedId(project.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setCreating(false);
    }
  }

  async function startGeneration() {
    setError(undefined);
    setUsageText("");
    setStreamText("");

    if (!selectedProject) {
      setError("请先创建小说项目");
      return;
    }
    if (!activeProvider || !activeProfile) {
      setSettingsOpen(true);
      setError("请先配置 Provider 和模型档案");
      return;
    }
    if (!activeProvider.apiKeyRef) {
      setSettingsOpen(true);
      setError("Provider 没有 API Key 引用，请重新保存配置");
      return;
    }
    if (!platform.secureStorage.isUnlocked()) {
      setSettingsOpen(true);
      setError("请先在模型服务设置中解锁密钥库");
      return;
    }

    try {
      const taskId = crypto.randomUUID();
      setActiveTaskId(taskId);
      let generatedText = "";

      await platform.providerRuntime.generate(
        {
          taskId,
          provider: activeProvider,
          profile: activeProfile,
          systemPrompt:
            "你是专业小说写作助手。保持人物、世界观和叙事视角一致，只输出续写正文。",
          userPrompt: `请为小说《${selectedProject.title}》续写当前章节。保持自然衔接，输出约 500 字。`,
        },
        (event) => {
          if (event.event === "chunk") {
            generatedText += event.data.text;
            setStreamText(generatedText);
          } else if (event.event === "finished") {
            const input = event.data.inputTokens ?? 0;
            const output = event.data.outputTokens ?? 0;
            setUsageText(input || output ? `Token：${input} 输入 / ${output} 输出` : "生成完成");
          } else if (event.event === "error") {
            setError(event.data.message);
          }
        },
      );

      if (generatedText.trim()) {
        const safe = escapeHtml(generatedText).replaceAll("\n", "<br />");
        setEditorContent((current) => `${current}<p data-ai-generated="true">${safe}</p>`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setActiveTaskId(undefined);
    }
  }

  async function cancelGeneration() {
    if (!activeTaskId) return;
    const cancelled = await platform.providerRuntime.cancel(activeTaskId);
    if (cancelled) setUsageText("正在取消生成…");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>AI-Writer</strong>
          <span className="topbar__runtime">
            {platform.runtime.platform === "native" ? "Tauri" : "Web"} · {platform.runtime.version}
          </span>
        </div>
        <div className="topbar__actions">
          <span className="status-dot" aria-hidden="true" />
          <span>本地优先</span>
          <button type="button" className="topbar__button" onClick={() => setSettingsOpen(true)}>
            模型设置
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="panel-heading">
            <span>小说项目</span>
            <button type="button" onClick={() => void createProject()} disabled={creating}>
              {creating ? "…" : "+"}
            </button>
          </div>

          {loading ? <p className="muted">正在载入项目…</p> : null}
          {error ? <p className="error-text">{error}</p> : null}

          <nav className="project-list" aria-label="小说项目">
            {projects.map((project) => (
              <button
                type="button"
                className={project.id === selectedProject?.id ? "project-item active" : "project-item"}
                key={project.id}
                onClick={() => setSelectedId(project.id)}
              >
                <span>{project.title}</span>
                <small>{project.status === "planning" ? "规划中" : "创作中"}</small>
              </button>
            ))}
          </nav>

          {!loading && projects.length === 0 ? (
            <div className="empty-state">
              <p>还没有小说项目。</p>
              <button type="button" onClick={() => void createProject()}>
                创建第一个项目
              </button>
            </div>
          ) : null}
        </aside>

        <main className="editor-panel">
          <div className="editor-toolbar">
            <div>
              <h1>{selectedProject?.title ?? "欢迎使用 AI-Writer"}</h1>
              <p>{selectedProject?.genre || "未设置题材"}</p>
            </div>
            <div className="editor-toolbar__buttons">
              <button type="button">保存版本</button>
              {activeTaskId ? (
                <button type="button" className="danger-button" onClick={() => void cancelGeneration()}>
                  取消生成
                </button>
              ) : (
                <button type="button" className="primary-button" onClick={() => void startGeneration()}>
                  AI 续写
                </button>
              )}
            </div>
          </div>

          <section className="editor-card">
            <ChapterEditor
              content={editorContent}
              onChange={(html) => setEditorContent(html)}
            />
          </section>

          <footer className="editor-footer">
            <span>章节自动保存：待接入</span>
            <span>{usageText || "记忆上下文：0 条"}</span>
          </footer>
        </main>

        <aside className="inspector">
          <section>
            <h2>AI 助手</h2>
            <div className="provider-summary">
              <strong>{activeProvider?.name ?? "未配置 Provider"}</strong>
              <span>{activeProfile?.model ?? "请打开模型设置"}</span>
            </div>
            <div className="action-grid">
              <button type="button" onClick={() => void startGeneration()} disabled={Boolean(activeTaskId)}>
                生成场景
              </button>
              <button type="button">改写选区</button>
              <button type="button">扩写</button>
              <button type="button">一致性检查</button>
            </div>
            {streamText ? (
              <div className="stream-preview">
                <span>实时输出</span>
                <p>{streamText}</p>
              </div>
            ) : null}
          </section>

          <section>
            <h2>项目记忆</h2>
            <ul className="memory-list">
              <li><span>权威设定</span><strong>0</strong></li>
              <li><span>人物状态</span><strong>0</strong></li>
              <li><span>剧情事件</span><strong>0</strong></li>
              <li><span>待回收伏笔</span><strong>0</strong></li>
            </ul>
          </section>

          <section>
            <h2>基础能力</h2>
            <ul className="capability-list">
              <li className="ready">SQLite 迁移</li>
              <li className="ready">Stronghold 密钥库</li>
              <li className="ready">Provider 配置</li>
              <li className="ready">流式模型请求</li>
            </ul>
          </section>
        </aside>
      </div>

      <ProviderSettings
        open={settingsOpen}
        platform={platform}
        onClose={() => setSettingsOpen(false)}
        onChanged={() => void refreshProvider()}
      />
    </div>
  );
}
