export interface TextDiffSummary {
  beforeLength: number;
  afterLength: number;
  removedChars: number;
  addedChars: number;
  changed: boolean;
  beforePreview: string;
  afterPreview: string;
}

export function summarizeTextDiff(before: string, after: string): TextDiffSummary {
  let prefix = 0;
  const prefixLimit = Math.min(before.length, after.length);
  while (prefix < prefixLimit && before[prefix] === after[prefix]) prefix += 1;

  let suffix = 0;
  const suffixLimit = Math.min(before.length - prefix, after.length - prefix);
  while (
    suffix < suffixLimit &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const removed = before.slice(prefix, before.length - suffix);
  const added = after.slice(prefix, after.length - suffix);

  return {
    beforeLength: before.length,
    afterLength: after.length,
    removedChars: removed.length,
    addedChars: added.length,
    changed: removed.length > 0 || added.length > 0,
    beforePreview: preview(removed),
    afterPreview: preview(added),
  };
}

function preview(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}…` : normalized;
}
