import type { Character, OutlineNode, WorldEntry } from "@ai-writer/core";
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

interface WorldRow {
  id: string;
  project_id: string;
  entry_type: string;
  title: string;
  content: string;
  is_locked: number;
  created_at: string;
  updated_at: string;
}

interface OutlineRow {
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

function aliases(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function character(row: CharacterRow): Character {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    aliases: aliases(row.aliases_json),
    profile: row.profile,
    motivation: row.motivation,
    currentState: row.current_state,
    isLocked: row.is_locked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function world(row: WorldRow): WorldEntry {
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

function outline(row: OutlineRow): OutlineNode {
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

export function createKnowledgeRepositoryBasic(
  database: Database,
): KnowledgeRepository {
  return {
    async listCharacters(projectId) {
      const rows = await database.select<CharacterRow[]>(
        `SELECT * FROM characters WHERE project_id = $1 ORDER BY updated_at DESC`,
        [projectId],
      );
      return rows.map(character);
    },
    async createCharacter(input) {
      const value = createCharacterInputSchema.parse(input);
      const now = new Date().toISOString();
      const item: Character = {
        id: crypto.randomUUID(),
        projectId: value.projectId,
        name: value.name,
        aliases: value.aliases,
        profile: value.profile,
        motivation: value.motivation,
        currentState: value.currentState,
        isLocked: value.isLocked,
        createdAt: now,
        updatedAt: now,
      };
      await database.execute(
        `INSERT INTO characters
         (id, project_id, name, aliases_json, profile, motivation, current_state,
          is_locked, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
        [item.id, item.projectId, item.name, JSON.stringify(item.aliases), item.profile,
          item.motivation, item.currentState, item.isLocked ? 1 : 0, now],
      );
      return item;
    },
    async updateCharacter(input) {
      const value = updateCharacterInputSchema.parse(input);
      const rows = await database.select<CharacterRow[]>(
        `SELECT * FROM characters WHERE id = $1 LIMIT 1`, [value.id],
      );
      const current = rows[0] ? character(rows[0]) : undefined;
      if (!current) throw new Error("人物不存在");
      const item: Character = {
        ...current,
        name: value.name ?? current.name,
        aliases: value.aliases ?? current.aliases,
        profile: value.profile ?? current.profile,
        motivation: value.motivation ?? current.motivation,
        currentState: value.currentState ?? current.currentState,
        isLocked: value.isLocked ?? current.isLocked,
        updatedAt: new Date().toISOString(),
      };
      await database.execute(
        `UPDATE characters SET name=$2, aliases_json=$3, profile=$4,
         motivation=$5, current_state=$6, is_locked=$7, updated_at=$8 WHERE id=$1`,
        [item.id, item.name, JSON.stringify(item.aliases), item.profile, item.motivation,
          item.currentState, item.isLocked ? 1 : 0, item.updatedAt],
      );
      return item;
    },
    async deleteCharacter(id) {
      await database.execute(`DELETE FROM characters WHERE id = $1`, [id]);
    },

    async listWorldEntries(projectId) {
      const rows = await database.select<WorldRow[]>(
        `SELECT * FROM world_entries WHERE project_id = $1 ORDER BY entry_type, updated_at DESC`,
        [projectId],
      );
      return rows.map(world);
    },
    async createWorldEntry(input) {
      const value = createWorldEntryInputSchema.parse(input);
      const now = new Date().toISOString();
      const item: WorldEntry = {
        id: crypto.randomUUID(), projectId: value.projectId,
        entryType: value.entryType, title: value.title, content: value.content,
        isLocked: value.isLocked, createdAt: now, updatedAt: now,
      };
      await database.execute(
        `INSERT INTO world_entries
         (id, project_id, entry_type, title, content, is_locked, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
        [item.id, item.projectId, item.entryType, item.title, item.content,
          item.isLocked ? 1 : 0, now],
      );
      return item;
    },
    async updateWorldEntry(input) {
      const value = updateWorldEntryInputSchema.parse(input);
      const rows = await database.select<WorldRow[]>(
        `SELECT * FROM world_entries WHERE id = $1 LIMIT 1`, [value.id],
      );
      const current = rows[0] ? world(rows[0]) : undefined;
      if (!current) throw new Error("世界观条目不存在");
      const item: WorldEntry = {
        ...current,
        entryType: value.entryType ?? current.entryType,
        title: value.title ?? current.title,
        content: value.content ?? current.content,
        isLocked: value.isLocked ?? current.isLocked,
        updatedAt: new Date().toISOString(),
      };
      await database.execute(
        `UPDATE world_entries SET entry_type=$2, title=$3, content=$4,
         is_locked=$5, updated_at=$6 WHERE id=$1`,
        [item.id, item.entryType, item.title, item.content,
          item.isLocked ? 1 : 0, item.updatedAt],
      );
      return item;
    },
    async deleteWorldEntry(id) {
      await database.execute(`DELETE FROM world_entries WHERE id = $1`, [id]);
    },

    async listOutlineNodes(projectId) {
      const rows = await database.select<OutlineRow[]>(
        `SELECT * FROM outline_nodes WHERE project_id = $1 ORDER BY sort_order, created_at`,
        [projectId],
      );
      return rows.map(outline);
    },
    async createOutlineNode(input) {
      const value = createOutlineNodeInputSchema.parse(input);
      const existing = await database.select<Array<{ next_order: number }>>(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
         FROM outline_nodes WHERE project_id = $1`, [value.projectId],
      );
      const now = new Date().toISOString();
      const item: OutlineNode = {
        id: crypto.randomUUID(), projectId: value.projectId,
        nodeType: value.nodeType, title: value.title, content: value.content,
        order: value.order ?? existing[0]?.next_order ?? 0,
        isLocked: value.isLocked, createdAt: now, updatedAt: now,
        ...(value.parentId ? { parentId: value.parentId } : {}),
      };
      await database.execute(
        `INSERT INTO outline_nodes
         (id, project_id, parent_id, node_type, title, content, sort_order,
          is_locked, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
        [item.id, item.projectId, item.parentId ?? null, item.nodeType, item.title,
          item.content, item.order, item.isLocked ? 1 : 0, now],
      );
      return item;
    },
    async updateOutlineNode(input) {
      const value = updateOutlineNodeInputSchema.parse(input);
      const rows = await database.select<OutlineRow[]>(
        `SELECT * FROM outline_nodes WHERE id = $1 LIMIT 1`, [value.id],
      );
      const current = rows[0] ? outline(rows[0]) : undefined;
      if (!current) throw new Error("大纲节点不存在");
      const item: OutlineNode = {
        ...current,
        nodeType: value.nodeType ?? current.nodeType,
        title: value.title ?? current.title,
        content: value.content ?? current.content,
        order: value.order ?? current.order,
        isLocked: value.isLocked ?? current.isLocked,
        updatedAt: new Date().toISOString(),
      };
      if (value.parentId !== undefined) item.parentId = value.parentId;
      await database.execute(
        `UPDATE outline_nodes SET parent_id=$2, node_type=$3, title=$4,
         content=$5, sort_order=$6, is_locked=$7, updated_at=$8 WHERE id=$1`,
        [item.id, item.parentId ?? null, item.nodeType, item.title, item.content,
          item.order, item.isLocked ? 1 : 0, item.updatedAt],
      );
      return item;
    },
    async deleteOutlineNode(id) {
      await database.execute(`DELETE FROM outline_nodes WHERE id = $1`, [id]);
    },
  };
}
