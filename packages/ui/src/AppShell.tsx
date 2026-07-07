import {
  createHtmlContentDocument,
  type Chapter,
  type GenerationJob,
  type NovelProject,
  type Volume,
} from "@ai-writer/core";
import { ChapterEditor } from "@ai-writer/editor";
import type { PlatformService } from "@ai-writer/platform";
import type { ModelProfile, ProviderConfig } from "@ai-writer/providers";
import { createProjectInputSchema } from "@ai-writer/schemas";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ProviderSettings } from "./ProviderSettings";

export interface AppShellProps {
  platform: PlatformService;
}

const emptyEditorContent =
  "<h2>请选择章节</h2><p>在左侧创建卷和章节后开始写作。</p>";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function generationStatusLabel(status: GenerationJob["status"]): string {
  const labels: Record<GenerationJob["status"], string> = {
    queued: "排队中",
    building_context: "构建上下文",
    planning: "规划中",
    generating: "生成中",
    reviewing: "审阅中",
    rewriting: "改写中",
    saving: "保存中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[status];
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AppShell({ platform }: AppShellProps) {
  const [projects, setProjects] = useState<NovelProject[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string>();
  const [recentJobs, setRecentJobs] = useState<GenerationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<ProviderConfig>();
  const [activeProfile, setActiveProfile] = useState<ModelProfile>();
  const [editorContent, setEditorContent] = useState(emptyEditorContent);
  const [editorPlainText, setEditorPlainText] = useState("");
  const [streamText, setStreamText] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string>();
  const [usageText, setUsageText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [versionNotice, setVersionNotice] = useState("");

  const lastSavedRef = useRef({
    chapterId: "",
    html: emptyEditorContent,
    text: "",
  });
  const generatedTextRef = useRef("");
  const cancelRequestedRef = useRef(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? projects[0],
    [projects, selectedId],
  );

  const selectedChapter = useMemo(
    () =>
      chapters.find((chapter) => chapter.id === selectedChapterId) ??
      chapters[0],
    [chapters, selectedChapterId],
  );

  const chaptersByVolume = useMemo(() => {
    const result = new Map<string, Chapter[]>();
    for (const chapter of chapters) {
      const key = chapter.volumeId ?? "unassigned";
      const group = result.get(key) ?? [];
      group.push(chapter);
      result.set(key, group);
    }
    return result;
  }, [chapters]);

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    try {
      const nextProjects = await platform.projects.list();
      setProjects(nextProjects);
      setSelectedId((current) => {
        if (current && nextProjects.some((project) => project.id === current)) {
          return current;
        }
        return nextProjects[0]?.id;
      });
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

  const refreshContent = useCallback(
    async (projectId: string, preferredChapterId?: string) => {
      const [nextVolumes, nextChapters] = await Promise.all([
        platform.contents.listVolumes(projectId),
        platform.contents.listChapters(projectId),
      ]);
      setVolumes(nextVolumes);
      setChapters(nextChapters);
      setSelectedChapterId((current) => {
        const candidate = preferredChapterId ?? current;
        if (
          candidate &&
          nextChapters.some((chapter) => chapter.id === candidate)
        ) {
          return candidate;
        }
        return nextChapters[0]?.id;
      });
    },
    [platform],
  );

  const refreshJobs = useCallback(
    async (projectId: string) => {
      const jobs = await platform.generationJobs.listRecent(projectId, 12);
      setRecentJobs(jobs);
    },
    [platform],
  );

  useEffect(() => {
    void refreshProjects();
    void refreshProvider().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }, [refreshProjects, refreshProvider]);

  useEffect(() => {
    if (!selectedProject) {
      setVolumes([]);
      setChapters([]);
      setRecentJobs([]);
      setSelectedChapterId(undefined);
      return;
    }

    void (async () => {
      try {
        await platform.generationJobs.markInterrupted(selectedProject.id);
        await Promise.all([
          refreshContent(selectedProject.id),
          refreshJobs(selectedProject.id),
        ]);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();
  }, [platform, refreshContent, refreshJobs, selectedProject]);

  useEffect(() => {
    if (!selectedChapter) {
      setEditorContent(emptyEditorContent);
      setEditorPlainText("");
      lastSavedRef.current = {
        chapterId: "",
        html: emptyEditorContent,
        text: "",
      };
      setSaveState("idle");
      return;
    }

    setEditorContent(selectedChapter.contentMarkdown || emptyEditorContent);
    setEditorPlainText(selectedChapter.plainText);
    lastSavedRef.current = {
      chapterId: selectedChapter.id,
      html: selectedChapter.contentMarkdown || emptyEditorContent,
      text: selectedChapter.plainText,
    };
    setSaveState("saved");
    setVersionNotice("");
  }, [selectedChapter]);

  useEffect(() => {
    if (!selectedChapter) return;
    const lastSaved = lastSavedRef.current;
    if (
      lastSaved.chapterId === selectedChapter.id &&
      lastSaved.html === editorContent &&
      lastSaved.text === editorPlainText
    ) {
      return;
    }

    setSaveState("dirty");
    const timer = globalThis.setTimeout(() => {
      setSaveState("saving");
      void platform.contents
        .saveChapterContent({
          chapterId: selectedChapter.id,
          contentJson: createHtmlContentDocument(editorContent),
          contentMarkdown: editorContent,
          plainText: editorPlainText,
          ...(selectedChapter.summary
            ? { summary: selectedChapter.summary }
            : {}),
        })
        .then((updated) => {
          setChapters((current) =>
            current.map((chapter) =>
              chapter.id === updated.id ? updated : chapter,
            ),
          );
          lastSavedRef.current = {
            chapterId: updated.id,
            html: updated.contentMarkdown,
            text: updated.plainText,
          };
          setSaveState("saved");
        })
        .catch((reason: unknown) => {
          setSaveState("error");
          setError(reason instanceof Error ? reason.message : String(reason));
        });
    }, 900);

    return () => globalThis.clearTimeout(timer);
  }, [
    editorContent,
    editorPlainText,
    platform,
    selectedChapter,
  ]);

  async function createProject() {
    setCreating(true);
    try {
      const input = createProjectInputSchema.parse({
        title: `未命名小说 ${projects.length + 1}`,
        genre: "",
        summary: "",
      });
      const project = await platform.projects.create(input);
      const volume = await platform.contents.createVolume({
        projectId: project.id,
        title: "第一卷",
        summary: "",
      });
      const chapter = await platform.contents.createChapter({
        projectId: project.id,
        volumeId: volume.id,
        title: "第一章",
        status: "planned",
      });
      await refreshProjects();
      setSelectedId(project.id);
      await refreshContent(project.id, chapter.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setCreating(false);
    }
  }

  async function createVolume() {
    if (!selectedProject) return;
    try {
      const volume = await platform.contents.createVolume({
        projectId: selectedProject.id,
        title: `第 ${volumes.length + 1} 卷`,
        summary: "",
      });
      await refreshContent(selectedProject.id);
      setVersionNotice(`已创建《${volume.title}》`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function createChapter() {
    if (!selectedProject) return;
    try {
      const targetVolume = volumes[0];
      const chapter = await platform.contents.createChapter({
        projectId: selectedProject.id,
        title: `第 ${chapters.length + 1} 章`,
        status: "planned",
        ...(targetVolume ? { volumeId: targetVolume.id } : {}),
      });
      await refreshContent(selectedProject.id, chapter.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function saveVersion() {
    if (!selectedChapter) return;
    try {
      const updated = await platform.contents.saveChapterContent({
        chapterId: selectedChapter.id,
        contentJson: createHtmlContentDocument(editorContent),
        contentMarkdown: editorContent,
        plainText: editorPlainText,
        ...(selectedChapter.summary
          ? { summary: selectedChapter.summary }
          : {}),
      });
      lastSavedRef.current = {
        chapterId: updated.id,
        html: updated.contentMarkdown,
        text: updated.plainText,
      };
      setChapters((current) =>
        current.map((chapter) =>
          chapter.id === updated.id ? updated : chapter,
        ),
      );
      const version = await platform.contents.createChapterVersion({
        chapterId: selectedChapter.id,
        contentJson: createHtmlContentDocument(editorContent),
        contentMarkdown: editorContent,
        plainText: editorPlainText,
        changeType: "manual",
        changeReason: "用户手动保存版本",
      });
      setSaveState("saved");
      setVersionNotice(`已保存版本 v${version.version}`);
    } catch (reason) {
      setSaveState("error");
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function startGeneration() {
    setError(undefined);
    setUsageText("");
    setStreamText("");
    setVersionNotice("");
    cancelRequestedRef.current = false;
    generatedTextRef.current = "";

    if (!selectedProject || !selectedChapter) {
      setError("请先创建并选择章节");
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

    const taskId = crypto.randomUUID();
    setActiveTaskId(taskId);

    try {
      await platform.generationJobs.create({
        id: taskId,
        projectId: selectedProject.id,
        chapterId: selectedChapter.id,
        providerConfigId: activeProvider.id,
        modelProfileId: activeProfile.id,
        taskType: "chapter_continuation",
      });
      await platform.generationJobs.update(taskId, {
        status: "generating",
        progress: 0.1,
      });
      await refreshJobs(selectedProject.id);

      let inputTokens: number | undefined;
      let outputTokens: number | undefined;

      await platform.providerRuntime.generate(
        {
          taskId,
          provider: activeProvider,
          profile: activeProfile,
          systemPrompt:
            "你是专业小说写作助手。保持人物、世界观和叙事视角一致，只输出续写正文。",
          userPrompt: [
            `请为小说《${selectedProject.title}》的《${selectedChapter.title}》续写正文。`,
            "保持自然衔接，输出约 500 字。",
            "当前章节末尾内容：",
            editorPlainText.slice(-4_000),
          ].join("\n"),
        },
        (event) => {
          if (event.event === "chunk") {
            generatedTextRef.current += event.data.text;
            setStreamText(generatedTextRef.current);
          } else if (event.event === "finished") {
            inputTokens = event.data.inputTokens;
            outputTokens = event.data.outputTokens;
          } else if (event.event === "error") {
            setError(event.data.message);
          }
        },
      );

      const generatedText = generatedTextRef.current;
      if (generatedText.trim()) {
        await platform.generationJobs.replaceOutput(taskId, generatedText);
      }
      await platform.generationJobs.update(taskId, {
        status: "completed",
        progress: 1,
        ...(inputTokens !== undefined ? { inputTokens } : {}),
        ...(outputTokens !== undefined ? { outputTokens } : {}),
        errorCode: null,
        errorMessage: null,
      });

      if (generatedText.trim()) {
        const safe = escapeHtml(generatedText).replaceAll("\n", "<br />");
        const separator =
          editorContent.trim().length > 0 ? "<p><br /></p>" : "";
        setEditorContent(
          (current) =>
            `${current}${separator}<p data-ai-generated="true">${safe}</p>`,
        );
        setEditorPlainText((current) =>
          current.trim()
            ? `${current}\n\n${generatedText}`
            : generatedText,
        );
      }

      const input = inputTokens ?? 0;
      const output = outputTokens ?? 0;
      setUsageText(
        input || output
          ? `Token：${input} 输入 / ${output} 输出`
          : "生成完成",
      );
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      const generatedText = generatedTextRef.current;
      if (generatedText.trim()) {
        await platform.generationJobs
          .replaceOutput(taskId, generatedText)
          .catch(() => undefined);
      }
      await platform.generationJobs
        .update(taskId, {
          status: cancelRequestedRef.current ? "cancelled" : "failed",
          progress: 1,
          errorCode: cancelRequestedRef.current
            ? "user_cancelled"
            : "generation_failed",
          errorMessage: message,
        })
        .catch(() => undefined);
      if (!cancelRequestedRef.current) setError(message);
      else setUsageText("生成已取消，现有输出可从任务记录恢复");
    } finally {
      setActiveTaskId(undefined);
      if (selectedProject) await refreshJobs(selectedProject.id);
    }
  }

  async function cancelGeneration() {
    if (!activeTaskId) return;
    cancelRequestedRef.current = true;
    const cancelled = await platform.providerRuntime.cancel(activeTaskId);
    if (cancelled) setUsageText("正在取消生成…");
  }

  async function restoreJob(job: GenerationJob) {
    if (!selectedChapter) {
      setError("请先选择要恢复到的章节");
      return;
    }
    try {
      const output = await platform.generationJobs.getOutput(job.id);
      if (!output?.content.trim()) {
        setError("该任务没有可恢复的输出");
        return;
      }
      const safe = escapeHtml(output.content).replaceAll("\n", "<br />");
      const nextHtml = `${editorContent}<p><br /></p><p data-recovered-job="${job.id}">${safe}</p>`;
      const nextText = editorPlainText.trim()
        ? `${editorPlainText}\n\n${output.content}`
        : output.content;
      setEditorContent(nextHtml);
      setEditorPlainText(nextText);
      await platform.contents.createChapterVersion({
        chapterId: selectedChapter.id,
        contentJson: createHtmlContentDocument(nextHtml),
        contentMarkdown: nextHtml,
        plainText: nextText,
        changeType: "recovery",
        changeReason: `恢复生成任务 ${job.id}`,
      });
      setVersionNotice("已恢复任务输出，章节将在稍后自动保存");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  const saveLabel =
    saveState === "saving"
      ? "正在保存…"
      : saveState === "dirty"
        ? "有未保存更改"
        : saveState === "error"
          ? "自动保存失败"
          : saveState === "saved"
            ? "已自动保存"
            : "请选择章节";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>AI-Writer</strong>
          <span className="topbar__runtime">
            {platform.runtime.platform === "native" ? "Tauri" : "Web"} ·{" "}
            {platform.runtime.version}
          </span>
        </div>
        <div className="topbar__actions">
          <span className="status-dot" aria-hidden="true" />
          <span>本地优先</span>
          <button
            type="button"
            className="topbar__button"
            onClick={() => setSettingsOpen(true)}
          >
            模型设置
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="panel-heading">
            <span>小说项目</span>
            <button
              type="button"
              onClick={() => void createProject()}
              disabled={creating}
            >
              {creating ? "…" : "+"}
            </button>
          </div>

          {loading ? <p className="muted">正在载入项目…</p> : null}
          {error ? <p className="error-text">{error}</p> : null}

          <nav className="project-list" aria-label="小说项目">
            {projects.map((project) => (
              <button
                type="button"
                className={
                  project.id === selectedProject?.id
                    ? "project-item active"
                    : "project-item"
                }
                key={project.id}
                onClick={() => setSelectedId(project.id)}
              >
                <span>{project.title}</span>
                <small>
                  {project.status === "planning" ? "规划中" : "创作中"}
                </small>
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

          {selectedProject ? (
            <section className="story-structure">
              <div className="story-structure__header">
                <span>卷与章节</span>
                <div>
                  <button type="button" onClick={() => void createVolume()}>
                    + 卷
                  </button>
                  <button type="button" onClick={() => void createChapter()}>
                    + 章
                  </button>
                </div>
              </div>

              {volumes.map((volume) => (
                <div className="volume-node" key={volume.id}>
                  <strong>{volume.title}</strong>
                  <div className="chapter-list">
                    {(chaptersByVolume.get(volume.id) ?? []).map((chapter) => (
                      <button
                        type="button"
                        key={chapter.id}
                        className={
                          chapter.id === selectedChapter?.id
                            ? "chapter-item active"
                            : "chapter-item"
                        }
                        onClick={() => setSelectedChapterId(chapter.id)}
                      >
                        <span>{chapter.title}</span>
                        <small>{chapter.status}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {(chaptersByVolume.get("unassigned") ?? []).length > 0 ? (
                <div className="volume-node">
                  <strong>未分卷</strong>
                  <div className="chapter-list">
                    {(chaptersByVolume.get("unassigned") ?? []).map(
                      (chapter) => (
                        <button
                          type="button"
                          key={chapter.id}
                          className={
                            chapter.id === selectedChapter?.id
                              ? "chapter-item active"
                              : "chapter-item"
                          }
                          onClick={() => setSelectedChapterId(chapter.id)}
                        >
                          <span>{chapter.title}</span>
                          <small>{chapter.status}</small>
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </aside>

        <main className="editor-panel">
          <div className="editor-toolbar">
            <div>
              <h1>
                {selectedChapter?.title ??
                  selectedProject?.title ??
                  "欢迎使用 AI-Writer"}
              </h1>
              <p>
                {selectedProject
                  ? `${selectedProject.title} · ${
                      selectedProject.genre || "未设置题材"
                    }`
                  : "请创建小说项目"}
              </p>
            </div>
            <div className="editor-toolbar__buttons">
              <button
                type="button"
                disabled={!selectedChapter}
                onClick={() => void saveVersion()}
              >
                保存版本
              </button>
              {activeTaskId ? (
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => void cancelGeneration()}
                >
                  取消生成
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void startGeneration()}
                >
                  AI 续写
                </button>
              )}
            </div>
          </div>

          <section className="editor-card">
            <ChapterEditor
              content={editorContent}
              onChange={(html, text) => {
                setEditorContent(html);
                setEditorPlainText(text);
              }}
            />
          </section>

          <footer className="editor-footer">
            <span>{saveLabel}</span>
            <span>{versionNotice || usageText || "记忆上下文：0 条"}</span>
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
              <button
                type="button"
                onClick={() => void startGeneration()}
                disabled={Boolean(activeTaskId)}
              >
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
            <h2>最近生成任务</h2>
            <div className="job-list">
              {recentJobs.length === 0 ? (
                <p className="muted">暂无生成任务</p>
              ) : (
                recentJobs.map((job) => (
                  <article className="job-item" key={job.id}>
                    <div>
                      <strong>{generationStatusLabel(job.status)}</strong>
                      <time>{formatTime(job.updatedAt)}</time>
                    </div>
                    <p>
                      {job.errorMessage ??
                        `${job.inputTokens ?? 0} 输入 / ${
                          job.outputTokens ?? 0
                        } 输出`}
                    </p>
                    {job.status !== "generating" ? (
                      <button
                        type="button"
                        onClick={() => void restoreJob(job)}
                      >
                        恢复输出
                      </button>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>

          <section>
            <h2>项目记忆</h2>
            <ul className="memory-list">
              <li>
                <span>权威设定</span>
                <strong>0</strong>
              </li>
              <li>
                <span>人物状态</span>
                <strong>0</strong>
              </li>
              <li>
                <span>剧情事件</span>
                <strong>0</strong>
              </li>
              <li>
                <span>待回收伏笔</span>
                <strong>0</strong>
              </li>
            </ul>
          </section>

          <section>
            <h2>基础能力</h2>
            <ul className="capability-list">
              <li className="ready">卷与章节持久化</li>
              <li className="ready">章节自动保存</li>
              <li className="ready">章节历史版本</li>
              <li className="ready">生成任务恢复</li>
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
