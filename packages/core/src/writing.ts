export type WritingTaskType =
  | "chapter_generation"
  | "chapter_continuation"
  | "scene_generation"
  | "rewrite"
  | "expand"
  | "shorten"
  | "consistency_fix";

export interface WritingPipelineOptions {
  enablePlanning: boolean;
  enableContinuityReview: boolean;
  enableCharacterReview: boolean;
  enableStyleReview: boolean;
  enableTargetedRewrite: boolean;
  enableMemoryExtraction: boolean;
}

export const defaultWritingPipelineOptions: WritingPipelineOptions = {
  enablePlanning: true,
  enableContinuityReview: true,
  enableCharacterReview: true,
  enableStyleReview: true,
  enableTargetedRewrite: true,
  enableMemoryExtraction: true,
};

export type WritingStepType =
  | "context_build"
  | "chapter_plan"
  | "scene_plan"
  | "draft"
  | "continuity_review"
  | "character_review"
  | "style_review"
  | "targeted_rewrite"
  | "polish"
  | "memory_extraction"
  | "save";

export type WritingStepStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped";

export interface WritingStep {
  id: string;
  jobId: string;
  stepType: WritingStepType;
  order: number;
  status: WritingStepStatus;
  attemptCount: number;
  promptId?: string | undefined;
  promptVersion?: string | undefined;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  totalTokens?: number | undefined;
  usageSource?: UsageSource | undefined;
  latencyMs?: number | undefined;
  contextSnapshotId?: string | undefined;
  input?: unknown;
  output?: unknown;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  errorMessage?: string | undefined;
}

export type UsageSource = "provider" | "estimated" | "unknown";
export type GenerationRequestStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface TokenUsageRecord {
  id: string;
  jobId: string;
  stepId: string;
  projectId: string;
  chapterId?: string | undefined;
  providerConfigId?: string | undefined;
  modelProfileId?: string | undefined;
  model: string;
  taskType: WritingTaskType;
  stepType: WritingStepType;
  attempt: number;
  status: GenerationRequestStatus;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  totalTokens?: number | undefined;
  cachedInputTokens?: number | undefined;
  reasoningTokens?: number | undefined;
  source: UsageSource;
  latencyMs?: number | undefined;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  startedAt: string;
  completedAt?: string | undefined;
}

export interface UsageSummary {
  requestCount: number;
  retryCount: number;
  knownInputTokens: number;
  knownOutputTokens: number;
  knownTotalTokens: number;
  unknownRequestCount: number;
  providerRequestCount: number;
  estimatedRequestCount: number;
}

export function summarizeTokenUsage(
  records: readonly TokenUsageRecord[],
): UsageSummary {
  let knownInputTokens = 0;
  let knownOutputTokens = 0;
  let knownTotalTokens = 0;
  let unknownRequestCount = 0;
  let providerRequestCount = 0;
  let estimatedRequestCount = 0;

  for (const record of records) {
    if (record.inputTokens !== undefined) knownInputTokens += record.inputTokens;
    if (record.outputTokens !== undefined) knownOutputTokens += record.outputTokens;
    if (record.totalTokens !== undefined) {
      knownTotalTokens += record.totalTokens;
    } else if (
      record.inputTokens !== undefined &&
      record.outputTokens !== undefined
    ) {
      knownTotalTokens += record.inputTokens + record.outputTokens;
    }

    if (record.source === "unknown") unknownRequestCount += 1;
    if (record.source === "provider") providerRequestCount += 1;
    if (record.source === "estimated") estimatedRequestCount += 1;
  }

  return {
    requestCount: records.length,
    retryCount: records.reduce(
      (count, record) => count + (record.attempt > 1 ? 1 : 0),
      0,
    ),
    knownInputTokens,
    knownOutputTokens,
    knownTotalTokens,
    unknownRequestCount,
    providerRequestCount,
    estimatedRequestCount,
  };
}
