export interface WritingPrompt {
  id: string;
  version: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface WritingContextInput {
  projectTitle: string;
  chapterTitle: string;
  instruction: string;
  currentText: string;
  context: string;
  targetWords?: number | undefined;
}

export interface DraftPromptInput extends WritingContextInput {
  plan: string;
}

export interface ReviewPromptInput extends WritingContextInput {
  plan: string;
  draft: string;
}

export interface RewritePromptInput extends ReviewPromptInput {
  review: string;
}

const plainTextRule =
  "只输出纯文本，不使用 Markdown、HTML、标题标记或对生成过程的解释。";

export function buildChapterPlanPrompt(
  input: WritingContextInput,
): WritingPrompt {
  return {
    id: "chapter-planner",
    version: "1",
    systemPrompt: [
      "你是长篇小说章节规划器。",
      "规划必须服从作者指令和锁定设定，保持人物知识边界、时间线与叙事视角一致。",
      "输出紧凑 JSON，不要使用代码块。",
    ].join("\n"),
    userPrompt: [
      `小说：${input.projectTitle}`,
      `章节：${input.chapterTitle}`,
      `作者要求：${input.instruction || "自然续写当前章节"}`,
      input.targetWords ? `目标正文长度：约 ${input.targetWords} 字` : "",
      "",
      "[项目上下文]",
      input.context || "暂无额外资料。",
      "",
      "[当前章节正文]",
      input.currentText || "当前章节为空。",
      "",
      "请输出以下 JSON：",
      '{"chapterGoal":"","openingState":"","endingState":"","conflict":"","emotionalArc":"","scenes":[{"order":1,"goal":"","conflict":"","turningPoint":"","outcome":""}],"requiredFacts":[],"forbiddenFacts":[]}',
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function buildChapterDraftPrompt(input: DraftPromptInput): WritingPrompt {
  return {
    id: "chapter-draft-writer",
    version: "1",
    systemPrompt: [
      "你是专业长篇小说作者。",
      "严格遵守作者要求、章节计划、人物知识边界与锁定设定。",
      "正文应自然承接已有内容，避免重复复述、总结式结尾和元叙事说明。",
      plainTextRule,
    ].join("\n"),
    userPrompt: [
      `小说：${input.projectTitle}`,
      `章节：${input.chapterTitle}`,
      `作者要求：${input.instruction || "自然续写当前章节"}`,
      input.targetWords ? `目标新增长度：约 ${input.targetWords} 字` : "",
      "",
      "[章节计划]",
      input.plan,
      "",
      "[项目上下文]",
      input.context || "暂无额外资料。",
      "",
      "[当前章节正文]",
      input.currentText || "当前章节为空。",
      "",
      "请续写正文。不要重复已有正文，只输出新增内容。",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function buildContinuityReviewPrompt(
  input: ReviewPromptInput,
): WritingPrompt {
  return {
    id: "continuity-reviewer",
    version: "1",
    systemPrompt: [
      "你是小说连续性与角色一致性审查器。",
      "检查时间线、地点、人物状态、人物知识边界、世界规则、情绪转折、重复和任务完成度。",
      "输出紧凑 JSON，不要使用代码块。",
    ].join("\n"),
    userPrompt: [
      `小说：${input.projectTitle}`,
      `章节：${input.chapterTitle}`,
      `作者要求：${input.instruction || "自然续写当前章节"}`,
      "",
      "[章节计划]",
      input.plan,
      "",
      "[项目上下文]",
      input.context || "暂无额外资料。",
      "",
      "[待审查新增正文]",
      input.draft,
      "",
      "请输出以下 JSON：",
      '{"passed":true,"score":100,"issues":[{"severity":"low|medium|high","description":"","evidence":"","suggestion":""}],"rewriteInstruction":""}',
    ].join("\n"),
  };
}

export function buildTargetedRewritePrompt(
  input: RewritePromptInput,
): WritingPrompt {
  return {
    id: "targeted-rewriter",
    version: "1",
    systemPrompt: [
      "你是小说定向修订编辑。",
      "只修复审查指出的问题，保留无问题内容、原有剧情信息和语言风格。",
      plainTextRule,
    ].join("\n"),
    userPrompt: [
      `小说：${input.projectTitle}`,
      `章节：${input.chapterTitle}`,
      `作者要求：${input.instruction || "自然续写当前章节"}`,
      "",
      "[章节计划]",
      input.plan,
      "",
      "[项目上下文]",
      input.context || "暂无额外资料。",
      "",
      "[原新增正文]",
      input.draft,
      "",
      "[审查报告]",
      input.review,
      "",
      "请输出修订后的完整新增正文。",
    ].join("\n"),
  };
}
