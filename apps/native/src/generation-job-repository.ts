import type {
  GenerationJob,
  GenerationOutput,
  GenerationStatus,
  WritingPipelineOptions,
} from "@ai-writer/core";
import type { GenerationJobRepository } from "@ai-writer/platform";
import {
  createGenerationJobInputSchema,
  updateGenerationJobInputSchema,
} from "@ai-writer/schemas";
import type Database from "@tauri-apps/plugin-sql";

interface GenerationJobRow {
  id: string;
  project_id: string;
  chapter_id: string | null;
  provider_config_id: string | null;
  model_profile_id: string | null;
  task_type: GenerationJob["taskType"];
  status: GenerationStatus;
  progress: number;
  instruction: string;
  pipeline_version: string;
  prompt_set_version: string;
  options_json: string;
  input_tokens: number | null;
  output_tokens: number | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface GenerationOutputRow {
  id: string;
  job_id: string;
  output_type: GenerationOutput["outputType"];
  content: string;
  created_at: string;
}

function parseOptions(value: string): WritingPipelineOptions {
  const defaults: WritingPipelineOptions = {
    enablePlanning: true,
    enableContinuityReview: true,
    enableCharacterReview: true,
    enableStyleReview: true,
    enableTargetedRewrite: true,
    enableMemoryExtraction: true,
  };
  try {
    const parsed = JSON.parse(value) as Partial<WritingPipelineOptions>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function mapJob(row: GenerationJobRow): GenerationJob {
  return {
    id: row.id,
    projectId: row.project_id,
    taskType: row.task_type,
    status: row.status,
    progress: row.progress,
    instruction: row.instruction,
    pipelineVersion: row.pipeline_version,
    promptSetVersion: row.prompt_set_version,
    options: parseOptions(row.options_json),
    retryCount: row.retry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.chapter_id ? { chapterId: row.chapter_id } : {}),
    ...(row.provider_config_id
      ? { providerConfigId: row.provider_config_id }
      : {}),
    ...(row.model_profile_id ? { modelProfileId: row.model_profile_id } : {}),
    ...(row.input_tokens !== null ? { inputTokens: row.input_tokens } : {}),
    ...(row.output_tokens !== null ? { outputTokens: row.output_tokens } : {}),
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
  };
}

function mapOutput(row: GenerationOutputRow): GenerationOutput {
  return {
    id: row.id,
    jobId: row.job_id,
    outputType: row.output_type,
    content: row.content,
    createdAt: row.created_at,
  };
}

const jobColumns = `id, project_id, chapter_id, provider_config_id,
  model_profile_id, task_type, status, progress, instruction,
  pipeline_version, prompt_set_version, options_json, input_tokens,
  output_tokens, retry_count, started_at, completed_at, error_code,
  error_message, created_at, updated_at`;

async function getJob(
  database: Database,
  id: string,
): Promise<GenerationJob | undefined> {
  const rows = await database.select<GenerationJobRow[]>(
    `SELECT ${jobColumns} FROM generation_jobs WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapJob(rows[0]) : undefined;
}

export function createGenerationJobRepository(
  database: Database,
): GenerationJobRepository {
  return {
    async listRecent(projectId, limit = 20) {
      const rows = await database.select<GenerationJobRow[]>(
        `SELECT ${jobColumns}
         FROM generation_jobs
         WHERE project_id = $1
         ORDER BY updated_at DESC
         LIMIT $2`,
        [projectId, limit],
      );
      return rows.map(mapJob);
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
      await database.execute(
        `INSERT INTO generation_jobs
          (id, project_id, chapter_id, provider_config_id, model_profile_id,
           task_type, status, progress, instruction, pipeline_version,
           prompt_set_version, options_json, retry_count, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`,
        [
          job.id,
          job.projectId,
          job.chapterId ?? null,
          job.providerConfigId ?? null,
          job.modelProfileId ?? null,
          job.taskType,
          job.status,
          job.progress,
          job.instruction,
          job.pipelineVersion,
          job.promptSetVersion,
          JSON.stringify(job.options),
          job.retryCount,
          now,
        ],
      );
      return job;
    },

    async update(id, input) {
      const parsed = updateGenerationJobInputSchema.parse(input);
      const current = await getJob(database, id);
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

      await database.execute(
        `UPDATE generation_jobs
         SET status = $2,
             progress = $3,
             input_tokens = $4,
             output_tokens = $5,
             retry_count = $6,
             started_at = $7,
             completed_at = $8,
             error_code = $9,
             error_message = $10,
             updated_at = $11
         WHERE id = $1`,
        [
          id,
          updated.status,
          updated.progress,
          updated.inputTokens ?? null,
          updated.outputTokens ?? null,
          updated.retryCount,
          updated.startedAt ?? null,
          updated.completedAt ?? null,
          updated.errorCode ?? null,
          updated.errorMessage ?? null,
          updated.updatedAt,
        ],
      );
      return updated;
    },

    async replaceOutput(jobId, content) {
      await database.execute(
        `DELETE FROM generation_outputs
         WHERE job_id = $1 AND output_type = 'draft'`,
        [jobId],
      );
      const output: GenerationOutput = {
        id: crypto.randomUUID(),
        jobId,
        outputType: "draft",
        content,
        createdAt: new Date().toISOString(),
      };
      await database.execute(
        `INSERT INTO generation_outputs
          (id, job_id, output_type, content, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          output.id,
          output.jobId,
          output.outputType,
          output.content,
          output.createdAt,
        ],
      );
      return output;
    },

    async getOutput(jobId) {
      const rows = await database.select<GenerationOutputRow[]>(
        `SELECT id, job_id, output_type, content, created_at
         FROM generation_outputs
         WHERE job_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [jobId],
      );
      return rows[0] ? mapOutput(rows[0]) : undefined;
    },

    async markInterrupted(projectId) {
      const now = new Date().toISOString();
      const result = await database.execute(
        `UPDATE generation_jobs
         SET status = 'failed',
             progress = 1,
             completed_at = $2,
             error_code = 'app_restarted',
             error_message = '应用关闭时任务仍在运行，已保留现有输出。',
             updated_at = $2
         WHERE project_id = $1
           AND status IN (
             'queued', 'building_context', 'planning', 'generating',
             'reviewing', 'rewriting', 'saving'
           )`,
        [projectId, now],
      );
      return result.rowsAffected;
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
