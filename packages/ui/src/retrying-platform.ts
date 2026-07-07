import type {
  GenerationJobRepository,
  PlatformService,
  ProviderRuntimeService,
} from "@ai-writer/platform";
import type {
  GenerationStreamEvent,
  ProviderRuntimeRequest,
  ProviderUsage,
  ProviderWritingMetadata,
  ProviderWritingStepType,
} from "@ai-writer/providers";

const stepOrder: Record<ProviderWritingStepType, number> = {
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

export function createRetryingPlatform(
  platform: PlatformService,
): PlatformService {
  const cancelledTasks = new Set<string>();
  const taskMetadata = new Map<string, ProviderWritingMetadata>();

  const generationJobs: GenerationJobRepository = {
    ...platform.generationJobs,
    async create(input) {
      const job = await platform.generationJobs.create(input);
      taskMetadata.set(job.id, {
        projectId: job.projectId,
        ...(job.chapterId ? { chapterId: job.chapterId } : {}),
        taskType: job.taskType,
        stepType: "draft",
        promptId: "chapter-continuation",
        promptVersion: "1",
      });
      return job;
    },
  };

  const providerRuntime: ProviderRuntimeService = {
    testConnection(provider) {
      return platform.providerRuntime.testConnection(provider);
    },

    async generate(request, onEvent) {
      const writing = request.writing ?? taskMetadata.get(request.taskId);
      const trackedRequest: ProviderRuntimeRequest = writing
        ? { ...request, writing }
        : request;
      const maximumRetries = request.profile.maxRetries;
      let startedForwarded = false;
      const step = writing
        ? await ensureWritingStep(platform, request.taskId, writing, {
            systemPrompt: request.systemPrompt,
            userPrompt: request.userPrompt,
          })
        : undefined;
      const stepStartedAt = new Date().toISOString();
      let totalLatencyMs = 0;

      if (step) {
        await platform.writing
          .updateStep(step.id, {
            status: "running",
            startedAt: stepStartedAt,
            attemptCount: 0,
            errorMessage: null,
          })
          .catch(() => undefined);
      }

      try {
        for (let attemptIndex = 0; attemptIndex <= maximumRetries; attemptIndex += 1) {
          if (cancelledTasks.has(request.taskId)) {
            throw new Error("用户取消生成");
          }

          const attempt = attemptIndex + 1;
          const requestId = crypto.randomUUID();
          const requestStartedAt = new Date().toISOString();
          const startedMs = Date.now();
          let emittedChunk = false;
          let finishedData: Extract<
            GenerationStreamEvent,
            { event: "finished" }
          >["data"] | undefined;
          let pendingError: Extract<
            GenerationStreamEvent,
            { event: "error" }
          > | undefined;

          if (step) {
            await platform.writing
              .updateStep(step.id, {
                status: "running",
                attemptCount: attempt,
                errorMessage: null,
              })
              .catch(() => undefined);
          }

          try {
            await platform.providerRuntime.generate(trackedRequest, (event) => {
              if (event.event === "started") {
                if (!startedForwarded) {
                  startedForwarded = true;
                  onEvent(event);
                }
                return;
              }
              if (event.event === "chunk") {
                emittedChunk = true;
                onEvent(event);
                return;
              }
              if (event.event === "finished") {
                finishedData = event.data;
                return;
              }
              pendingError = event;
            });

            const latencyMs = Math.max(0, Date.now() - startedMs);
            totalLatencyMs += latencyMs;
            const usage = normalizeUsage(finishedData);
            await recordAttempt(platform, trackedRequest, step?.id, {
              id: requestId,
              attempt,
              status: "completed",
              usage,
              latencyMs,
              startedAt: requestStartedAt,
              completedAt: new Date().toISOString(),
            });

            const records = await platform.usage
              .listForJob(request.taskId)
              .catch(() => []);
            const stepRecords = step
              ? records.filter((record) => record.stepId === step.id)
              : [];
            const hasProviderUsage = stepRecords.some(
              (record) => record.source === "provider",
            );
            const hasEstimatedUsage = stepRecords.some(
              (record) => record.source === "estimated",
            );
            const inputTokens = stepRecords.reduce(
              (total, record) => total + (record.inputTokens ?? 0),
              0,
            );
            const outputTokens = stepRecords.reduce(
              (total, record) => total + (record.outputTokens ?? 0),
              0,
            );
            const totalTokens = stepRecords.reduce(
              (total, record) =>
                total +
                (record.totalTokens ??
                  (record.inputTokens !== undefined &&
                  record.outputTokens !== undefined
                    ? record.inputTokens + record.outputTokens
                    : 0)),
              0,
            );

            if (step) {
              await platform.writing
                .updateStep(step.id, {
                  status: "completed",
                  attemptCount: attempt,
                  ...(hasProviderUsage || hasEstimatedUsage
                    ? {
                        inputTokens,
                        outputTokens,
                        totalTokens,
                        usageSource: hasEstimatedUsage
                          ? "estimated"
                          : "provider",
                      }
                    : { usageSource: "unknown" }),
                  latencyMs: totalLatencyMs,
                  completedAt: new Date().toISOString(),
                  errorMessage: null,
                })
                .catch(() => undefined);
            }

            const summary = await platform.usage
              .summarizeTask(request.taskId)
              .catch(() => undefined);
            const data: Extract<
              GenerationStreamEvent,
              { event: "finished" }
            >["data"] = { taskId: request.taskId };
            if (
              summary &&
              summary.providerRequestCount + summary.estimatedRequestCount > 0
            ) {
              data.inputTokens = summary.knownInputTokens;
              data.outputTokens = summary.knownOutputTokens;
              data.usage = {
                inputTokens: summary.knownInputTokens,
                outputTokens: summary.knownOutputTokens,
                totalTokens: summary.knownTotalTokens,
              };
            }
            onEvent({ event: "finished", data });
            return;
          } catch (reason) {
            const cancelled = cancelledTasks.has(request.taskId);
            const latencyMs = Math.max(0, Date.now() - startedMs);
            totalLatencyMs += latencyMs;
            const message = reason instanceof Error ? reason.message : String(reason);
            await recordAttempt(platform, trackedRequest, step?.id, {
              id: requestId,
              attempt,
              status: cancelled ? "cancelled" : "failed",
              usage: { source: "unknown" },
              latencyMs,
              errorCode: cancelled ? "user_cancelled" : "generation_failed",
              errorMessage: message,
              startedAt: requestStartedAt,
              completedAt: new Date().toISOString(),
            });

            const canRetry =
              attemptIndex < maximumRetries && !emittedChunk && !cancelled;
            if (!canRetry) {
              if (step) {
                await platform.writing
                  .updateStep(step.id, {
                    status: cancelled ? "cancelled" : "failed",
                    attemptCount: attempt,
                    usageSource: "unknown",
                    latencyMs: totalLatencyMs,
                    completedAt: new Date().toISOString(),
                    errorMessage: message,
                  })
                  .catch(() => undefined);
              }
              if (pendingError) onEvent(pendingError);
              throw reason;
            }

            const retryCount = attempt;
            const delayMs = Math.min(400 * 2 ** attemptIndex, 4_000);
            await platform.generationJobs.update(request.taskId, {
              status: "queued",
              progress: 0.1,
              retryCount,
              errorCode: "retry_scheduled",
              errorMessage: `第 ${attempt} 次请求失败，${delayMs}ms 后重试`,
            });
            await sleep(delayMs);
            if (cancelledTasks.has(request.taskId)) {
              throw new Error("用户取消生成");
            }
            await platform.generationJobs.update(request.taskId, {
              status: generationStatusForStep(writing?.stepType),
              progress: Math.min(0.2 + retryCount * 0.1, 0.8),
              retryCount,
              errorCode: null,
              errorMessage: null,
            });
          }
        }
      } finally {
        cancelledTasks.delete(request.taskId);
        taskMetadata.delete(request.taskId);
      }
    },

    async cancel(taskId) {
      cancelledTasks.add(taskId);
      return platform.providerRuntime.cancel(taskId);
    },
  };

  return {
    ...platform,
    generationJobs,
    providerRuntime,
  };
}

async function ensureWritingStep(
  platform: PlatformService,
  jobId: string,
  writing: ProviderWritingMetadata,
  input: { systemPrompt: string; userPrompt: string },
) {
  const steps = await platform.writing.listSteps(jobId);
  const existing = writing.stepId
    ? steps.find((step) => step.id === writing.stepId)
    : steps.find((step) => step.stepType === writing.stepType);
  if (existing) return existing;
  return platform.writing.createStep({
    id: writing.stepId ?? crypto.randomUUID(),
    jobId,
    stepType: writing.stepType,
    order: stepOrder[writing.stepType],
    status: "queued",
    promptId: writing.promptId ?? writing.stepType,
    promptVersion: writing.promptVersion ?? "1",
    input,
  });
}

function generationStatusForStep(
  stepType: ProviderWritingStepType | undefined,
): "planning" | "generating" | "reviewing" | "rewriting" {
  if (stepType === "chapter_plan" || stepType === "scene_plan") {
    return "planning";
  }
  if (
    stepType === "continuity_review" ||
    stepType === "character_review" ||
    stepType === "style_review"
  ) {
    return "reviewing";
  }
  if (stepType === "targeted_rewrite" || stepType === "polish") {
    return "rewriting";
  }
  return "generating";
}

interface AttemptResult {
  id: string;
  attempt: number;
  status: "completed" | "failed" | "cancelled";
  usage: ProviderUsage & { source: "provider" | "estimated" | "unknown" };
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt: string;
}

async function recordAttempt(
  platform: PlatformService,
  request: ProviderRuntimeRequest,
  stepId: string | undefined,
  result: AttemptResult,
): Promise<void> {
  if (!request.writing || !stepId) return;
  await platform.usage
    .recordRequest({
      id: result.id,
      jobId: request.taskId,
      stepId,
      projectId: request.writing.projectId,
      ...(request.writing.chapterId
        ? { chapterId: request.writing.chapterId }
        : {}),
      providerConfigId: request.provider.id,
      modelProfileId: request.profile.id,
      model: request.profile.model,
      taskType: request.writing.taskType,
      stepType: request.writing.stepType,
      attempt: result.attempt,
      status: result.status,
      ...(result.usage.inputTokens !== undefined
        ? { inputTokens: result.usage.inputTokens }
        : {}),
      ...(result.usage.outputTokens !== undefined
        ? { outputTokens: result.usage.outputTokens }
        : {}),
      ...(result.usage.totalTokens !== undefined
        ? { totalTokens: result.usage.totalTokens }
        : {}),
      ...(result.usage.cachedInputTokens !== undefined
        ? { cachedInputTokens: result.usage.cachedInputTokens }
        : {}),
      ...(result.usage.reasoningTokens !== undefined
        ? { reasoningTokens: result.usage.reasoningTokens }
        : {}),
      source: result.usage.source,
      latencyMs: result.latencyMs,
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
      startedAt: result.startedAt,
      completedAt: result.completedAt,
    })
    .catch(() => undefined);
}

function normalizeUsage(
  data:
    | Extract<GenerationStreamEvent, { event: "finished" }>["data"]
    | undefined,
): ProviderUsage & { source: "provider" | "unknown" } {
  const inputTokens = data?.usage?.inputTokens ?? data?.inputTokens;
  const outputTokens = data?.usage?.outputTokens ?? data?.outputTokens;
  const totalTokens =
    data?.usage?.totalTokens ??
    (inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : undefined);
  const hasUsage =
    inputTokens !== undefined ||
    outputTokens !== undefined ||
    totalTokens !== undefined ||
    data?.usage?.cachedInputTokens !== undefined ||
    data?.usage?.reasoningTokens !== undefined;

  return {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(data?.usage?.cachedInputTokens !== undefined
      ? { cachedInputTokens: data.usage.cachedInputTokens }
      : {}),
    ...(data?.usage?.reasoningTokens !== undefined
      ? { reasoningTokens: data.usage.reasoningTokens }
      : {}),
    source: hasUsage ? "provider" : "unknown",
  };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}
