import type { NovelProject } from "@ai-writer/core";
import { ChapterEditor } from "@ai-writer/editor";
import type { PlatformService } from "@ai-writer/platform";
import { createProjectInputSchema } from "@ai-writer/schemas";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface AppShellProps {
  platform: PlatformService;
}

const starterContent = `
<h2>第一章：未命名章节</h2>
<p>在左侧创建或选择一个小说项目，然后从这里开始写作。</p>
<p>后续版本将接入章节自动保存、AI 续写、项目记忆和一致性检查。</p>
`;

export function AppShell({ platform }: AppShellProps) {
  const [projects, setProjects] = useState<NovelProject[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? projects[0],
    [projects, selectedId],
  );

  const refresh = useCallback(async () => {
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createProject() {
    setCreating(true);
    try {
      const input = createProjectInputSchema.parse({
        title: `未命名小说 ${projects.length + 1}`,
        genre: "",
        summary: "",
      });
      const project = await platform.projects.create(input);
      await refresh();
      setSelectedId(project.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setCreating(false);
    }
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
              <button type="button" className="primary-button">AI 续写</button>
            </div>
          </div>

          <section className="editor-card">
            <ChapterEditor content={starterContent} />
          </section>

          <footer className="editor-footer">
            <span>章节自动保存：待接入</span>
            <span>记忆上下文：0 条</span>
          </footer>
        </main>

        <aside className="inspector">
          <section>
            <h2>AI 助手</h2>
            <div className="action-grid">
              <button type="button">生成场景</button>
              <button type="button">改写选区</button>
              <button type="button">扩写</button>
              <button type="button">一致性检查</button>
            </div>
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
              <li className="ready">Stronghold 宿主</li>
              <li className="ready">混合 RAG 接口</li>
              <li>模型流式生成</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
