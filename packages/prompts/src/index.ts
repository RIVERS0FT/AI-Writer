export interface ChapterPromptInput {
  chapterTitle: string;
  chapterGoal: string;
  outline: string;
  memoryContext: string;
  styleRules: string[];
}

export function buildChapterPrompt(input: ChapterPromptInput): string {
  const styles = input.styleRules.map((rule) => `- ${rule}`).join("\n");

  return [
    `[章节] ${input.chapterTitle}`,
    "",
    "[章节目标]",
    input.chapterGoal,
    "",
    "[章节规划]",
    input.outline,
    "",
    "[相关记忆]",
    input.memoryContext || "无额外记忆。",
    "",
    "[写作规则]",
    styles || "- 保持剧情连贯。",
    "",
    "请只输出章节正文，不要解释生成过程。",
  ].join("\n");
}
