import type {
  Chapter,
  ChapterVersion,
  NovelProject,
  Volume,
} from "@ai-writer/core";
import type { PlatformService } from "@ai-writer/platform";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  StoryStructure,
  type MoveDirection,
} from "./StoryStructure";
import { VersionHistory } from "./VersionHistory";

interface ContentManagerProps {
  platform: PlatformService;
  onChanged(): void;
}

type UndoEntry =
  | { kind: "volume"; id: string; label: string }
  | { kind: "chapter"; id: string; label: string };

export function ContentManager({ platform, onChanged }: ContentManagerProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<NovelProject[]>([]);
  const [projectId, setProjectId] = useState<string>();
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState<string>();
  const [versions, setVersions] = useState<ChapterVersion[]>([]);
  const [undoEntry, setUndoEntry] = useState<UndoEntry>();
  const [restoringVersionId, setRestoringVersionId] = useState<string>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? projects[0],
    [projectId, projects],
  );
  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === chapterId) ?? chapters[0],
    [chapterId, chapters],
  );

  const refreshProjects = useCallback(async () => {
    const next = await platform.projects.list();
    setProjects(next);
    setProjectId((current) =>
      current && next.some((project) => project.id === current)
        ? current
        : next[0]?.id,
    );
  }, [platform]);

  const refreshContent = useCallback(
    async (nextProjectId: string, preferredChapterId?: string) => {
      const [nextVolumes, nextChapters] = await Promise.all([
        platform.contents.listVolumes(nextProjectId),
        platform.contents.listChapters(nextProjectId),
      ]);
      setVolumes(nextVolumes);
      setChapters(nextChapters);
      setChapterId((current) => {
        const candidate = preferredChapterId ?? current;
        return candidate && nextChapters.some((chapter) => chapter.id === candidate)
          ? candidate
          : nextChapters[0]?.id;
      });
    },
    [platform],
  );

  const refreshVersions = useCallback(
    async (nextChapterId: string) => {
      setVersions(await platform.contents.listChapterVersions(nextChapterId));
    },
    [platform],
  );

  useEffect(() => {
    if (!open) return;
    void refreshProjects().catch(captureError);
  }, [open, refreshProjects]);

  useEffect(() => {
    if (!open || !selectedProject) {
      setVolumes([]);
      setChapters([]);
      return;
    }
    void refreshContent(selectedProject.id).catch(captureError);
  }, [open, refreshContent, selectedProject]);

  useEffect(() => {
    if (!open || !selectedChapter) {
      setVersions([]);
      return;
    }
    void refreshVersions(selectedChapter.id).catch(captureError);
  }, [open, refreshVersions, selectedChapter]);

  function captureError(reason: unknown) {
    setError(reason instanceof Error ? reason.message : String(reason));
  }

  async function changed(preferredChapterId?: string) {
    if (!selectedProject) return;
    await refreshContent(selectedProject.id, preferredChapterId);
    if (preferredChapterId) await refreshVersions(preferredChapterId);
    onChanged();
  }

  async function createVolume() {
    if (!selectedProject) return;
    try {
      const volume = await platform.contents.createVolume({
        projectId: selectedProject.id,
        title: `第 ${volumes.length + 1} 卷`,
        summary: "",
      });
      setMessage(`已创建《${volume.title}》`);
      await changed();
    } catch (reason) {
      captureError(reason);
    }
  }

  async function createChapter() {
    if (!selectedProject) return;
    try {
      const volume = volumes[0];
      const chapter = await platform.contents.createChapter({
        projectId: selectedProject.id,
        title: `第 ${chapters.length + 1} 章`,
        status: "planned",
        ...(volume ? { volumeId: volume.id } : {}),
      });
      setMessage(`已创建《${chapter.title}》`);
      await changed(chapter.id);
    } catch (reason) {
      captureError(reason);
    }
  }

  async function renameVolume(volume: Volume) {
    const title = globalThis.prompt("卷名称", volume.title)?.trim();
    if (!title || title === volume.title) return;
    try {
      await platform.contents.updateVolume({ id: volume.id, title });
      await changed();
    } catch (reason) {
      captureError(reason);
    }
  }

  async function moveVolume(volume: Volume, direction: MoveDirection) {
    const index = volumes.findIndex((item) => item.id === volume.id);
    const target = volumes[index + direction];
    if (index < 0 || !target) return;
    try {
      await platform.contents.updateVolume({ id: volume.id, order: target.order });
      await platform.contents.updateVolume({ id: target.id, order: volume.order });
      await changed();
    } catch (reason) {
      captureError(reason);
    }
  }

  async function deleteVolume(volume: Volume) {
    if (!globalThis.confirm(`删除卷《${volume.title}》？卷内章节不会删除。`)) return;
    try {
      await platform.contents.deleteVolume(volume.id);
      setUndoEntry({ kind: "volume", id: volume.id, label: volume.title });
      await changed();
    } catch (reason) {
      captureError(reason);
    }
  }

  async function renameChapter(chapter: Chapter) {
    const title = globalThis.prompt("章节名称", chapter.title)?.trim();
    if (!title || title === chapter.title) return;
    try {
      await platform.contents.updateChapter({ id: chapter.id, title });
      await changed(chapter.id);
    } catch (reason) {
      captureError(reason);
    }
  }

  async function moveChapter(chapter: Chapter, direction: MoveDirection) {
    const siblings = chapters
      .filter((item) => item.volumeId === chapter.volumeId)
      .sort((left, right) => left.order - right.order);
    const index = siblings.findIndex((item) => item.id === chapter.id);
    const target = siblings[index + direction];
    if (index < 0 || !target) return;
    try {
      await platform.contents.updateChapter({ id: chapter.id, order: target.order });
      await platform.contents.updateChapter({ id: target.id, order: chapter.order });
      await changed(chapter.id);
    } catch (reason) {
      captureError(reason);
    }
  }

  async function deleteChapter(chapter: Chapter) {
    if (!globalThis.confirm(`删除章节《${chapter.title}》？正文与版本会保留。`)) return;
    try {
      await platform.contents.deleteChapter(chapter.id);
      setUndoEntry({ kind: "chapter", id: chapter.id, label: chapter.title });
      await changed();
    } catch (reason) {
      captureError(reason);
    }
  }

  async function undoDelete() {
    if (!undoEntry) return;
    try {
      if (undoEntry.kind === "volume") {
        await platform.contents.restoreVolume(undoEntry.id);
        await changed();
      } else {
        const chapter = await platform.contents.restoreChapter(undoEntry.id);
        await changed(chapter.id);
      }
      setMessage(`已恢复《${undoEntry.label}》`);
      setUndoEntry(undefined);
    } catch (reason) {
      captureError(reason);
    }
  }

  async function restoreVersion(version: ChapterVersion) {
    if (!globalThis.confirm(`恢复版本 v${version.version}？恢复操作会生成新快照。`)) {
      return;
    }
    setRestoringVersionId(version.id);
    try {
      const chapter = await platform.contents.restoreChapterVersion(version.id);
      await changed(chapter.id);
      setMessage(`已恢复版本 v${version.version}`);
    } catch (reason) {
      captureError(reason);
    } finally {
      setRestoringVersionId(undefined);
    }
  }

  return (
    <>
      <button
        type="button"
        className="content-manager-launcher"
        onClick={() => setOpen(true)}
      >
        内容管理
      </button>

      {open ? (
        <div className="content-manager-backdrop" onMouseDown={() => setOpen(false)}>
          <section
            className="content-manager"
            role="dialog"
            aria-modal="true"
            aria-label="内容管理"
            onMouseDown={(event: { stopPropagation(): void }) => event.stopPropagation()}
          >
            <header className="content-manager__header">
              <div>
                <h2>内容与版本管理</h2>
                <p>重命名、排序、软删除、撤销和版本恢复</p>
              </div>
              <button type="button" onClick={() => setOpen(false)}>×</button>
            </header>

            {undoEntry ? (
              <div className="manager-undo">
                <span>已删除《{undoEntry.label}》</span>
                <button type="button" onClick={() => void undoDelete()}>撤销</button>
              </div>
            ) : null}
            {message ? <p className="manager-message">{message}</p> : null}
            {error ? <p className="error-text">{error}</p> : null}

            <div className="content-manager__body">
              <aside className="manager-projects">
                <h3>项目</h3>
                {projects.map((project) => (
                  <button
                    type="button"
                    className={project.id === selectedProject?.id ? "active" : ""}
                    key={project.id}
                    onClick={() => setProjectId(project.id)}
                  >
                    {project.title}
                  </button>
                ))}
              </aside>

              <div className="manager-structure">
                <StoryStructure
                  volumes={volumes}
                  chapters={chapters}
                  selectedChapterId={selectedChapter?.id}
                  onSelectChapter={setChapterId}
                  onCreateVolume={() => void createVolume()}
                  onCreateChapter={() => void createChapter()}
                  onRenameVolume={(volume) => void renameVolume(volume)}
                  onMoveVolume={(volume, direction) => void moveVolume(volume, direction)}
                  onDeleteVolume={(volume) => void deleteVolume(volume)}
                  onRenameChapter={(chapter) => void renameChapter(chapter)}
                  onMoveChapter={(chapter, direction) => void moveChapter(chapter, direction)}
                  onDeleteChapter={(chapter) => void deleteChapter(chapter)}
                />
              </div>

              <aside className="manager-versions">
                <h3>{selectedChapter?.title ?? "章节版本"}</h3>
                <VersionHistory
                  versions={versions}
                  currentText={selectedChapter?.plainText ?? ""}
                  restoringVersionId={restoringVersionId}
                  onRestore={(version) => void restoreVersion(version)}
                />
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
