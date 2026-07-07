import {
  defaultWritingPipelineOptions,
  type GenerationJob,
  type GenerationOutput,
  type GenerationStatus,
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

type StoredGenerationJob = Partial<GenerationJob> &
  Pick<
    GenerationJob,
    | "id"
    | "projectId"
    | "taskType"
    | "status"
    | "progress"
    | "retryCount"
    | "createdAt"
    | "updatedAt"
  >;

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

function readJobs(): GenerationJob[] {
  const stored = readJsonArray<StoredGenerationJob>(jobsStorageKey);
  let migrated = false;
  const jobs = stored.map((job) => {
    if (
      job.instruction === undefined ||
      job.pipelineVersion === undefined ||
      job.promptSetVersion === undefined ||
      job.options === undefined
    ) {
      migrated = true;
    }
    return {
      ...job,
      instruction: job.instruction ?? "",
      pipelineVersion: job.pipelineVersion ?? "1",
      promptSetVersion: job.promptSetVersion ?? "1",
      options: job.options ?? defaultWritingPipelineOptions,
    } as GenerationJob;
  });
  if (migrated) writeJsonArray(jobsStorageKey, jobs);
  return jobs;
}

export function createWebGenerationJobRepository(): GenerationJobRepository {
  return {
    async listRecent(projectId, limit = 20) {
      return readJobs()
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
        instruction: parsed.instruction,
        pipelineVersion: parsed.pipelineVersion,
        promptSetVersion: parsed.promptSetVersion,
        options: parsed.options,
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
      const jobs = readJobs();
      writeJsonArray(jobsStorageKey, [
        job,
        ...jobs.filter((item) => item.id !== job.id),
      ]);
      return job;
    },

    async update(id, input) {
      const parsed = updateGenerationJobInputSchema.parse(input);
      const jobs = readJobs();
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

      setNullable(updated, "startedAt", parsed.startedAt);
      setNullable(updated, "completedAt", parsed.completedAt);
      setNullable(updated, "errorCode", parsed.errorCode);
      setNullable(updated, "errorMessage", parsed.errorMessage);

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
      const jobs = readJobs();
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
          completedAt: now,
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

function setNullable<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | null | undefined,
): void {
  if (value === null) delete (target as Partial<T>)[key];
  else if (value !== undefined) target[key] = value;
}
