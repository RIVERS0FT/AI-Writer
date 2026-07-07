import type {
  GenerationJob,
  GenerationOutput,
  GenerationStatus,
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
  input_tokens: number | null;
  output_tokens: number | null;
  retry_count: number;
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

function mapJob(row: GenerationJobRow): GenerationJob {
  return {
    id: row.id,
    projectId: row.project_id,
    taskType: row.task_type,
    status: row.status,
    progress: row.progress,
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

async function getJob(database: Database, id: string): Promise<GenerationJob | undefined> {
  const rows = await database.select<GenerationJobRow[]>(
    `SELECT id, project_id, chapter_id, provider_config_id, model_profile_id,
            task_type, status, progress, input_tokens, output_tokens, retry_count,
            error_code, error_message, created_at, updated_at
     FROM generation_jobs
     WHERE id = $1
     LIMIT 1`,
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
        `SELECT id, project_id, chapter_id, provider_config_id, model_profile_id,
                task_type, status, progress, input_tokens, output_tokens,
                retry_count, error_code, error_message, created_at, updated_at
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
           task_type, status, progress, retry_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
        [
          job.id,
          job.projectId,
          job.chapterId ?? null,
          job.providerConfigId ?? null,
          job.modelProfileId ?? null,
          job.taskType,
          job.status,
          job.progress,
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
      if (parsed.errorCode === null) delete updated.errorCode;
      else if (parsed.errorCode !== undefined) updated.errorCode = parsed.errorCode;
      if (parsed.errorMessage === null) delete updated.errorMessage;
      else if (parsed.errorMessage !== undefined) {
        updated.errorMessage = parsed.errorMessage;
      }

      await database.execute(
        `UPDATE generation_jobs
         SET status = $2,
             progress = $3,
             input_tokens = $4,
             output_tokens = $5,
             retry_count = $6,
             error_code = $7,
             error_message = $8,
             updated_at = $9
         WHERE id = $1`,
        [
          id,
          updated.status,
          updated.progress,
          updated.inputTokens ?? null,
          updated.outputTokens ?? null,
          updated.retryCount,
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
