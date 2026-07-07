import {
  createChapterStarterHtml,
  createHtmlContentDocument,
  hashText,
  type Chapter,
  type ChapterVersion,
  type Volume,
} from "@ai-writer/core";
import type { ContentRepository } from "@ai-writer/platform";
import {
  createChapterInputSchema,
  createChapterVersionInputSchema,
  createVolumeInputSchema,
  updateChapterContentInputSchema,
} from "@ai-writer/schemas";
import type Database from "@tauri-apps/plugin-sql";

interface VolumeRow {
  id: string;
  project_id: string;
  title: string;
  summary: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface ChapterRow {
  id: string;
  project_id: string;
  volume_id: string | null;
  title: string;
  sort_order: number;
  status: Chapter["status"];
  content_json: string;
  content_markdown: string;
  plain_text: string;
  summary: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

interface ChapterVersionRow {
  id: string;
  chapter_id: string;
  version: number;
  content_json: string;
  content_markdown: string;
  plain_text: string;
  change_type: ChapterVersion["changeType"];
  change_reason: string | null;
  created_at: string;
}

interface NextOrderRow {
  next_order: number;
}

interface NextVersionRow {
  next_version: number;
}

function parseContentJson(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function mapVolume(row: VolumeRow): Volume {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    summary: row.summary,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChapter(row: ChapterRow): Chapter {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    order: row.sort_order,
    status: row.status,
    contentJson: parseContentJson(row.content_json),
    contentMarkdown: row.content_markdown,
    plainText: row.plain_text,
    contentHash: row.content_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.volume_id ? { volumeId: row.volume_id } : {}),
    ...(row.summary ? { summary: row.summary } : {}),
  };
}

function mapChapterVersion(row: ChapterVersionRow): ChapterVersion {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    version: row.version,
    contentJson: parseContentJson(row.content_json),
    contentMarkdown: row.content_markdown,
    plainText: row.plain_text,
    changeType: row.change_type,
    createdAt: row.created_at,
    ...(row.change_reason ? { changeReason: row.change_reason } : {}),
  };
}

async function getChapter(database: Database, id: string): Promise<Chapter | undefined> {
  const rows = await database.select<ChapterRow[]>(
    `SELECT id, project_id, volume_id, title, sort_order, status, content_json,
            content_markdown, plain_text, summary, content_hash, created_at, updated_at
     FROM chapters
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return rows[0] ? mapChapter(rows[0]) : undefined;
}

export function createContentRepository(database: Database): ContentRepository {
  return {
    async listVolumes(projectId) {
      const rows = await database.select<VolumeRow[]>(
        `SELECT id, project_id, title, summary, sort_order, created_at, updated_at
         FROM volumes
         WHERE project_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [projectId],
      );
      return rows.map(mapVolume);
    },

    async createVolume(input) {
      const parsed = createVolumeInputSchema.parse(input);
      let order = parsed.order;
      if (order === undefined) {
        const rows = await database.select<NextOrderRow[]>(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
           FROM volumes
           WHERE project_id = $1`,
          [parsed.projectId],
        );
        order = rows[0]?.next_order ?? 0;
      }

      const now = new Date().toISOString();
      const volume: Volume = {
        id: crypto.randomUUID(),
        projectId: parsed.projectId,
        title: parsed.title,
        summary: parsed.summary,
        order,
        createdAt: now,
        updatedAt: now,
      };
      await database.execute(
        `INSERT INTO volumes
          (id, project_id, title, summary, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [
          volume.id,
          volume.projectId,
          volume.title,
          volume.summary,
          volume.order,
          now,
        ],
      );
      return volume;
    },

    async listChapters(projectId) {
      const rows = await database.select<ChapterRow[]>(
        `SELECT c.id, c.project_id, c.volume_id, c.title, c.sort_order, c.status,
                c.content_json, c.content_markdown, c.plain_text, c.summary,
                c.content_hash, c.created_at, c.updated_at
         FROM chapters c
         LEFT JOIN volumes v ON v.id = c.volume_id
         WHERE c.project_id = $1
         ORDER BY COALESCE(v.sort_order, 2147483647), c.sort_order, c.created_at`,
        [projectId],
      );
      return rows.map(mapChapter);
    },

    async getChapter(id) {
      return getChapter(database, id);
    },

    async createChapter(input) {
      const parsed = createChapterInputSchema.parse(input);
      let order = parsed.order;
      if (order === undefined) {
        const rows = await database.select<NextOrderRow[]>(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
           FROM chapters
           WHERE project_id = $1
             AND (($2 IS NULL AND volume_id IS NULL) OR volume_id = $2)`,
          [parsed.projectId, parsed.volumeId ?? null],
        );
        order = rows[0]?.next_order ?? 0;
      }

      const now = new Date().toISOString();
      const html = createChapterStarterHtml(parsed.title);
      const chapter: Chapter = {
        id: crypto.randomUUID(),
        projectId: parsed.projectId,
        title: parsed.title,
        order,
        status: parsed.status,
        contentJson: createHtmlContentDocument(html),
        contentMarkdown: html,
        plainText: parsed.title,
        contentHash: hashText(html),
        createdAt: now,
        updatedAt: now,
        ...(parsed.volumeId ? { volumeId: parsed.volumeId } : {}),
      };

      await database.execute(
        `INSERT INTO chapters
          (id, project_id, volume_id, title, sort_order, status, content_json,
           content_markdown, plain_text, summary, content_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '', $10, $11, $11)`,
        [
          chapter.id,
          chapter.projectId,
          chapter.volumeId ?? null,
          chapter.title,
          chapter.order,
          chapter.status,
          JSON.stringify(chapter.contentJson),
          chapter.contentMarkdown,
          chapter.plainText,
          chapter.contentHash,
          now,
        ],
      );
      return chapter;
    },

    async saveChapterContent(input) {
      const parsed = updateChapterContentInputSchema.parse(input);
      const now = new Date().toISOString();
      const contentHash = hashText(parsed.contentMarkdown);
      const result = await database.execute(
        `UPDATE chapters
         SET content_json = $2,
             content_markdown = $3,
             plain_text = $4,
             summary = COALESCE($5, summary),
             content_hash = $6,
             status = CASE WHEN status = 'planned' THEN 'drafting' ELSE status END,
             updated_at = $7
         WHERE id = $1`,
        [
          parsed.chapterId,
          JSON.stringify(parsed.contentJson),
          parsed.contentMarkdown,
          parsed.plainText,
          parsed.summary ?? null,
          contentHash,
          now,
        ],
      );
      if (result.rowsAffected === 0) throw new Error("章节不存在");
      const chapter = await getChapter(database, parsed.chapterId);
      if (!chapter) throw new Error("保存后未找到章节");
      return chapter;
    },

    async createChapterVersion(input) {
      const parsed = createChapterVersionInputSchema.parse(input);
      const rows = await database.select<NextVersionRow[]>(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM chapter_versions
         WHERE chapter_id = $1`,
        [parsed.chapterId],
      );
      const now = new Date().toISOString();
      const version: ChapterVersion = {
        id: crypto.randomUUID(),
        chapterId: parsed.chapterId,
        version: rows[0]?.next_version ?? 1,
        contentJson: parsed.contentJson,
        contentMarkdown: parsed.contentMarkdown,
        plainText: parsed.plainText,
        changeType: parsed.changeType,
        createdAt: now,
        ...(parsed.changeReason ? { changeReason: parsed.changeReason } : {}),
      };
      await database.execute(
        `INSERT INTO chapter_versions
          (id, chapter_id, version, content_json, content_markdown, plain_text,
           change_type, change_reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          version.id,
          version.chapterId,
          version.version,
          JSON.stringify(version.contentJson),
          version.contentMarkdown,
          version.plainText,
          version.changeType,
          version.changeReason ?? null,
          version.createdAt,
        ],
      );
      return version;
    },

    async listChapterVersions(chapterId) {
      const rows = await database.select<ChapterVersionRow[]>(
        `SELECT id, chapter_id, version, content_json, content_markdown,
                plain_text, change_type, change_reason, created_at
         FROM chapter_versions
         WHERE chapter_id = $1
         ORDER BY version DESC`,
        [chapterId],
      );
      return rows.map(mapChapterVersion);
    },
  };
}
