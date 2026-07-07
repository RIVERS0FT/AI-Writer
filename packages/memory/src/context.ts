import type { MemoryItem } from "./types";

export interface ContextSection {
  title: string;
  items: MemoryItem[];
}

export interface BuiltMemoryContext {
  text: string;
  selectedIds: string[];
  estimatedTokens: number;
}

function estimateTokens(text: string): number {
  const latinWords = text.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const nonLatin = text.replace(/[\x00-\x7F]/g, "").length;
  return Math.ceil(latinWords * 1.3 + nonLatin * 0.75);
}

export function buildMemoryContext(
  sections: ContextSection[],
): BuiltMemoryContext {
  const lines: string[] = [];
  const selectedIds: string[] = [];
  let estimatedTokens = 0;

  for (const section of sections) {
    const accepted: string[] = [];

    for (const item of section.items) {
      if (!item.isEnabled) continue;
      const line = `- ${item.title ? `${item.title}：` : ""}${item.content}`;
      accepted.push(line);
      selectedIds.push(item.id);
      estimatedTokens += estimateTokens(line);
    }

    if (accepted.length > 0) {
      const title = `[${section.title}]`;
      lines.push(title, ...accepted, "");
      estimatedTokens += estimateTokens(title);
    }
  }

  return {
    text: lines.join("\n").trim(),
    selectedIds,
    estimatedTokens,
  };
}
