import type { Chapter, Volume } from "@ai-writer/core";

export type MoveDirection = -1 | 1;

export interface StoryStructureProps {
  volumes: Volume[];
  chapters: Chapter[];
  selectedChapterId?: string | undefined;
  onSelectChapter(id: string): void;
  onCreateVolume(): void;
  onCreateChapter(): void;
  onRenameVolume(volume: Volume): void;
  onMoveVolume(volume: Volume, direction: MoveDirection): void;
  onDeleteVolume(volume: Volume): void;
  onRenameChapter(chapter: Chapter): void;
  onMoveChapter(chapter: Chapter, direction: MoveDirection): void;
  onDeleteChapter(chapter: Chapter): void;
}

export function StoryStructure({
  volumes,
  chapters,
  selectedChapterId,
  onSelectChapter,
  onCreateVolume,
  onCreateChapter,
  onRenameVolume,
  onMoveVolume,
  onDeleteVolume,
  onRenameChapter,
  onMoveChapter,
  onDeleteChapter,
}: StoryStructureProps) {
  const chaptersByVolume = new Map<string, Chapter[]>();
  for (const chapter of chapters) {
    const key = chapter.volumeId ?? "unassigned";
    const group = chaptersByVolume.get(key) ?? [];
    group.push(chapter);
    chaptersByVolume.set(key, group);
  }

  return (
    <section className="story-structure">
      <div className="story-structure__header">
        <span>卷与章节</span>
        <div>
          <button type="button" onClick={onCreateVolume}>
            + 卷
          </button>
          <button type="button" onClick={onCreateChapter}>
            + 章
          </button>
        </div>
      </div>

      {volumes.map((volume, volumeIndex) => (
        <div className="volume-node" key={volume.id}>
          <div className="structure-title-row">
            <strong title={volume.title}>{volume.title}</strong>
            <div className="structure-actions">
              <button
                type="button"
                title="上移卷"
                disabled={volumeIndex === 0}
                onClick={() => onMoveVolume(volume, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                title="下移卷"
                disabled={volumeIndex === volumes.length - 1}
                onClick={() => onMoveVolume(volume, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                title="重命名卷"
                onClick={() => onRenameVolume(volume)}
              >
                ✎
              </button>
              <button
                type="button"
                title="删除卷"
                onClick={() => onDeleteVolume(volume)}
              >
                ×
              </button>
            </div>
          </div>
          <ChapterGroup
            chapters={chaptersByVolume.get(volume.id) ?? []}
            selectedChapterId={selectedChapterId}
            onSelectChapter={onSelectChapter}
            onRenameChapter={onRenameChapter}
            onMoveChapter={onMoveChapter}
            onDeleteChapter={onDeleteChapter}
          />
        </div>
      ))}

      {(chaptersByVolume.get("unassigned") ?? []).length > 0 ? (
        <div className="volume-node">
          <div className="structure-title-row">
            <strong>未分卷</strong>
          </div>
          <ChapterGroup
            chapters={chaptersByVolume.get("unassigned") ?? []}
            selectedChapterId={selectedChapterId}
            onSelectChapter={onSelectChapter}
            onRenameChapter={onRenameChapter}
            onMoveChapter={onMoveChapter}
            onDeleteChapter={onDeleteChapter}
          />
        </div>
      ) : null}
    </section>
  );
}

interface ChapterGroupProps {
  chapters: Chapter[];
  selectedChapterId?: string | undefined;
  onSelectChapter(id: string): void;
  onRenameChapter(chapter: Chapter): void;
  onMoveChapter(chapter: Chapter, direction: MoveDirection): void;
  onDeleteChapter(chapter: Chapter): void;
}

function ChapterGroup({
  chapters,
  selectedChapterId,
  onSelectChapter,
  onRenameChapter,
  onMoveChapter,
  onDeleteChapter,
}: ChapterGroupProps) {
  return (
    <div className="chapter-list">
      {chapters.map((chapter, index) => (
        <div
          className={
            chapter.id === selectedChapterId
              ? "chapter-row active"
              : "chapter-row"
          }
          key={chapter.id}
        >
          <button
            type="button"
            className="chapter-select"
            onClick={() => onSelectChapter(chapter.id)}
          >
            <span title={chapter.title}>{chapter.title}</span>
            <small>{chapter.status}</small>
          </button>
          <div className="structure-actions chapter-actions">
            <button
              type="button"
              title="上移章节"
              disabled={index === 0}
              onClick={() => onMoveChapter(chapter, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              title="下移章节"
              disabled={index === chapters.length - 1}
              onClick={() => onMoveChapter(chapter, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              title="重命名章节"
              onClick={() => onRenameChapter(chapter)}
            >
              ✎
            </button>
            <button
              type="button"
              title="删除章节"
              onClick={() => onDeleteChapter(chapter)}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
