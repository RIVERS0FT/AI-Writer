import {
  defaultWritingPipelineOptions,
  estimateTokenCount,
  inspectContextCapacity,
  type GenerationJob,
  type WritingPipelineOptions,
  type WritingStepType,
} from "@ai-writer/core";
import {
  buildChapterDraftPrompt,
  buildChapterPlanPrompt,
  buildContinuityReviewPrompt,
  buildTargetedRewritePrompt,
  type WritingPrompt,
} from "@ai-writer/prompts";
import type {
  GenerationStreamEvent,
  ProviderRuntimeRequest,
  ProviderRuntimeService,
  ProviderWritingMetadata,
} from "@ai-writer/providers";
import type {
  GenerationJobRepository,
  PlatformService,
} from "./index";

interface TrackedTask {
  projectId: string;
  chapterId?: string | undefined;
  taskType: GenerationJob["taskType"];
  instruction: string;
  options: WritingPipelineOptions;
}

interface ContextItem {
  text: string;
  priority: number;
  locked: boolean;
}

interface BuiltWritingContext {
  projectTitle: string;
  chapterTitle: string;
  currentText: string;
  text: string;
  estimatedTokens: number;
  omittedItems: number;
  capacityExceeded: boolean;
}

interface ReviewReport {
  passed?: boolean;
  score?: number;
  issues?: Array<{ severity?: string; description?: string }>;
  rewriteInstruction?: string;
}

const stepOrder: Record<WritingStepType, number> = {
  context_build: 0,
  chapter_plan: 10,
  scene_plan: 20,
  draft: 30,
  continuity_review: 40,
  character_review: 50,
  style_review: 60,
  targeted_rewrite: 70,
  polish: 80,
  memory_extraction: 90,
  save: 100,
};

export function createWritingOrchestratorPlatform(
  platform: PlatformService,
): PlatformService {
  const trackedTasks = new Map<string, TrackedTask>();

  const generationJobs: GenerationJobRepository = {
    ...platform.generationJobs,
    async create(input) {
      const job = await platform.generationJobs.create(input);
      trackedTasks.set(job.id, {
        projectId: job.projectId,
        ...(job.chapterId ? { chapterId: job.chapterId } : {}),
        taskType: job.taskType,
        instruction: job.instruction,
        options: job.options,
      });
      return job;
    },
  };

  const providerRuntime: ProviderRuntimeService = {
    testConnection(provider) {
      return platform.providerRuntime.testConnection(provider);
    },

    async generate(request, onEvent) {
      const tracked = trackedTasks.get(request.taskId);
      if (!tracked) {
        return platform.providerRuntime.generate(request, onEvent);
      }

      onEvent({ event: "started", data: { taskId: request.taskId } });
      try {
        const context = await buildContext(platform, tracked, request);
        const instruction =
          tracked.instruction.trim() || "自然续写当前章节，保持前后文连贯。";
        const promptInput = {
          projectTitle: context.projectTitle,
          chapterTitle: context.chapterTitle,
          instruction,
          currentText: context.currentText,
          context: context.text,
          targetWords: 500,
        };

        let plan = fallbackPlan(instruction);
        if (tracked.options.enablePlanning) {
          await platform.generationJobs.update(request.taskId, {
            status: "planning",
            progress: 0.25,
          });
          const prompt = buildChapterPlanPrompt(promptInput);
          plan = await runModelStep(platform, request, tracked, prompt, "chapter_plan");
        }

        await platform.generationJobs.update(request.taskId, {
          status: "generating",
          progress: 0.45,
        });
        const draftPrompt = buildChapterDraftPrompt({ ...promptInput, plan });
        let finalText = await runModelStep(
          platform,
          request,
          tracked,
          draftPrompt,
          "draft",
        );

        const shouldReview =
          tracked.options.enableContinuityReview ||
          tracked.options.enableCharacterReview ||
          tracked.options.enableStyleReview;
        let reviewText = "";
        if (shouldReview) {
          await platform.generationJobs.update(request.taskId, {
            status: "reviewing",
            progress: 0.7,
          });
          const reviewPrompt = buildContinuityReviewPrompt({
            ...promptInput,
            plan,
            draft: finalText,
          });
          reviewText = await runModelStep(
            platform,
            request,
            tracked,
            reviewPrompt,
            "continuity_review",
          );
        }

        const review = parseReviewReport(reviewText);
        if (
          tracked.options.enableTargetedRewrite &&
          reviewText &&
          needsRewrite(review)
        ) {
          await platform.generationJobs.update(request.taskId, {
            status: "rewriting",
            progress: 0.82,
          });
          const rewritePrompt = buildTargetedRewritePrompt({
            ...promptInput,
            plan,
            draft: finalText,
            review: reviewText,
          });
          finalText = await runModelStep(
            platform,
            request,
            tracked,
            rewritePrompt,
            "targeted_rewrite",
          );
        } else if (tracked.options.enableTargetedRewrite) {
          await createSkippedStep(
            platform,
            request.taskId,
            "targeted_rewrite",
            reviewText ? "审查未发现需要定向修订的问题" : "未生成可解析的审查报告",
          );
        }

        await platform.generationJobs.update(request.taskId, {
          status: "saving",
          progress: 0.92,
        });
        onEvent({
          event: "chunk",
          data: { taskId: request.taskId, text: finalText.trim() },
        });

        const summary = await platform.usage
          .summarizeTask(request.taskId)
          .catch(() => undefined);
        const finished: Extract<
          GenerationStreamEvent,
          { event: "finished" }
        >["data"] = { taskId: request.taskId };
        if (
          summary &&
          summary.providerRequestCount + summary.estimatedRequestCount > 0
        ) {
          finished.inputTokens = summary.knownInputTokens;
          finished.outputTokens = summary.knownOutputTokens;
          finished.usage = {
            inputTokens: summary.knownInputTokens,
            outputTokens: summary.knownOutputTokens,
            totalTokens: summary.knownTotalTokens,
          };
        }
        onEvent({ event: "finished", data: finished });
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        onEvent({
          event: "error",
          data: { taskId: request.taskId, message },
        });
        throw reason;
      } finally {
        trackedTasks.delete(request.taskId);
      }
    },

    cancel(taskId) {
      return platform.providerRuntime.cancel(taskId);
    },
  };

  return {
    ...platform,
    generationJobs,
    providerRuntime,
  };
}

async function buildContext(
  platform: PlatformService,
  task: TrackedTask,
  request: ProviderRuntimeRequest,
): Promise<BuiltWritingContext> {
  await platform.generationJobs.update(request.taskId, {
    status: "building_context",
    progress: 0.1,
    startedAt: new Date().toISOString(),
  });
  const step = await ensureLocalStep(platform, request.taskId, "context_build");
  await platform.writing.updateStep(step.id, {
    status: "running",
    attemptCount: 1,
    startedAt: new Date().toISOString(),
  });

  try {
    const [projects, chapter, chapters, characters, worldEntries, outlineNodes] =
      await Promise.all([
        platform.projects.list(),
        task.chapterId
          ? platform.contents.getChapter(task.chapterId)
          : Promise.resolve(undefined),
        platform.contents.listChapters(task.projectId),
        platform.knowledge?.listCharacters(task.projectId) ?? Promise.resolve([]),
        platform.knowledge?.listWorldEntries(task.projectId) ?? Promise.resolve([]),
        platform.knowledge?.listOutlineNodes(task.projectId) ?? Promise.resolve([]),
      ]);

    const project = projects.find((item) => item.id === task.projectId);
    const currentText = chapter?.plainText ?? "";
    const items: ContextItem[] = [];

    if (project?.summary.trim()) {
      items.push({
        text: `[项目简介]\n${project.summary.trim()}`,
        priority: 100,
        locked: true,
      });
    }

    for (const item of characters) {
      items.push({
        text: [
          `[人物] ${item.name}${item.aliases.length ? `（${item.aliases.join("、")}）` : ""}`,
          item.profile,
          item.motivation ? `核心动机：${item.motivation}` : "",
          item.currentState ? `当前状态：${item.currentState}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        priority: item.isLocked ? 95 : 70,
        locked: item.isLocked,
      });
    }

    for (const item of worldEntries) {
      items.push({
        text: `[世界观/${item.entryType}] ${item.title}\n${item.content}`,
        priority: item.isLocked ? 95 : 65,
        locked: item.isLocked,
      });
    }

    for (const item of outlineNodes) {
      items.push({
        text: `[大纲/${item.nodeType}] ${item.title}\n${item.content}`,
        priority: item.isLocked ? 98 : item.nodeType === "chapter" ? 85 : 75,
        locked: item.isLocked,
      });
    }

    const recent = chapters
      .filter((item) => item.id !== task.chapterId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 5);
    for (const item of recent) {
      const summary = item.summary?.trim() || item.plainText.trim().slice(-1_200);
      if (!summary) continue;
      items.push({
        text: `[近期章节] ${item.title}\n${summary}`,
        priority: 45,
        locked: false,
      });
    }

    const requestedOutputTokens = request.profile.maxOutputTokens ?? 2_000;
    const fitted = fitContext(
      items,
      request.profile.contextWindow,
      requestedOutputTokens,
    );
    const result: BuiltWritingContext = {
      projectTitle: project?.title ?? "未命名小说",
      chapterTitle: chapter?.title ?? "当前章节",
      currentText,
      text: fitted.text,
      estimatedTokens: fitted.estimatedTokens,
      omittedItems: fitted.omittedItems,
      capacityExceeded: fitted.capacityExceeded,
    };

    await platform.writing.updateStep(step.id, {
      status: "completed",
      output: result,
      completedAt: new Date().toISOString(),
    });
    return result;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    await platform.writing
      .updateStep(step.id, {
        status: "failed",
        errorMessage: message,
        completedAt: new Date().toISOString(),
      })
      .catch(() => undefined);
    throw reason;
  }
}

function fitContext(
  items: ContextItem[],
  modelContextWindow: number | undefined,
  requestedOutputTokens: number,
): {
  text: string;
  estimatedTokens: number;
  omittedItems: number;
  capacityExceeded: boolean;
} {
  const sorted = [...items].sort((left, right) => {
    if (left.locked !== right.locked) return left.locked ? -1 : 1;
    return right.priority - left.priority;
  });
  const allText = sorted.map((item) => item.text).join("\n\n");
  const allTokens = estimateTokenCount(allText);
  const report = inspectContextCapacity({
    ...(modelContextWindow !== undefined ? { modelContextWindow } : {}),
    estimatedInputTokens: allTokens,
    requestedOutputTokens,
  });
  if (!report.exceeded || modelContextWindow === undefined) {
    return {
      text: allText,
      estimatedTokens: allTokens,
      omittedItems: 0,
      capacityExceeded: false,
    };
  }

  const available = Math.max(0, modelContextWindow - requestedOutputTokens);
  const selected: string[] = [];
  let used = 0;
  let omittedItems = 0;
  for (const item of sorted) {
    const tokens = estimateTokenCount(item.text);
    if (item.locked || used + tokens <= available) {
      selected.push(item.text);
      used += tokens;
    } else {
      omittedItems += 1;
    }
  }

  return {
    text: selected.join("\n\n"),
    estimatedTokens: used,
    omittedItems,
    capacityExceeded: true,
  };
}

async function runModelStep(
  platform: PlatformService,
  request: ProviderRuntimeRequest,
  task: TrackedTask,
  prompt: WritingPrompt,
  stepType: WritingStepType,
): Promise<string> {
  const step = await ensureProviderStep(
    platform,
    request.taskId,
    stepType,
    prompt,
  );
  let text = "";
  await platform.providerRuntime.generate(
    {
      ...request,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      writing: {
        projectId: task.projectId,
        ...(task.chapterId ? { chapterId: task.chapterId } : {}),
        taskType: task.taskType,
        stepId: step.id,
        stepType,
        promptId: prompt.id,
        promptVersion: prompt.version,
      },
    },
    (event) => {
      if (event.event === "chunk") text += event.data.text;
    },
  );
  const output = text.trim();
  await platform.writing
    .updateStep(step.id, { output: { text: output } })
    .catch(() => undefined);
  if (!output) throw new Error(`${prompt.id} 未返回有效内容`);
  return output;
}

async function ensureProviderStep(
  platform: PlatformService,
  jobId: string,
  stepType: WritingStepType,
  prompt: WritingPrompt,
) {
  const existing = (await platform.writing.listSteps(jobId)).find(
    (step) => step.stepType === stepType,
  );
  if (existing) return existing;
  return platform.writing.createStep({
    id: crypto.randomUUID(),
    jobId,
    stepType,
    order: stepOrder[stepType],
    status: "queued",
    promptId: prompt.id,
    promptVersion: prompt.version,
    input: {
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
    },
  });
}

async function ensureLocalStep(
  platform: PlatformService,
  jobId: string,
  stepType: WritingStepType,
) {
  const existing = (await platform.writing.listSteps(jobId)).find(
    (step) => step.stepType === stepType,
  );
  if (existing) return existing;
  return platform.writing.createStep({
    id: crypto.randomUUID(),
    jobId,
    stepType,
    order: stepOrder[stepType],
    status: "queued",
  });
}

async function createSkippedStep(
  platform: PlatformService,
  jobId: string,
  stepType: WritingStepType,
  reason: string,
): Promise<void> {
  const step = await ensureLocalStep(platform, jobId, stepType);
  await platform.writing.updateStep(step.id, {
    status: "skipped",
    output: { reason },
    completedAt: new Date().toISOString(),
  });
}

function fallbackPlan(instruction: string): string {
  return JSON.stringify({
    chapterGoal: instruction,
    scenes: [
      {
        order: 1,
        goal: "承接当前正文并推进主要冲突",
        conflict: "延续当前矛盾",
        turningPoint: "出现推动后续剧情的新变化",
        outcome: "为下一场景留下明确推进点",
      },
    ],
    requiredFacts: [],
    forbiddenFacts: [],
  });
}

function parseReviewReport(text: string): ReviewReport | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1)) as ReviewReport;
  } catch {
    return undefined;
  }
}

function needsRewrite(report: ReviewReport | undefined): boolean {
  if (!report) return false;
  if (report.passed === false) return true;
  if (report.score !== undefined && report.score < 80) return true;
  return Boolean(
    report.issues?.some(
      (issue) => issue.severity === "medium" || issue.severity === "high",
    ),
  );
}
