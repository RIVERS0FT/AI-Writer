import type {
  PlatformService,
  ProviderRuntimeService,
} from "@ai-writer/platform";
import type { GenerationStreamEvent } from "@ai-writer/providers";

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

      try {
        for (let attempt = 0; attempt <= maximumRetries; attempt += 1) {
          if (cancelledTasks.has(request.taskId)) {
            throw new Error("用户取消生成");
          }

          let emittedChunk = false;
          let pendingError: Extract<
            GenerationStreamEvent,
            { event: "error" }
          > | undefined;

          try {
            await platform.providerRuntime.generate(request, (event) => {
              if (event.event === "started") {
                if (!startedForwarded) {
                  startedForwarded = true;
                  onEvent(event);
                }
                return;
              }
              if (event.event === "chunk") emittedChunk = true;
              if (event.event === "error") {
                pendingError = event;
                return;
              }
              onEvent(event);
            });
            return;
          } catch (reason) {
            const canRetry =
              attempt < maximumRetries &&
              !emittedChunk &&
              !cancelledTasks.has(request.taskId);
            if (!canRetry) {
              if (pendingError) onEvent(pendingError);
              throw reason;
            }

            const retryCount = attempt + 1;
            const delayMs = Math.min(400 * 2 ** attempt, 4_000);
            await platform.generationJobs.update(request.taskId, {
              status: "queued",
              progress: 0.1,
              retryCount,
              errorCode: "retry_scheduled",
              errorMessage: `第 ${attempt + 1} 次请求失败，${delayMs}ms 后重试`,
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

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}
