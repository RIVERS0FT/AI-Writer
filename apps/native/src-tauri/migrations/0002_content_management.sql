ALTER TABLE volumes ADD COLUMN deleted_at TEXT;
ALTER TABLE chapters ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_volumes_project_active_order
  ON volumes(project_id, deleted_at, sort_order);
CREATE INDEX IF NOT EXISTS idx_chapters_project_active_order
  ON chapters(project_id, deleted_at, volume_id, sort_order);
