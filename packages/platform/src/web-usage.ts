import {
  summarizeTokenUsage,
  type TokenUsageRecord,
  type UsageSummary,
} from "@ai-writer/core";
import { recordTokenUsageInputSchema } from "@ai-writer/schemas";
import type { UsageRepository } from "./index";

const storageKey = "ai-writer.token-usage.v1";

function readRecords(): TokenUsageRecord[] {
  const raw = globalThis.localStorage?.getItem(storageKey);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as TokenUsageRecord[]) : [];
  } catch {
    return [];
  }
}

function writeRecords(records: TokenUsageRecord[]): void {
  globalThis.localStorage?.setItem(storageKey, JSON.stringify(records));
}

function summarize(
  records: TokenUsageRecord[],
  predicate: (record: TokenUsageRecord) => boolean,
): UsageSummary {
  return summarizeTokenUsage(records.filter(predicate));
}

export function createWebUsageRepository(): UsageRepository {
  return {
    async recordRequest(input) {
      const parsed = recordTokenUsageInputSchema.parse(input);
      const record: TokenUsageRecord = { ...parsed };
      const records = readRecords();
      writeRecords([
        record,
        ...records.filter((item) => item.id !== record.id),
      ]);
      return record;
    },

    async listForJob(jobId) {
      return readRecords()
        .filter((record) => record.jobId === jobId)
        .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
    },

    async summarizeTask(jobId) {
      return summarize(readRecords(), (record) => record.jobId === jobId);
    },

    async summarizeChapter(chapterId) {
      return summarize(
        readRecords(),
        (record) => record.chapterId === chapterId,
      );
    },

    async summarizeProject(projectId) {
      return summarize(
        readRecords(),
        (record) => record.projectId === projectId,
      );
    },

    async summarizeModel(modelProfileId) {
      return summarize(
        readRecords(),
        (record) => record.modelProfileId === modelProfileId,
      );
    },
  };
}
