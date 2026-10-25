-- schema v2 — заменить этап GV (ГВ) на UR (УР), обновить CHECK
-- Append-only: do not edit after release.

PRAGMA foreign_keys = OFF;

UPDATE installation_stages SET stage_code = 'UR' WHERE stage_code = 'GV';

CREATE TABLE installation_stages_new (
  installation_id TEXT NOT NULL REFERENCES installations(id),
  stage_code TEXT NOT NULL CHECK (stage_code IN ('CRM', 'YOU', 'MON', 'SO', 'PP', 'UR')),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  PRIMARY KEY (installation_id, stage_code)
);

INSERT INTO installation_stages_new (installation_id, stage_code, enabled)
SELECT installation_id, stage_code, enabled FROM installation_stages;

DROP TABLE installation_stages;
ALTER TABLE installation_stages_new RENAME TO installation_stages;

PRAGMA foreign_keys = ON;

-- Для монтажей без строки UR (если GV не было) — не нужно: у каждого монтажа было ровно 6 строк включая GV→UR.
