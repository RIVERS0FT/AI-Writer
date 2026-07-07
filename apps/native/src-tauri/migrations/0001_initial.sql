PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  genre TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planning',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS volumes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  volume_id TEXT REFERENCES volumes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  content_json TEXT NOT NULL DEFAULT '{}',
  content_markdown TEXT NOT NULL DEFAULT '',
  plain_text TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chapter_versions (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  plain_text TEXT NOT NULL,
  change_type TEXT NOT NULL,
  change_reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(chapter_id, version)
);

CREATE TABLE IF NOT EXISTS outline_nodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES outline_nodes(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  profile TEXT NOT NULL DEFAULT '',
  motivation TEXT NOT NULL DEFAULT '',
  current_state TEXT NOT NULL DEFAULT '',
  is_locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS character_states (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  state_type TEXT NOT NULL,
  value_json TEXT NOT NULL,
  valid_from_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  valid_to_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  source_id TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS character_knowledge (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  fact_memory_id TEXT NOT NULL,
  learned_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  source_character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  certainty REAL NOT NULL DEFAULT 1.0,
  is_belief INTEGER NOT NULL DEFAULT 0,
  is_true INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  to_character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  strength REAL NOT NULL DEFAULT 0.5,
  trust REAL NOT NULL DEFAULT 0.5,
  public_relation TEXT,
  true_relation TEXT,
  valid_from_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  valid_to_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  parent_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS story_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  scene_id TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  event_type TEXT NOT NULL,
  participants_json TEXT NOT NULL DEFAULT '[]',
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  item_ids_json TEXT NOT NULL DEFAULT '[]',
  story_time TEXT,
  duration TEXT,
  causes_json TEXT NOT NULL DEFAULT '[]',
  consequences_json TEXT NOT NULL DEFAULT '[]',
  importance REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  story_event_id TEXT REFERENCES story_events(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  story_time TEXT,
  end_time TEXT,
  duration TEXT,
  is_flashback INTEGER NOT NULL DEFAULT 0,
  is_dream INTEGER NOT NULL DEFAULT 0,
  is_hypothesis INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS foreshadowings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  introduced_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  planned_resolution_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  resolved_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  related_entity_ids_json TEXT NOT NULL DEFAULT '[]',
  appearance_count INTEGER NOT NULL DEFAULT 0,
  importance REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  base_url TEXT,
  api_key_ref TEXT,
  custom_headers_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_profiles (
  id TEXT PRIMARY KEY,
  provider_config_id TEXT NOT NULL REFERENCES provider_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  temperature REAL NOT NULL DEFAULT 0.8,
  top_p REAL,
  max_output_tokens INTEGER,
  context_window INTEGER,
  timeout_ms INTEGER NOT NULL DEFAULT 120000,
  max_retries INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  content TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  provider_config_id TEXT REFERENCES provider_configs(id) ON DELETE SET NULL,
  model_profile_id TEXT REFERENCES model_profiles(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  input_tokens INTEGER,
  output_tokens INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generation_steps (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT,
  output_json TEXT,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS generation_outputs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES generation_jobs(id) ON DELETE SET NULL,
  provider_config_id TEXT REFERENCES provider_configs(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_items (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  user_id TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL,
  subtype TEXT,
  title TEXT,
  content TEXT NOT NULL,
  structured_data TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT,
  source_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  importance REAL NOT NULL DEFAULT 0.5,
  confidence REAL NOT NULL DEFAULT 1.0,
  canonical_level INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  valid_from_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  valid_to_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS memory_sources (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  excerpt TEXT,
  start_offset INTEGER,
  end_offset INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_versions (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  structured_data TEXT,
  change_type TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  change_reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(memory_id, version)
);

CREATE TABLE IF NOT EXISTS memory_links (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  from_memory_id TEXT NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  to_memory_id TEXT NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  source_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_conflicts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  old_memory_id TEXT NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  new_memory_id TEXT REFERENCES memory_items(id) ON DELETE SET NULL,
  conflict_type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  resolution TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_feedback (
  id TEXT PRIMARY KEY,
  memory_id TEXT REFERENCES memory_items(id) ON DELETE CASCADE,
  retrieval_log_id TEXT,
  feedback_type TEXT NOT NULL,
  value REAL,
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS retrieval_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  query_text TEXT NOT NULL,
  retrieval_plan TEXT NOT NULL,
  candidate_count INTEGER NOT NULL,
  selected_memory_ids TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chapters_project_order ON chapters(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_character_states_current ON character_states(project_id, character_id, valid_to_chapter_id);
CREATE INDEX IF NOT EXISTS idx_story_events_project_time ON story_events(project_id, story_time);
CREATE INDEX IF NOT EXISTS idx_memory_project_type ON memory_items(project_id, memory_type, status);
CREATE INDEX IF NOT EXISTS idx_memory_user_type ON memory_items(user_id, memory_type, status);
CREATE INDEX IF NOT EXISTS idx_memory_source ON memory_items(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_memory_validity ON memory_items(project_id, valid_from_chapter_id, valid_to_chapter_id);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  memory_id UNINDEXED,
  project_id UNINDEXED,
  memory_type UNINDEXED,
  title,
  content,
  entity_names,
  keywords,
  tokenize = 'trigram'
);
