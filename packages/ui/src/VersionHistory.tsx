import { summarizeTextDiff, type ChapterVersion } from "@ai-writer/core";

export interface VersionHistoryProps {
  versions: ChapterVersion[];
  currentText: string;
  restoringVersionId?: string | undefined;
  onRestore(version: ChapterVersion): void;
}

export function VersionHistory({
  versions,
  currentText,
  restoringVersionId,
  onRestore,
}: VersionHistoryProps) {
  if (versions.length === 0) {
    return <p className="muted">尚未保存章节版本</p>;
  }

  return (
    <div className="version-list">
      {versions.map((version) => {
        const diff = summarizeTextDiff(version.plainText, currentText);
        return (
          <article className="version-item" key={version.id}>
            <div className="version-item__header">
              <strong>v{version.version}</strong>
              <time>{formatTime(version.createdAt)}</time>
            </div>
            <p>{version.changeReason ?? version.changeType}</p>
            <div className="version-diff">
              <span className="version-diff__added">+{diff.addedChars}</span>
              <span className="version-diff__removed">-{diff.removedChars}</span>
              <span>{diff.afterLength} 字符</span>
            </div>
            {diff.afterPreview ? (
              <p className="version-preview">当前新增：{diff.afterPreview}</p>
            ) : null}
            {diff.beforePreview ? (
              <p className="version-preview">版本内容：{diff.beforePreview}</p>
            ) : null}
            <button
              type="button"
              disabled={restoringVersionId === version.id}
              onClick={() => onRestore(version)}
            >
              {restoringVersionId === version.id ? "恢复中…" : "恢复此版本"}
            </button>
          </article>
        );
      })}
    </div>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
