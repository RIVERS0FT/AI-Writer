ALTER TABLE characters ADD COLUMN deleted_at TEXT;
ALTER TABLE world_entries ADD COLUMN deleted_at TEXT;
ALTER TABLE outline_nodes ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_characters_project_active
  ON characters(project_id, deleted_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_world_entries_project_active
  ON world_entries(project_id, deleted_at, entry_type, updated_at);
CREATE INDEX IF NOT EXISTS idx_outline_nodes_project_active_order
  ON outline_nodes(project_id, deleted_at, sort_order);
