-- schema v1 — initial workbook schema
-- Append-only: do not edit after release.

PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  app_version TEXT NOT NULL
);

CREATE TABLE app_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('corporate', 'retail')),
  display_name TEXT NOT NULL CHECK (length(display_name) >= 1 AND length(display_name) <= 200),
  contact_name TEXT,
  phone TEXT,
  notes TEXT,
  pin_order INTEGER,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  deletion_batch_id TEXT
);

CREATE INDEX idx_clients_kind_deleted ON clients(kind, deleted_at);
CREATE INDEX idx_clients_pin ON clients(kind, pin_order) WHERE deleted_at IS NULL AND pin_order IS NOT NULL;

CREATE TABLE installations (
  id TEXT PRIMARY KEY NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id),
  title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 200),
  summary TEXT,
  notes TEXT,
  work_date TEXT NOT NULL CHECK (length(work_date) = 10),
  due_date TEXT CHECK (due_date IS NULL OR length(due_date) = 10),
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  cost_minor INTEGER CHECK (cost_minor IS NULL OR cost_minor >= 0),
  installation_minor INTEGER CHECK (installation_minor IS NULL OR installation_minor >= 0),
  currency_code TEXT NOT NULL,
  currency_scale INTEGER NOT NULL CHECK (currency_scale >= 0 AND currency_scale <= 6),
  completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
  completed_at TEXT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  deletion_batch_id TEXT,
  normalized_search TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_installations_client_work ON installations(client_id, work_date, id);
CREATE INDEX idx_installations_completed_due ON installations(completed, due_date, id);
CREATE INDEX idx_installations_updated ON installations(updated_at, id);
CREATE INDEX idx_installations_deleted ON installations(deleted_at);

CREATE TABLE installation_stages (
  installation_id TEXT NOT NULL REFERENCES installations(id),
  stage_code TEXT NOT NULL CHECK (stage_code IN ('CRM', 'YOU', 'PP', 'MON', 'GV', 'SO')),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  PRIMARY KEY (installation_id, stage_code)
);

CREATE TABLE custom_field_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL CHECK (length(label) >= 1 AND length(label) <= 100),
  type TEXT NOT NULL CHECK (type IN ('text', 'multiline', 'number', 'date')),
  sort_order INTEGER NOT NULL,
  archived_at TEXT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE installation_custom_values (
  installation_id TEXT NOT NULL REFERENCES installations(id),
  field_id TEXT NOT NULL REFERENCES custom_field_definitions(id),
  value_text TEXT,
  value_number REAL,
  value_date TEXT,
  PRIMARY KEY (installation_id, field_id),
  CHECK (
    (value_text IS NOT NULL AND value_number IS NULL AND value_date IS NULL)
    OR (value_text IS NULL AND value_number IS NOT NULL AND value_date IS NULL)
    OR (value_text IS NULL AND value_number IS NULL AND value_date IS NOT NULL)
    OR (value_text IS NULL AND value_number IS NULL AND value_date IS NULL)
  )
);

CREATE TABLE ui_preferences (
  key TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL,
  value_json TEXT NOT NULL
);

CREATE TABLE field_layouts (
  layout_scope TEXT NOT NULL CHECK (layout_scope IN ('main', 'compact')),
  field_key TEXT NOT NULL,
  ord INTEGER NOT NULL,
  column_span INTEGER NOT NULL CHECK (column_span IN (3, 6, 12)),
  height INTEGER NOT NULL CHECK (height >= 1 AND height <= 40),
  layout_version INTEGER NOT NULL,
  PRIMARY KEY (layout_scope, field_key)
);

CREATE TABLE change_log (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  changed_fields_json TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  timestamp TEXT NOT NULL,
  operation_id TEXT
);

CREATE INDEX idx_change_log_entity ON change_log(entity_type, entity_id, timestamp);

CREATE TABLE processed_operations (
  operation_id TEXT PRIMARY KEY NOT NULL,
  result_json TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
