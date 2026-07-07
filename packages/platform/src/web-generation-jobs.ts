import type {
  GenerationJob,
  GenerationOutput,
  GenerationStatus,
} from "@ai-writer/core";
import {
  createGenerationJobInputSchema,
  updateGenerationJobInputSchema,
} from "@ai-writer/schemas";
import type { GenerationJobRepository } from "./index";

const jobsStorageKey = "ai-writer.generation-jobs.v1";
const outputsStorageKey = "ai-writer.generation-outputs.v1";

const interruptedStatuses = new Set<GenerationStatus>([
  "queued",
  "building_context",
  "planning",
  "generating",
  "reviewing",
  "rewriting",
  "saving",
]);

function readJsonArray<T>(key: string): T[] {
  const raw = globalThis.localStorage?.getItem(key);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(key: string, values: T[]): void {
  globalThis.localStorage?.setItem(key, JSON.stringify(values));
}

export function createWebGenerationJobRepository(): GenerationJobRepository {
  return {
    async listRecent(projectId, limit = 20) {
      return readJsonArray<GenerationJob>(jobsStorageKey)
        .filter((job) => job.projectId === projectId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, limit);
    },

    async create(input) {
      const parsed = createGenerationJobInputSchema.parse(input);
      const now = new Date().toISOString();
      const job: GenerationJob = {
        id: parsed.id,
        projectId: parsed.projectId,
        taskType: parsed.taskType,
        status: "queued",
        progress: 0,
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
        ...(parsed.chapterId ? { chapterId: parsed.chapterId } : {}),
        ...(parsed.providerConfigId
          ? { providerConfigId: parsed.providerConfigId }
          : {}),
        ...(parsed.modelProfileId
          ? { modelProfileId: parsed.modelProfileId }
          : {}),
      };
      const jobs = readJsonArray<GenerationJob>(jobsStorageKey);
      writeJsonArray(jobsStorageKey, [
        job,
        ...jobs.filter((item) => item.id !== job.id),
      ]);
      return job;
    },

    async update(id, input) {
      const parsed = updateGenerationJobInputSchema.parse(input);
      const jobs = readJsonArray<GenerationJob>(jobsStorageKey);
      const current = jobs.find((job) => job.id === id);
      if (!current) throw new Error("生成任务不存在");

      const updated: GenerationJob = {
        ...current,
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.progress !== undefined ? { progress: parsed.progress } : {}),
        ...(parsed.inputTokens !== undefined
          ? { inputTokens: parsed.inputTokens }
          : {}),
        ...(parsed.outputTokens !== undefined
          ? { outputTokens: parsed.outputTokens }
          : {}),
        ...(parsed.retryCount !== undefined
          ? { retryCount: parsed.retryCount }
          : {}),
        updatedAt: new Date().toISOString(),
      };

      if (parsed.errorCode === null) delete updated.errorCode;
      else if (parsed.errorCode !== undefined) updated.errorCode = parsed.errorCode;
      if (parsed.errorMessage === null) delete updated.errorMessage;
      else if (parsed.errorMessage !== undefined) {
        updated.errorMessage = parsed.errorMessage;
      }

      writeJsonArray(
        jobsStorageKey,
        jobs.map((job) => (job.id === id ? updated : job)),
      );
      return updated;
    },

    async replaceOutput(jobId, content) {
      const outputs = readJsonArray<GenerationOutput>(outputsStorageKey);
      const output: GenerationOutput = {
        id: crypto.randomUUID(),
        jobId,
        outputType: "draft",
        content,
        createdAt: new Date().toISOString(),
      };
      writeJsonArray(outputsStorageKey, [
        output,
        ...outputs.filter((item) => item.jobId !== jobId),
      ]);
      return output;
    },

    async getOutput(jobId) {
      return readJsonArray<GenerationOutput>(outputsStorageKey)
        .filter((output) => output.jobId === jobId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    },

    async markInterrupted(projectId) {
      const jobs = readJsonArray<GenerationJob>(jobsStorageKey);
      let changed = 0;
      const now = new Date().toISOString();
      const next = jobs.map((job) => {
        if (job.projectId !== projectId || !interruptedStatuses.has(job.status)) {
          return job;
        }
        changed += 1;
        return {
          ...job,
          status: "failed" as const,
          progress: 1,
          errorCode: "app_restarted",
          errorMessage: "应用关闭时任务仍在运行，已保留现有输出。",
          updatedAt: now,
        };
      });
      if (changed > 0) writeJsonArray(jobsStorageKey, next);
      return changed;
    },
  };
}
