ALTER TABLE generation_jobs ADD COLUMN pipeline_version TEXT NOT NULL DEFAULT '1';
ALTER TABLE generation_jobs ADD COLUMN prompt_set_version TEXT NOT NULL DEFAULT '1';
ALTER TABLE generation_jobs ADD COLUMN instruction TEXT NOT NULL DEFAULT '';
ALTER TABLE generation_jobs ADD COLUMN options_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE generation_jobs ADD COLUMN started_at TEXT;
ALTER TABLE generation_jobs ADD COLUMN completed_at TEXT;

ALTER TABLE generation_steps ADD COLUMN step_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE generation_steps ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE generation_steps ADD COLUMN prompt_id TEXT;
ALTER TABLE generation_steps ADD COLUMN prompt_version TEXT;
ALTER TABLE generation_steps ADD COLUMN input_tokens INTEGER;
ALTER TABLE generation_steps ADD COLUMN output_tokens INTEGER;
ALTER TABLE generation_steps ADD COLUMN total_tokens INTEGER;
ALTER TABLE generation_steps ADD COLUMN usage_source TEXT;
ALTER TABLE generation_steps ADD COLUMN latency_ms INTEGER;
ALTER TABLE generation_steps ADD COLUMN context_snapshot_id TEXT;

CREATE TABLE IF NOT EXISTS generation_requests (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL REFERENCES generation_steps(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  provider_config_id TEXT REFERENCES provider_configs(id) ON DELETE SET NULL,
  model_profile_id TEXT REFERENCES model_profiles(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  task_type TEXT NOT NULL,
  step_type TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cached_input_tokens INTEGER,
  reasoning_tokens INTEGER,
  usage_source TEXT NOT NULL,
  latency_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

ALTER TABLE usage_records RENAME TO usage_records_legacy;

CREATE TABLE usage_records (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES generation_jobs(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  step_id TEXT REFERENCES generation_steps(id) ON DELETE SET NULL,
  request_id TEXT UNIQUE REFERENCES generation_requests(id) ON DELETE SET NULL,
  provider_config_id TEXT REFERENCES provider_configs(id) ON DELETE SET NULL,
  model_profile_id TEXT REFERENCES model_profiles(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  task_type TEXT,
  step_type TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'completed',
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  usage_source TEXT NOT NULL DEFAULT 'unknown',
  latency_ms INTEGER,
  estimated_cost REAL,
  created_at TEXT NOT NULL
);

INSERT INTO usage_records (
  id, job_id, project_id, chapter_id, provider_config_id,
  model_profile_id, model, task_type, step_type, attempt, status,
  input_tokens, output_tokens, total_tokens, usage_source,
  estimated_cost, created_at
)
SELECT
  legacy.id,
  legacy.job_id,
  job.project_id,
  job.chapter_id,
  legacy.provider_config_id,
  job.model_profile_id,
  legacy.model,
  job.task_type,
  'draft',
  1,
  'completed',
  CASE
    WHEN legacy.input_tokens = 0 AND legacy.output_tokens = 0 THEN NULL
    ELSE legacy.input_tokens
  END,
  CASE
    WHEN legacy.input_tokens = 0 AND legacy.output_tokens = 0 THEN NULL
    ELSE legacy.output_tokens
  END,
  CASE
    WHEN legacy.input_tokens = 0 AND legacy.output_tokens = 0 THEN NULL
    ELSE legacy.input_tokens + legacy.output_tokens
  END,
  CASE
    WHEN legacy.input_tokens = 0 AND legacy.output_tokens = 0 THEN 'unknown'
    ELSE 'provider'
  END,
  legacy.estimated_cost,
  legacy.created_at
FROM usage_records_legacy legacy
LEFT JOIN generation_jobs job ON job.id = legacy.job_id;

DROP TABLE usage_records_legacy;

CREATE INDEX IF NOT EXISTS idx_generation_steps_job_order
  ON generation_steps(job_id, step_order);
CREATE INDEX IF NOT EXISTS idx_generation_requests_job_started
  ON generation_requests(job_id, started_at);
CREATE INDEX IF NOT EXISTS idx_generation_requests_project_started
  ON generation_requests(project_id, started_at);
CREATE INDEX IF NOT EXISTS idx_generation_requests_chapter_started
  ON generation_requests(chapter_id, started_at);
CREATE INDEX IF NOT EXISTS idx_generation_requests_model_started
  ON generation_requests(model_profile_id, started_at);
CREATE INDEX IF NOT EXISTS idx_usage_records_project_created
  ON usage_records(project_id, created_at);
