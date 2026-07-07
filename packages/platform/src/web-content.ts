import {
  createChapterStarterText,
  hashText,
  normalizeLegacyChapterText,
  type Chapter,
  type ChapterVersion,
  type Volume,
} from "@ai-writer/core";
import {
  createChapterInputSchema,
  createChapterVersionInputSchema,
  createVolumeInputSchema,
  updateChapterContentInputSchema,
  updateChapterMetadataInputSchema,
  updateVolumeInputSchema,
} from "@ai-writer/schemas";
import type { ContentRepository } from "./index";

const volumesStorageKey = "ai-writer.volumes.v1";
const chaptersStorageKey = "ai-writer.chapters.v1";
const chapterVersionsStorageKey = "ai-writer.chapter-versions.v1";
const deletedVolumesStorageKey = "ai-writer.deleted-volumes.v1";
const deletedChaptersStorageKey = "ai-writer.deleted-chapters.v1";

type StoredChapter = Omit<Chapter, "plainText" | "contentHash"> & {
  plainText?: string;
  contentHash?: string;
  contentMarkdown?: string;
  contentJson?: unknown;
};

type StoredChapterVersion = Omit<ChapterVersion, "plainText"> & {
  plainText?: string;
  contentMarkdown?: string;
  contentJson?: unknown;
};

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

function readChapters(): Chapter[] {
  const stored = readJsonArray<StoredChapter>(chaptersStorageKey);
  let migrated = false;
  const chapters = stored.map((item) => {
    const source = item.plainText || item.contentMarkdown || "";
    const plainText = normalizeLegacyChapterText(source);
    const {
      contentJson: _contentJson,
      contentMarkdown: _contentMarkdown,
      ...rest
    } = item;
    if (
      _contentJson !== undefined ||
      _contentMarkdown !== undefined ||
      item.plainText !== plainText
    ) {
      migrated = true;
    }
    return {
      ...rest,
      plainText,
      contentHash: item.contentHash || hashText(plainText),
    } as Chapter;
  });
  if (migrated) writeJsonArray(chaptersStorageKey, chapters);
  return chapters;
}

function readChapterVersions(): ChapterVersion[] {
  const stored = readJsonArray<StoredChapterVersion>(chapterVersionsStorageKey);
  let migrated = false;
  const versions = stored.map((item) => {
    const source = item.plainText || item.contentMarkdown || "";
    const plainText = normalizeLegacyChapterText(source);
    const {
      contentJson: _contentJson,
      contentMarkdown: _contentMarkdown,
      ...rest
    } = item;
    if (
      _contentJson !== undefined ||
      _contentMarkdown !== undefined ||
      item.plainText !== plainText
    ) {
      migrated = true;
    }
    return { ...rest, plainText } as ChapterVersion;
  });
  if (migrated) writeJsonArray(chapterVersionsStorageKey, versions);
  return versions;
}

function readIdSet(key: string): Set<string> {
  return new Set(readJsonArray<string>(key));
}

function writeIdSet(key: string, values: Set<string>): void {
  writeJsonArray(key, [...values]);
}

function nextOrder(values: Array<{ order: number }>): number {
  return values.reduce((maximum, item) => Math.max(maximum, item.order), -1) + 1;
}

function nextVersion(versions: ChapterVersion[], chapterId: string): number {
  return (
    versions
      .filter((version) => version.chapterId === chapterId)
      .reduce((maximum, version) => Math.max(maximum, version.version), 0) + 1
  );
}

export function createWebContentRepository(): ContentRepository {
  return {
    async listVolumes(projectId) {
      const deleted = readIdSet(deletedVolumesStorageKey);
      return readJsonArray<Volume>(volumesStorageKey)
        .filter(
          (volume) => volume.projectId === projectId && !deleted.has(volume.id),
        )
        .sort((left, right) => left.order - right.order);
    },

    async createVolume(input) {
      const parsed = createVolumeInputSchema.parse(input);
      const volumes = readJsonArray<Volume>(volumesStorageKey);
      const deleted = readIdSet(deletedVolumesStorageKey);
      const siblings = volumes.filter(
        (volume) =>
          volume.projectId === parsed.projectId && !deleted.has(volume.id),
      );
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

    async updateVolume(input) {
      const parsed = updateVolumeInputSchema.parse(input);
      const volumes = readJsonArray<Volume>(volumesStorageKey);
      const current = volumes.find((volume) => volume.id === parsed.id);
      if (!current) throw new Error("卷不存在");
      const updated: Volume = {
        ...current,
        title: parsed.title ?? current.title,
        summary: parsed.summary ?? current.summary,
        order: parsed.order ?? current.order,
        updatedAt: new Date().toISOString(),
      };
      writeJsonArray(
        volumesStorageKey,
        volumes.map((volume) => (volume.id === updated.id ? updated : volume)),
      );
      return updated;
    },

    async deleteVolume(id) {
      const volumes = readJsonArray<Volume>(volumesStorageKey);
      if (!volumes.some((volume) => volume.id === id)) {
        throw new Error("卷不存在");
      }
      const deleted = readIdSet(deletedVolumesStorageKey);
      deleted.add(id);
      writeIdSet(deletedVolumesStorageKey, deleted);
    },

    async restoreVolume(id) {
      const volumes = readJsonArray<Volume>(volumesStorageKey);
      const volume = volumes.find((item) => item.id === id);
      if (!volume) throw new Error("卷不存在");
      const deleted = readIdSet(deletedVolumesStorageKey);
      deleted.delete(id);
      writeIdSet(deletedVolumesStorageKey, deleted);
      const updated = { ...volume, updatedAt: new Date().toISOString() };
      writeJsonArray(
        volumesStorageKey,
        volumes.map((item) => (item.id === id ? updated : item)),
      );
      return updated;
    },

    async listChapters(projectId) {
      const deletedChapters = readIdSet(deletedChaptersStorageKey);
      const deletedVolumes = readIdSet(deletedVolumesStorageKey);
      return readChapters()
        .filter(
          (chapter) =>
            chapter.projectId === projectId && !deletedChapters.has(chapter.id),
        )
        .map((chapter) => {
          if (!chapter.volumeId || !deletedVolumes.has(chapter.volumeId)) {
            return chapter;
          }
          const detached = { ...chapter };
          delete detached.volumeId;
          return detached;
        })
        .sort((left, right) => left.order - right.order);
    },

    async getChapter(id) {
      const chapter = readChapters().find((item) => item.id === id);
      if (!chapter) return undefined;
      const deletedVolumes = readIdSet(deletedVolumesStorageKey);
      if (!chapter.volumeId || !deletedVolumes.has(chapter.volumeId)) {
        return chapter;
      }
      const detached = { ...chapter };
      delete detached.volumeId;
      return detached;
    },

    async createChapter(input) {
      const parsed = createChapterInputSchema.parse(input);
      const chapters = readChapters();
      const deleted = readIdSet(deletedChaptersStorageKey);
      const siblings = chapters.filter(
        (chapter) =>
          chapter.projectId === parsed.projectId &&
          chapter.volumeId === parsed.volumeId &&
          !deleted.has(chapter.id),
      );
      const now = new Date().toISOString();
      const plainText = createChapterStarterText(parsed.title);
      const chapter: Chapter = {
        id: crypto.randomUUID(),
        projectId: parsed.projectId,
        title: parsed.title,
        order: parsed.order ?? nextOrder(siblings),
        status: parsed.status,
        plainText,
        contentHash: hashText(plainText),
        createdAt: now,
        updatedAt: now,
        ...(parsed.volumeId ? { volumeId: parsed.volumeId } : {}),
      };
      writeJsonArray(chaptersStorageKey, [...chapters, chapter]);
      return chapter;
    },

    async updateChapter(input) {
      const parsed = updateChapterMetadataInputSchema.parse(input);
      const chapters = readChapters();
      const current = chapters.find((chapter) => chapter.id === parsed.id);
      if (!current) throw new Error("章节不存在");
      const updated: Chapter = {
        ...current,
        title: parsed.title ?? current.title,
        order: parsed.order ?? current.order,
        status: parsed.status ?? current.status,
        updatedAt: new Date().toISOString(),
      };
      if (parsed.volumeId === null) delete updated.volumeId;
      else if (parsed.volumeId !== undefined) updated.volumeId = parsed.volumeId;
      writeJsonArray(
        chaptersStorageKey,
        chapters.map((chapter) =>
          chapter.id === updated.id ? updated : chapter,
        ),
      );
      return updated;
    },

    async deleteChapter(id) {
      const chapters = readChapters();
      if (!chapters.some((chapter) => chapter.id === id)) {
        throw new Error("章节不存在");
      }
      const deleted = readIdSet(deletedChaptersStorageKey);
      deleted.add(id);
      writeIdSet(deletedChaptersStorageKey, deleted);
    },

    async restoreChapter(id) {
      const chapters = readChapters();
      const chapter = chapters.find((item) => item.id === id);
      if (!chapter) throw new Error("章节不存在");
      const deleted = readIdSet(deletedChaptersStorageKey);
      deleted.delete(id);
      writeIdSet(deletedChaptersStorageKey, deleted);
      const updated = { ...chapter, updatedAt: new Date().toISOString() };
      writeJsonArray(
        chaptersStorageKey,
        chapters.map((item) => (item.id === id ? updated : item)),
      );
      return updated;
    },

    async saveChapterContent(input) {
      const parsed = updateChapterContentInputSchema.parse(input);
      const chapters = readChapters();
      const current = chapters.find((chapter) => chapter.id === parsed.chapterId);
      if (!current) throw new Error("章节不存在");

      const updated: Chapter = {
        ...current,
        status: current.status === "planned" ? "drafting" : current.status,
        plainText: parsed.plainText,
        contentHash: hashText(parsed.plainText),
        updatedAt: new Date().toISOString(),
        ...(parsed.summary !== undefined ? { summary: parsed.summary } : {}),
      };
      writeJsonArray(
        chaptersStorageKey,
        chapters.map((chapter) =>
          chapter.id === updated.id ? updated : chapter,
        ),
      );
      return updated;
    },

    async createChapterVersion(input) {
      const parsed = createChapterVersionInputSchema.parse(input);
      const versions = readChapterVersions();
      const version: ChapterVersion = {
        id: crypto.randomUUID(),
        chapterId: parsed.chapterId,
        version: nextVersion(versions, parsed.chapterId),
        plainText: parsed.plainText,
        changeType: parsed.changeType,
        createdAt: new Date().toISOString(),
        ...(parsed.changeReason ? { changeReason: parsed.changeReason } : {}),
      };
      writeJsonArray(chapterVersionsStorageKey, [...versions, version]);
      return version;
    },

    async listChapterVersions(chapterId) {
      return readChapterVersions()
        .filter((version) => version.chapterId === chapterId)
        .sort((left, right) => right.version - left.version);
    },

    async restoreChapterVersion(versionId) {
      const versions = readChapterVersions();
      const source = versions.find((version) => version.id === versionId);
      if (!source) throw new Error("章节版本不存在");
      const chapters = readChapters();
      const current = chapters.find((chapter) => chapter.id === source.chapterId);
      if (!current) throw new Error("章节不存在");
      const now = new Date().toISOString();
      const updated: Chapter = {
        ...current,
        status: "drafting",
        plainText: source.plainText,
        contentHash: hashText(source.plainText),
        updatedAt: now,
      };
      writeJsonArray(
        chaptersStorageKey,
        chapters.map((chapter) =>
          chapter.id === updated.id ? updated : chapter,
        ),
      );
      const recovery: ChapterVersion = {
        id: crypto.randomUUID(),
        chapterId: source.chapterId,
        version: nextVersion(versions, source.chapterId),
        plainText: source.plainText,
        changeType: "recovery",
        changeReason: `恢复版本 v${source.version}`,
        createdAt: now,
      };
      writeJsonArray(chapterVersionsStorageKey, [...versions, recovery]);
      return updated;
    },
  };
}
