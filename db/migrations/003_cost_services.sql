-- schema v3 — справочник услуг себестоимости (полиграфия / сувенирка / наружка)
-- Append-only: do not edit after release.

PRAGMA foreign_keys = ON;

CREATE TABLE cost_services (
  id TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('polygraphy', 'souvenirs', 'outdoor')),
  name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 200),
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency_code TEXT NOT NULL,
  currency_scale INTEGER NOT NULL CHECK (currency_scale >= 0 AND currency_scale <= 6),
  sort_order INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_cost_services_category
  ON cost_services(category, deleted_at, sort_order, name);
