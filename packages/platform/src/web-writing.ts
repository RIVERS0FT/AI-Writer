import type { WritingStep } from "@ai-writer/core";
import {
  createWritingStepInputSchema,
  updateWritingStepInputSchema,
} from "@ai-writer/schemas";
import type { WritingRepository } from "./index";

const storageKey = "ai-writer.writing-steps.v1";

function readSteps(): WritingStep[] {
  const raw = globalThis.localStorage?.getItem(storageKey);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as WritingStep[]) : [];
  } catch {
    return [];
  }
}

function writeSteps(steps: WritingStep[]): void {
  globalThis.localStorage?.setItem(storageKey, JSON.stringify(steps));
}

export function createWebWritingRepository(): WritingRepository {
  return {
    async listSteps(jobId) {
      return readSteps()
        .filter((step) => step.jobId === jobId)
        .sort((left, right) => left.order - right.order);
    },

    async createStep(input) {
      const parsed = createWritingStepInputSchema.parse(input);
      const step: WritingStep = {
        id: parsed.id,
        jobId: parsed.jobId,
        stepType: parsed.stepType,
        order: parsed.order,
        status: parsed.status,
        attemptCount: 0,
        ...(parsed.promptId ? { promptId: parsed.promptId } : {}),
        ...(parsed.promptVersion
          ? { promptVersion: parsed.promptVersion }
          : {}),
        ...(parsed.contextSnapshotId
          ? { contextSnapshotId: parsed.contextSnapshotId }
          : {}),
        ...(parsed.input !== undefined ? { input: parsed.input } : {}),
      };
      const steps = readSteps();
      writeSteps([step, ...steps.filter((item) => item.id !== step.id)]);
      return step;
    },

    async updateStep(id, input) {
      const parsed = updateWritingStepInputSchema.parse(input);
      const steps = readSteps();
      const current = steps.find((step) => step.id === id);
      if (!current) throw new Error("写作步骤不存在");

      const updated: WritingStep = {
        ...current,
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.attemptCount !== undefined
          ? { attemptCount: parsed.attemptCount }
          : {}),
      };
      setNullable(updated, "promptId", parsed.promptId);
      setNullable(updated, "promptVersion", parsed.promptVersion);
      setNullable(updated, "inputTokens", parsed.inputTokens);
      setNullable(updated, "outputTokens", parsed.outputTokens);
      setNullable(updated, "totalTokens", parsed.totalTokens);
      setNullable(updated, "usageSource", parsed.usageSource);
      setNullable(updated, "latencyMs", parsed.latencyMs);
      setNullable(updated, "contextSnapshotId", parsed.contextSnapshotId);
      setNullable(updated, "startedAt", parsed.startedAt);
      setNullable(updated, "completedAt", parsed.completedAt);
      setNullable(updated, "errorMessage", parsed.errorMessage);
      if (parsed.input !== undefined) updated.input = parsed.input;
      if (parsed.output !== undefined) updated.output = parsed.output;

      writeSteps(steps.map((step) => (step.id === id ? updated : step)));
      return updated;
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
