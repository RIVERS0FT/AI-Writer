import {
  summarizeTokenUsage,
  type TokenUsageRecord,
  type UsageSummary,
} from "@ai-writer/core";
import type { UsageRepository } from "@ai-writer/platform";
import { recordTokenUsageInputSchema } from "@ai-writer/schemas";
import type Database from "@tauri-apps/plugin-sql";

interface UsageRow {
  id: string;
  job_id: string;
  step_id: string;
  project_id: string;
  chapter_id: string | null;
  provider_config_id: string | null;
  model_profile_id: string | null;
  model: string;
  task_type: TokenUsageRecord["taskType"];
  step_type: TokenUsageRecord["stepType"];
  attempt: number;
  status: TokenUsageRecord["status"];
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cached_input_tokens: number | null;
  reasoning_tokens: number | null;
  usage_source: TokenUsageRecord["source"];
  latency_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

function mapUsage(row: UsageRow): TokenUsageRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    stepId: row.step_id,
    projectId: row.project_id,
    model: row.model,
    taskType: row.task_type,
    stepType: row.step_type,
    attempt: row.attempt,
    status: row.status,
    source: row.usage_source,
    startedAt: row.started_at,
    ...(row.chapter_id ? { chapterId: row.chapter_id } : {}),
    ...(row.provider_config_id
      ? { providerConfigId: row.provider_config_id }
      : {}),
    ...(row.model_profile_id
      ? { modelProfileId: row.model_profile_id }
      : {}),
    ...(row.input_tokens !== null ? { inputTokens: row.input_tokens } : {}),
    ...(row.output_tokens !== null ? { outputTokens: row.output_tokens } : {}),
    ...(row.total_tokens !== null ? { totalTokens: row.total_tokens } : {}),
    ...(row.cached_input_tokens !== null
      ? { cachedInputTokens: row.cached_input_tokens }
      : {}),
    ...(row.reasoning_tokens !== null
      ? { reasoningTokens: row.reasoning_tokens }
      : {}),
    ...(row.latency_ms !== null ? { latencyMs: row.latency_ms } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
  };
}

async function selectUsage(
  database: Database,
  whereClause: string,
  parameters: unknown[],
): Promise<TokenUsageRecord[]> {
  const rows = await database.select<UsageRow[]>(
    `SELECT id, job_id, step_id, project_id, chapter_id,
            provider_config_id, model_profile_id, model, task_type, step_type,
            attempt, status, input_tokens, output_tokens, total_tokens,
            cached_input_tokens, reasoning_tokens, usage_source, latency_ms,
            error_code, error_message, started_at, completed_at
     FROM generation_requests
     WHERE ${whereClause}
     ORDER BY started_at ASC, attempt ASC`,
    parameters,
  );
  return rows.map(mapUsage);
}

async function summarize(
  database: Database,
  whereClause: string,
  parameters: unknown[],
): Promise<UsageSummary> {
  return summarizeTokenUsage(
    await selectUsage(database, whereClause, parameters),
  );
}

export function createUsageRepository(database: Database): UsageRepository {
  return {
    async recordRequest(input) {
      const parsed = recordTokenUsageInputSchema.parse(input);
      const record: TokenUsageRecord = { ...parsed };

      await database.execute(
        `INSERT INTO generation_requests
          (id, job_id, step_id, project_id, chapter_id, provider_config_id,
           model_profile_id, model, task_type, step_type, attempt, status,
           input_tokens, output_tokens, total_tokens, cached_input_tokens,
           reasoning_tokens, usage_source, latency_ms, error_code,
           error_message, started_at, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                 $16,$17,$18,$19,$20,$21,$22,$23)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           input_tokens = excluded.input_tokens,
           output_tokens = excluded.output_tokens,
           total_tokens = excluded.total_tokens,
           cached_input_tokens = excluded.cached_input_tokens,
           reasoning_tokens = excluded.reasoning_tokens,
           usage_source = excluded.usage_source,
           latency_ms = excluded.latency_ms,
           error_code = excluded.error_code,
           error_message = excluded.error_message,
           completed_at = excluded.completed_at`,
        values(record),
      );

      await database.execute(
        `INSERT INTO usage_records
          (id, job_id, project_id, chapter_id, step_id, request_id,
           provider_config_id, model_profile_id, model, task_type, step_type,
           attempt, status, input_tokens, output_tokens, total_tokens,
           usage_source, latency_ms, created_at)
         VALUES ($1,$2,$3,$4,$5,$1,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                 $16,$17,$18)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           input_tokens = excluded.input_tokens,
           output_tokens = excluded.output_tokens,
           total_tokens = excluded.total_tokens,
           usage_source = excluded.usage_source,
           latency_ms = excluded.latency_ms`,
        [
          record.id,
          record.jobId,
          record.projectId,
          record.chapterId ?? null,
          record.stepId,
          record.providerConfigId ?? null,
          record.modelProfileId ?? null,
          record.model,
          record.taskType,
          record.stepType,
          record.attempt,
          record.status,
          record.inputTokens ?? null,
          record.outputTokens ?? null,
          record.totalTokens ?? null,
          record.source,
          record.latencyMs ?? null,
          record.completedAt ?? record.startedAt,
        ],
      );
      return record;
    },

    async listForJob(jobId) {
      return selectUsage(database, "job_id = $1", [jobId]);
    },

    async summarizeTask(jobId) {
      return summarize(database, "job_id = $1", [jobId]);
    },

    async summarizeChapter(chapterId) {
      return summarize(database, "chapter_id = $1", [chapterId]);
    },

    async summarizeProject(projectId) {
      return summarize(database, "project_id = $1", [projectId]);
    },

    async summarizeModel(modelProfileId) {
      return summarize(database, "model_profile_id = $1", [modelProfileId]);
    },
  };
}

function values(record: TokenUsageRecord): unknown[] {
  return [
    record.id,
    record.jobId,
    record.stepId,
    record.projectId,
    record.chapterId ?? null,
    record.providerConfigId ?? null,
    record.modelProfileId ?? null,
    record.model,
    record.taskType,
    record.stepType,
    record.attempt,
    record.status,
    record.inputTokens ?? null,
    record.outputTokens ?? null,
    record.totalTokens ?? null,
    record.cachedInputTokens ?? null,
    record.reasoningTokens ?? null,
    record.source,
    record.latencyMs ?? null,
    record.errorCode ?? null,
    record.errorMessage ?? null,
    record.startedAt,
    record.completedAt ?? null,
  ];
}
