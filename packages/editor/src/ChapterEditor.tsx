import { normalizeLegacyChapterText } from "@ai-writer/core";
import { useEffect } from "react";

export interface ChapterEditorProps {
  content: string;
  onChange?(content: string, plainText: string): void;
}

export function ChapterEditor({ content, onChange }: ChapterEditorProps) {
  const normalizedContent = normalizeLegacyChapterText(content);

  useEffect(() => {
    if (normalizedContent !== content) {
      onChange?.(normalizedContent, normalizedContent);
    }
  }, [content, normalizedContent, onChange]);

  return (
    <textarea
      className="chapter-editor__content"
      aria-label="章节正文"
      spellCheck
      value={normalizedContent}
      onChange={(event) => {
        const value = event.currentTarget.value;
        onChange?.(value, value);
      }}
    />
  );
}
