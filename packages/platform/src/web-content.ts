import {
  createChapterStarterHtml,
  createHtmlContentDocument,
  hashText,
  type Chapter,
  type ChapterVersion,
  type Volume,
} from "@ai-writer/core";
import {
  createChapterInputSchema,
  createChapterVersionInputSchema,
  createVolumeInputSchema,
  updateChapterContentInputSchema,
} from "@ai-writer/schemas";
import type { ContentRepository } from "./index";

const volumesStorageKey = "ai-writer.volumes.v1";
const chaptersStorageKey = "ai-writer.chapters.v1";
const chapterVersionsStorageKey = "ai-writer.chapter-versions.v1";

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

function nextOrder(values: Array<{ order: number }>): number {
  return values.reduce((maximum, item) => Math.max(maximum, item.order), -1) + 1;
}

export function createWebContentRepository(): ContentRepository {
  return {
    async listVolumes(projectId) {
      return readJsonArray<Volume>(volumesStorageKey)
        .filter((volume) => volume.projectId === projectId)
        .sort((left, right) => left.order - right.order);
    },

    async createVolume(input) {
      const parsed = createVolumeInputSchema.parse(input);
      const volumes = readJsonArray<Volume>(volumesStorageKey);
      const siblings = volumes.filter((volume) => volume.projectId === parsed.projectId);
      const now = new Date().toISOString();
      const volume: Volume = {
        id: crypto.randomUUID(),
        projectId: parsed.projectId,
        title: parsed.title,
        summary: parsed.summary,
        order: parsed.order ?? nextOrder(siblings),
        createdAt: now,
        updatedAt: now,
      };
      writeJsonArray(volumesStorageKey, [...volumes, volume]);
      return volume;
    },

    async listChapters(projectId) {
      return readJsonArray<Chapter>(chaptersStorageKey)
        .filter((chapter) => chapter.projectId === projectId)
        .sort((left, right) => left.order - right.order);
    },

    async getChapter(id) {
      return readJsonArray<Chapter>(chaptersStorageKey).find(
        (chapter) => chapter.id === id,
      );
    },

    async createChapter(input) {
      const parsed = createChapterInputSchema.parse(input);
      const chapters = readJsonArray<Chapter>(chaptersStorageKey);
      const siblings = chapters.filter(
        (chapter) =>
          chapter.projectId === parsed.projectId &&
          chapter.volumeId === parsed.volumeId,
      );
      const now = new Date().toISOString();
      const html = createChapterStarterHtml(parsed.title);
      const chapter: Chapter = {
        id: crypto.randomUUID(),
        projectId: parsed.projectId,
        title: parsed.title,
        order: parsed.order ?? nextOrder(siblings),
        status: parsed.status,
        contentJson: createHtmlContentDocument(html),
        contentMarkdown: html,
        plainText: parsed.title,
        contentHash: hashText(html),
        createdAt: now,
        updatedAt: now,
        ...(parsed.volumeId ? { volumeId: parsed.volumeId } : {}),
      };
      writeJsonArray(chaptersStorageKey, [...chapters, chapter]);
      return chapter;
    },

    async saveChapterContent(input) {
      const parsed = updateChapterContentInputSchema.parse(input);
      const chapters = readJsonArray<Chapter>(chaptersStorageKey);
      const current = chapters.find((chapter) => chapter.id === parsed.chapterId);
      if (!current) throw new Error("章节不存在");

      const updated: Chapter = {
        ...current,
        contentJson: parsed.contentJson,
        contentMarkdown: parsed.contentMarkdown,
        plainText: parsed.plainText,
        contentHash: hashText(parsed.contentMarkdown),
        updatedAt: new Date().toISOString(),
        ...(parsed.summary !== undefined ? { summary: parsed.summary } : {}),
      };
      writeJsonArray(
        chaptersStorageKey,
        chapters.map((chapter) => (chapter.id === updated.id ? updated : chapter)),
      );
      return updated;
    },

    async createChapterVersion(input) {
      const parsed = createChapterVersionInputSchema.parse(input);
      const versions = readJsonArray<ChapterVersion>(chapterVersionsStorageKey);
      const chapterVersions = versions.filter(
        (version) => version.chapterId === parsed.chapterId,
      );
      const version: ChapterVersion = {
        id: crypto.randomUUID(),
        chapterId: parsed.chapterId,
        version:
          chapterVersions.reduce(
            (maximum, item) => Math.max(maximum, item.version),
            0,
          ) + 1,
        contentJson: parsed.contentJson,
        contentMarkdown: parsed.contentMarkdown,
        plainText: parsed.plainText,
        changeType: parsed.changeType,
        createdAt: new Date().toISOString(),
        ...(parsed.changeReason ? { changeReason: parsed.changeReason } : {}),
      };
      writeJsonArray(chapterVersionsStorageKey, [...versions, version]);
      return version;
    },

    async listChapterVersions(chapterId) {
      return readJsonArray<ChapterVersion>(chapterVersionsStorageKey)
        .filter((version) => version.chapterId === chapterId)
        .sort((left, right) => right.version - left.version);
    },
  };
}
