import type { Character, OutlineNode, WorldEntry } from "@ai-writer/core";
import {
  createCharacterInputSchema,
  createOutlineNodeInputSchema,
  createWorldEntryInputSchema,
  updateCharacterInputSchema,
  updateOutlineNodeInputSchema,
  updateWorldEntryInputSchema,
} from "@ai-writer/schemas";
import type { KnowledgeRepository } from "./index";

const charactersKey = "ai-writer.characters.v1";
const worldEntriesKey = "ai-writer.world-entries.v1";
const outlineNodesKey = "ai-writer.outline-nodes.v1";
const deletedCharactersKey = "ai-writer.deleted-characters.v1";
const deletedWorldEntriesKey = "ai-writer.deleted-world-entries.v1";
const deletedOutlineNodesKey = "ai-writer.deleted-outline-nodes.v1";

function readArray<T>(key: string): T[] {
  const raw = globalThis.localStorage?.getItem(key);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, values: T[]): void {
  globalThis.localStorage?.setItem(key, JSON.stringify(values));
}

function readDeleted(key: string): Set<string> {
  return new Set(readArray<string>(key));
}

function markDeleted(key: string, id: string): void {
  const deleted = readDeleted(key);
  deleted.add(id);
  writeArray(key, [...deleted]);
}

function nextOrder(nodes: OutlineNode[], projectId: string): number {
  return (
    nodes
      .filter((node) => node.projectId === projectId)
      .reduce((maximum, node) => Math.max(maximum, node.order), -1) + 1
  );
}

export function createWebKnowledgeRepository(): KnowledgeRepository {
  return {
    async listCharacters(projectId) {
      const deleted = readDeleted(deletedCharactersKey);
      return readArray<Character>(charactersKey)
        .filter((item) => item.projectId === projectId && !deleted.has(item.id))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async createCharacter(input) {
      const parsed = createCharacterInputSchema.parse(input);
      const now = new Date().toISOString();
      const item: Character = {
        id: crypto.randomUUID(),
        projectId: parsed.projectId,
        name: parsed.name,
        aliases: parsed.aliases,
        profile: parsed.profile,
        motivation: parsed.motivation,
        currentState: parsed.currentState,
        isLocked: parsed.isLocked,
        createdAt: now,
        updatedAt: now,
      };
      writeArray(charactersKey, [item, ...readArray<Character>(charactersKey)]);
      return item;
    },

    async updateCharacter(input) {
      const parsed = updateCharacterInputSchema.parse(input);
      const items = readArray<Character>(charactersKey);
      const current = items.find((item) => item.id === parsed.id);
      if (!current) throw new Error("人物不存在");
      const updated: Character = {
        ...current,
        name: parsed.name ?? current.name,
        aliases: parsed.aliases ?? current.aliases,
        profile: parsed.profile ?? current.profile,
        motivation: parsed.motivation ?? current.motivation,
        currentState: parsed.currentState ?? current.currentState,
        isLocked: parsed.isLocked ?? current.isLocked,
        updatedAt: new Date().toISOString(),
      };
      writeArray(
        charactersKey,
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      return updated;
    },

    async deleteCharacter(id) {
      if (!readArray<Character>(charactersKey).some((item) => item.id === id)) {
        throw new Error("人物不存在");
      }
      markDeleted(deletedCharactersKey, id);
    },

    async listWorldEntries(projectId) {
      const deleted = readDeleted(deletedWorldEntriesKey);
      return readArray<WorldEntry>(worldEntriesKey)
        .filter((item) => item.projectId === projectId && !deleted.has(item.id))
        .sort((left, right) => left.entryType.localeCompare(right.entryType));
    },

    async createWorldEntry(input) {
      const parsed = createWorldEntryInputSchema.parse(input);
      const now = new Date().toISOString();
      const item: WorldEntry = {
        id: crypto.randomUUID(),
        projectId: parsed.projectId,
        entryType: parsed.entryType,
        title: parsed.title,
        content: parsed.content,
        isLocked: parsed.isLocked,
        createdAt: now,
        updatedAt: now,
      };
      writeArray(worldEntriesKey, [item, ...readArray<WorldEntry>(worldEntriesKey)]);
      return item;
    },

    async updateWorldEntry(input) {
      const parsed = updateWorldEntryInputSchema.parse(input);
      const items = readArray<WorldEntry>(worldEntriesKey);
      const current = items.find((item) => item.id === parsed.id);
      if (!current) throw new Error("世界观条目不存在");
      const updated: WorldEntry = {
        ...current,
        entryType: parsed.entryType ?? current.entryType,
        title: parsed.title ?? current.title,
        content: parsed.content ?? current.content,
        isLocked: parsed.isLocked ?? current.isLocked,
        updatedAt: new Date().toISOString(),
      };
      writeArray(
        worldEntriesKey,
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      return updated;
    },

    async deleteWorldEntry(id) {
      if (!readArray<WorldEntry>(worldEntriesKey).some((item) => item.id === id)) {
        throw new Error("世界观条目不存在");
      }
      markDeleted(deletedWorldEntriesKey, id);
    },

    async listOutlineNodes(projectId) {
      const deleted = readDeleted(deletedOutlineNodesKey);
      return readArray<OutlineNode>(outlineNodesKey)
        .filter((item) => item.projectId === projectId && !deleted.has(item.id))
        .sort((left, right) => left.order - right.order);
    },

    async createOutlineNode(input) {
      const parsed = createOutlineNodeInputSchema.parse(input);
      const nodes = readArray<OutlineNode>(outlineNodesKey);
      const now = new Date().toISOString();
      const item: OutlineNode = {
        id: crypto.randomUUID(),
        projectId: parsed.projectId,
        nodeType: parsed.nodeType,
        title: parsed.title,
        content: parsed.content,
        order: parsed.order ?? nextOrder(nodes, parsed.projectId),
        isLocked: parsed.isLocked,
        createdAt: now,
        updatedAt: now,
        ...(parsed.parentId ? { parentId: parsed.parentId } : {}),
      };
      writeArray(outlineNodesKey, [...nodes, item]);
      return item;
    },

    async updateOutlineNode(input) {
      const parsed = updateOutlineNodeInputSchema.parse(input);
      const nodes = readArray<OutlineNode>(outlineNodesKey);
      const current = nodes.find((item) => item.id === parsed.id);
      if (!current) throw new Error("大纲节点不存在");
      const updated: OutlineNode = {
        ...current,
        nodeType: parsed.nodeType ?? current.nodeType,
        title: parsed.title ?? current.title,
        content: parsed.content ?? current.content,
        order: parsed.order ?? current.order,
        isLocked: parsed.isLocked ?? current.isLocked,
        updatedAt: new Date().toISOString(),
      };
      if (parsed.parentId !== undefined) updated.parentId = parsed.parentId;
      writeArray(
        outlineNodesKey,
        nodes.map((item) => (item.id === updated.id ? updated : item)),
      );
      return updated;
    },

    async deleteOutlineNode(id) {
      if (!readArray<OutlineNode>(outlineNodesKey).some((item) => item.id === id)) {
        throw new Error("大纲节点不存在");
      }
      markDeleted(deletedOutlineNodesKey, id);
    },
  };
}
