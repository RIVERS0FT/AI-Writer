import type {
  PlatformService,
  ProviderRuntimeService,
} from "@ai-writer/platform";
import type {
  GenerationStreamEvent,
  ProviderUsage,
} from "@ai-writer/providers";

export function createRetryingPlatform(
  platform: PlatformService,
): PlatformService {
  const cancelledTasks = new Set<string>();

  const providerRuntime: ProviderRuntimeService = {
    testConnection(provider) {
      return platform.providerRuntime.testConnection(provider);
    },

    async generate(request, onEvent) {
      const maximumRetries = request.profile.maxRetries;
      let startedForwarded = false;
      const step = request.writing
        ? await ensureDraftStep(platform, request.taskId, {
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
            await platform.providerRuntime.generate(request, (event) => {
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
            await recordAttempt(platform, request, step?.id, {
              id: requestId,
              attempt,
              status: "completed",
              usage,
              latencyMs,
              startedAt: requestStartedAt,
              completedAt: new Date().toISOString(),
            });

            const summary = await platform.usage
              .summarizeTask(request.taskId)
              .catch(() => undefined);
            if (step) {
              const hasKnownUsage =
                summary !== undefined &&
                summary.providerRequestCount + summary.estimatedRequestCount > 0;
              await platform.writing
                .updateStep(step.id, {
                  status: "completed",
                  attemptCount: attempt,
                  ...(hasKnownUsage
                    ? {
                        inputTokens: summary.knownInputTokens,
                        outputTokens: summary.knownOutputTokens,
                        totalTokens: summary.knownTotalTokens,
                        usageSource:
                          summary.estimatedRequestCount > 0
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
            await recordAttempt(platform, request, step?.id, {
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
              status: "generating",
              progress: Math.min(0.2 + retryCount * 0.1, 0.8),
              retryCount,
              errorCode: null,
              errorMessage: null,
            });
          }
        }
      } finally {
        cancelledTasks.delete(request.taskId);
      }
    },

    async cancel(taskId) {
      cancelledTasks.add(taskId);
      return platform.providerRuntime.cancel(taskId);
    },
  };

  return {
    ...platform,
    providerRuntime,
  };
}

async function ensureDraftStep(
  platform: PlatformService,
  jobId: string,
  input: { systemPrompt: string; userPrompt: string },
) {
  const existing = (await platform.writing.listSteps(jobId)).find(
    (step) => step.stepType === "draft",
  );
  if (existing) return existing;
  return platform.writing.createStep({
    id: crypto.randomUUID(),
    jobId,
    stepType: "draft",
    order: 0,
    status: "queued",
    promptId: "chapter-continuation",
    promptVersion: "1",
    input,
  });
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
  request: Parameters<ProviderRuntimeService["generate"]>[0],
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
      stepType: request.writing.stepType ?? "draft",
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
