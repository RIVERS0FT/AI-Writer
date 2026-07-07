import type { WritingStep } from "@ai-writer/core";
import type { WritingRepository } from "@ai-writer/platform";
import {
  createWritingStepInputSchema,
  updateWritingStepInputSchema,
} from "@ai-writer/schemas";
import type Database from "@tauri-apps/plugin-sql";

interface WritingStepRow {
  id: string;
  job_id: string;
  step_type: WritingStep["stepType"];
  step_order: number;
  status: WritingStep["status"];
  attempt_count: number;
  prompt_id: string | null;
  prompt_version: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  usage_source: WritingStep["usageSource"] | null;
  latency_ms: number | null;
  context_snapshot_id: string | null;
  input_json: string | null;
  output_json: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

function parseJson(value: string | null): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function mapStep(row: WritingStepRow): WritingStep {
  return {
    id: row.id,
    jobId: row.job_id,
    stepType: row.step_type,
    order: row.step_order,
    status: row.status,
    attemptCount: row.attempt_count,
    ...(row.prompt_id ? { promptId: row.prompt_id } : {}),
    ...(row.prompt_version ? { promptVersion: row.prompt_version } : {}),
    ...(row.input_tokens !== null ? { inputTokens: row.input_tokens } : {}),
    ...(row.output_tokens !== null ? { outputTokens: row.output_tokens } : {}),
    ...(row.total_tokens !== null ? { totalTokens: row.total_tokens } : {}),
    ...(row.usage_source ? { usageSource: row.usage_source } : {}),
    ...(row.latency_ms !== null ? { latencyMs: row.latency_ms } : {}),
    ...(row.context_snapshot_id
      ? { contextSnapshotId: row.context_snapshot_id }
      : {}),
    ...(row.input_json ? { input: parseJson(row.input_json) } : {}),
    ...(row.output_json ? { output: parseJson(row.output_json) } : {}),
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
  };
}

async function getStep(
  database: Database,
  id: string,
): Promise<WritingStep | undefined> {
  const rows = await database.select<WritingStepRow[]>(
    `SELECT id, job_id, step_type, step_order, status, attempt_count,
            prompt_id, prompt_version, input_tokens, output_tokens,
            total_tokens, usage_source, latency_ms, context_snapshot_id,
            input_json, output_json, started_at, completed_at, error_message
     FROM generation_steps
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return rows[0] ? mapStep(rows[0]) : undefined;
}

export function createWritingRepository(database: Database): WritingRepository {
  return {
    async listSteps(jobId) {
      const rows = await database.select<WritingStepRow[]>(
        `SELECT id, job_id, step_type, step_order, status, attempt_count,
                prompt_id, prompt_version, input_tokens, output_tokens,
                total_tokens, usage_source, latency_ms, context_snapshot_id,
                input_json, output_json, started_at, completed_at, error_message
         FROM generation_steps
         WHERE job_id = $1
         ORDER BY step_order ASC, id ASC`,
        [jobId],
      );
      return rows.map(mapStep);
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

      await database.execute(
        `INSERT INTO generation_steps
          (id, job_id, step_type, step_order, status, attempt_count,
           prompt_id, prompt_version, context_snapshot_id, input_json)
         VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9)`,
        [
          step.id,
          step.jobId,
          step.stepType,
          step.order,
          step.status,
          step.promptId ?? null,
          step.promptVersion ?? null,
          step.contextSnapshotId ?? null,
          step.input === undefined ? null : JSON.stringify(step.input),
        ],
      );
      return step;
    },

    async updateStep(id, input) {
      const parsed = updateWritingStepInputSchema.parse(input);
      const current = await getStep(database, id);
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

      await database.execute(
        `UPDATE generation_steps
         SET status = $2,
             attempt_count = $3,
             prompt_id = $4,
             prompt_version = $5,
             input_tokens = $6,
             output_tokens = $7,
             total_tokens = $8,
             usage_source = $9,
             latency_ms = $10,
             context_snapshot_id = $11,
             input_json = $12,
             output_json = $13,
             started_at = $14,
             completed_at = $15,
             error_message = $16
         WHERE id = $1`,
        [
          updated.id,
          updated.status,
          updated.attemptCount,
          updated.promptId ?? null,
          updated.promptVersion ?? null,
          updated.inputTokens ?? null,
          updated.outputTokens ?? null,
          updated.totalTokens ?? null,
          updated.usageSource ?? null,
          updated.latencyMs ?? null,
          updated.contextSnapshotId ?? null,
          updated.input === undefined ? null : JSON.stringify(updated.input),
          updated.output === undefined ? null : JSON.stringify(updated.output),
          updated.startedAt ?? null,
          updated.completedAt ?? null,
          updated.errorMessage ?? null,
        ],
      );
      return updated;
    },
  };
}

function setNullable<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | null | undefined,
): void {
  if (value === null) delete target[key];
  else if (value !== undefined) target[key] = value;
}
