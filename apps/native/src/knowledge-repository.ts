import type {
  Character,
  OutlineNode,
  WorldEntry,
} from "@ai-writer/core";
import type { KnowledgeRepository } from "@ai-writer/platform";
import {
  createCharacterInputSchema,
  createOutlineNodeInputSchema,
  createWorldEntryInputSchema,
  updateCharacterInputSchema,
  updateOutlineNodeInputSchema,
  updateWorldEntryInputSchema,
} from "@ai-writer/schemas";
import type Database from "@tauri-apps/plugin-sql";

interface CharacterRow {
  id: string;
  project_id: string;
  name: string;
  aliases_json: string;
  profile: string;
  motivation: string;
  current_state: string;
  is_locked: number;
  created_at: string;
  updated_at: string;
}

interface WorldEntryRow {
  id: string;
  project_id: string;
  entry_type: string;
  title: string;
  content: string;
  is_locked: number;
  created_at: string;
  updated_at: string;
}

interface OutlineNodeRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  node_type: OutlineNode["nodeType"];
  title: string;
  content: string;
  sort_order: number;
  is_locked: number;
  created_at: string;
  updated_at: string;
}

interface NextOrderRow {
  next_order: number;
}

function parseAliases(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function mapCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    aliases: parseAliases(row.aliases_json),
    profile: row.profile,
    motivation: row.motivation,
    currentState: row.current_state,
    isLocked: row.is_locked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorldEntry(row: WorldEntryRow): WorldEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    entryType: row.entry_type,
    title: row.title,
    content: row.content,
    isLocked: row.is_locked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOutlineNode(row: OutlineNodeRow): OutlineNode {
  return {
    id: row.id,
    projectId: row.project_id,
    nodeType: row.node_type,
    title: row.title,
    content: row.content,
    order: row.sort_order,
    isLocked: row.is_locked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.parent_id ? { parentId: row.parent_id } : {}),
  };
}

export function createKnowledgeRepository(
  database: Database,
): KnowledgeRepository {
  return {
    async listCharacters(projectId) {
      const rows = await database.select<CharacterRow[]>(
        `SELECT id, project_id, name, aliases_json, profile, motivation,
                current_state, is_locked, created_at, updated_at
         FROM characters
         WHERE project_id = $1 AND deleted_at IS NULL
         ORDER BY updated_at DESC, name ASC`,
        [projectId],
      );
      return rows.map(mapCharacter);
    },

    async createCharacter(input) {
      const parsed = createCharacterInputSchema.parse(input);
      const now = new Date().toISOString();
      const character: Character = {
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
      await database.execute(
        `INSERT INTO characters
          (id, project_id, name, aliases_json, profile, motivation,
           current_state, is_locked, created_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, NULL)`,
        [
          character.id,
          character.projectId,
          character.name,
          JSON.stringify(character.aliases),
          character.profile,
          character.motivation,
          character.currentState,
          character.isLocked ? 1 : 0,
          now,
        ],
      );
      return character;
    },

    async updateCharacter(input) {
      const parsed = updateCharacterInputSchema.parse(input);
      const rows = await database.select<CharacterRow[]>(
        `SELECT id, project_id, name, aliases_json, profile, motivation,
                current_state, is_locked, created_at, updated_at
         FROM characters WHERE id = $1 LIMIT 1`,
        [parsed.id],
      );
      const current = rows[0] ? mapCharacter(rows[0]) : undefined;
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
      await database.execute(
        `UPDATE characters SET name = $2, aliases_json = $3, profile = $4,
         motivation = $5, current_state = $6, is_locked = $7, updated_at = $8
         WHERE id = $1`,
        [
          updated.id,
          updated.name,
          JSON.stringify(updated.aliases),
          updated.profile,
          updated.motivation,
          updated.currentState,
          updated.isLocked ? 1 : 0,
          updated.updatedAt,
        ],
      );
      return updated;
    },

    async deleteCharacter(id) {
      const result = await database.execute(
        `UPDATE characters SET deleted_at = $2, updated_at = $2
         WHERE id = $1 AND deleted_at IS NULL`,
        [id, new Date().toISOString()],
      );
      if (result.rowsAffected === 0) throw new Error("人物不存在或已删除");
    },

    async listWorldEntries(projectId) {
      const rows = await database.select<WorldEntryRow[]>(
        `SELECT id, project_id, entry_type, title, content, is_locked,
                created_at, updated_at
         FROM world_entries
         WHERE project_id = $1 AND deleted_at IS NULL
         ORDER BY entry_type ASC, updated_at DESC`,
        [projectId],
      );
      return rows.map(mapWorldEntry);
    },

    async createWorldEntry(input) {
      const parsed = createWorldEntryInputSchema.parse(input);
      const now = new Date().toISOString();
      const entry: WorldEntry = {
        id: crypto.randomUUID(),
        projectId: parsed.projectId,
        entryType: parsed.entryType,
        title: parsed.title,
        content: parsed.content,
        isLocked: parsed.isLocked,
        createdAt: now,
        updatedAt: now,
      };
      await database.execute(
        `INSERT INTO world_entries
          (id, project_id, entry_type, title, content, is_locked,
           created_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7, NULL)`,
        [
          entry.id,
          entry.projectId,
          entry.entryType,
          entry.title,
          entry.content,
          entry.isLocked ? 1 : 0,
          now,
        ],
      );
      return entry;
    },

    async updateWorldEntry(input) {
      const parsed = updateWorldEntryInputSchema.parse(input);
      const rows = await database.select<WorldEntryRow[]>(
        `SELECT id, project_id, entry_type, title, content, is_locked,
                created_at, updated_at
         FROM world_entries WHERE id = $1 LIMIT 1`,
        [parsed.id],
      );
      const current = rows[0] ? mapWorldEntry(rows[0]) : undefined;
      if (!current) throw new Error("世界观条目不存在");
      const updated: WorldEntry = {
        ...current,
        entryType: parsed.entryType ?? current.entryType,
        title: parsed.title ?? current.title,
        content: parsed.content ?? current.content,
        isLocked: parsed.isLocked ?? current.isLocked,
        updatedAt: new Date().toISOString(),
      };
      await database.execute(
        `UPDATE world_entries SET entry_type = $2, title = $3, content = $4,
         is_locked = $5, updated_at = $6 WHERE id = $1`,
        [
          updated.id,
          updated.entryType,
          updated.title,
          updated.content,
          updated.isLocked ? 1 : 0,
          updated.updatedAt,
        ],
      );
      return updated;
    },

    async deleteWorldEntry(id) {
      const result = await database.execute(
        `UPDATE world_entries SET deleted_at = $2, updated_at = $2
         WHERE id = $1 AND deleted_at IS NULL`,
        [id, new Date().toISOString()],
      );
      if (result.rowsAffected === 0) throw new Error("世界观条目不存在或已删除");
    },

    async listOutlineNodes(projectId) {
      const rows = await database.select<OutlineNodeRow[]>(
        `SELECT id, project_id, parent_id, node_type, title, content,
                sort_order, is_locked, created_at, updated_at
         FROM outline_nodes
         WHERE project_id = $1 AND deleted_at IS NULL
         ORDER BY sort_order ASC, created_at ASC`,
        [projectId],
      );
      return rows.map(mapOutlineNode);
    },

    async createOutlineNode(input) {
      const parsed = createOutlineNodeInputSchema.parse(input);
      let order = parsed.order;
      if (order === undefined) {
        const rows = await database.select<NextOrderRow[]>(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
           FROM outline_nodes WHERE project_id = $1 AND deleted_at IS NULL`,
          [parsed.projectId],
        );
        order = rows[0]?.next_order ?? 0;
      }
      const now = new Date().toISOString();
      const node: OutlineNode = {
        id: crypto.randomUUID(),
        projectId: parsed.projectId,
        nodeType: parsed.nodeType,
        title: parsed.title,
        content: parsed.content,
        order,
        isLocked: parsed.isLocked,
        createdAt: now,
        updatedAt: now,
        ...(parsed.parentId ? { parentId: parsed.parentId } : {}),
      };
      await database.execute(
        `INSERT INTO outline_nodes
          (id, project_id, parent_id, node_type, title, content, sort_order,
           is_locked, created_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, NULL)`,
        [
          node.id,
          node.projectId,
          node.parentId ?? null,
          node.nodeType,
          node.title,
          node.content,
          node.order,
          node.isLocked ? 1 : 0,
          now,
        ],
      );
      return node;
    },

    async updateOutlineNode(input) {
      const parsed = updateOutlineNodeInputSchema.parse(input);
      const rows = await database.select<OutlineNodeRow[]>(
        `SELECT id, project_id, parent_id, node_type, title, content,
                sort_order, is_locked, created_at, updated_at
         FROM outline_nodes WHERE id = $1 LIMIT 1`,
        [parsed.id],
      );
      const current = rows[0] ? mapOutlineNode(rows[0]) : undefined;
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
      if (parsed.parentId === undefined) {
        // Preserve the existing parent when omitted.
      } else if (parsed.parentId) {
        updated.parentId = parsed.parentId;
      }
      await database.execute(
        `UPDATE outline_nodes SET parent_id = $2, node_type = $3, title = $4,
         content = $5, sort_order = $6, is_locked = $7, updated_at = $8
         WHERE id = $1`,
        [
          updated.id,
          updated.parentId ?? null,
          updated.nodeType,
          updated.title,
          updated.content,
          updated.order,
          updated.isLocked ? 1 : 0,
          updated.updatedAt,
        ],
      );
      return updated;
    },

    async deleteOutlineNode(id) {
      const result = await database.execute(
        `UPDATE outline_nodes SET deleted_at = $2, updated_at = $2
         WHERE id = $1 AND deleted_at IS NULL`,
        [id, new Date().toISOString()],
      );
      if (result.rowsAffected === 0) throw new Error("大纲节点不存在或已删除");
    },
  };
}
