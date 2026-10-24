import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const STAGE_CODES = ["CRM", "YOU", "PP", "MON", "GV", "SO"] as const;

export type SqliteDb = Database.Database;

export function openSqlite(dbPath: string): SqliteDb {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = FULL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

export function migrationsDir(): string {
  // packages/infrastructure/src/sqlite -> repo/db/migrations
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../db/migrations");
}

export function checksumFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

export type ApplyMigrationsOptions = {
  appVersion: string;
  /** Explicit controlled apply (setup/update). Never auto on ordinary start. */
  allowApply: boolean;
};

export function getAppliedMigrations(db: SqliteDb): string[] {
  const exists = db
    .prepare(
      "SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='schema_migrations'",
    )
    .get() as { ok: number } | undefined;
  if (!exists) return [];
  const rows = db
    .prepare("SELECT version FROM schema_migrations ORDER BY version")
    .all() as Array<{ version: string }>;
  return rows.map((r) => r.version);
}

export function listMigrationFiles(dir: string): Array<{ version: string; filePath: string }> {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({
      version: f.replace(/\.sql$/, ""),
      filePath: path.join(dir, f),
    }));
}

/**
 * Применяет ожидающие миграции только при allowApply.
 * Обычный старт: проверка совместимости без применения.
 */
export function ensureSchema(
  db: SqliteDb,
  opts: ApplyMigrationsOptions,
): { schemaVersion: string; applied: string[] } {
  const files = listMigrationFiles(migrationsDir());
  const applied = getAppliedMigrations(db);
  const pending = files.filter((f) => !applied.includes(f.version));

  if (pending.length > 0 && !opts.allowApply) {
    if (applied.length === 0) {
      throw new Error(
        "База не инициализирована. Выполните npm run app:setup.",
      );
    }
    throw new Error(
      `Схема устарела (ожидают миграции: ${pending.map((p) => p.version).join(", ")}). Запустите безопасное обновление.`,
    );
  }

  const newly: string[] = [];
  if (pending.length > 0) {
    for (const mig of pending) {
      const sql = fs.readFileSync(mig.filePath, "utf8");
      const checksum = checksumFile(mig.filePath);
      const apply = db.transaction(() => {
        db.exec(sql);
        // 001_initial creates schema_migrations; subsequent migrations assume it exists
        db.prepare(
          `INSERT INTO schema_migrations (version, checksum, applied_at, app_version)
           VALUES (?, ?, ?, ?)`,
        ).run(mig.version, checksum, new Date().toISOString(), opts.appVersion);
      });
      apply();
      newly.push(mig.version);
    }
  } else {
    // verify checksums of applied
    for (const mig of files) {
      const row = db
        .prepare("SELECT checksum FROM schema_migrations WHERE version = ?")
        .get(mig.version) as { checksum: string } | undefined;
      if (row) {
        const current = checksumFile(mig.filePath);
        if (row.checksum !== current) {
          throw new Error(
            `Checksum миграции ${mig.version} изменился — выпущенные миграции нельзя редактировать`,
          );
        }
      }
    }
  }

  // Compatibility: code must not open newer unsupported schema for write — handled by app_metadata
  const all = getAppliedMigrations(db);
  const schemaVersion = all[all.length - 1] ?? "none";
  return { schemaVersion, applied: newly };
}

export function initializeNewDatabase(
  dbPath: string,
  opts: {
    instanceId: string;
    appVersion: string;
    currencyCode: string;
    currencyScale: number;
  },
): SqliteDb {
  if (fs.existsSync(dbPath)) {
    throw new Error(`База уже существует: ${dbPath}`);
  }
  const db = openSqlite(dbPath);
  ensureSchema(db, { allowApply: true, appVersion: opts.appVersion });
  db.prepare(
    `INSERT INTO app_metadata (key, value) VALUES ('instance_id', ?), ('created_at', ?), ('currency_code', ?), ('currency_scale', ?)`,
  ).run(
    opts.instanceId,
    new Date().toISOString(),
    opts.currencyCode,
    String(opts.currencyScale),
  );
  db.prepare(
    `INSERT INTO ui_preferences (key, version, value_json) VALUES ('deadline', 1, ?)`,
  ).run(JSON.stringify({ soonThresholdDays: 3 }));
  return db;
}

export function openExistingDatabase(dbPath: string): {
  db: SqliteDb;
  instanceId: string;
} {
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `База данных не найдена: ${dbPath}. Используйте «Найти базу» или «Восстановить копию». Пустая база не создаётся автоматически.`,
    );
  }
  const db = openSqlite(dbPath);
  // Ordinary start: do NOT apply migrations
  ensureSchema(db, { allowApply: false, appVersion: "runtime" });
  const row = db
    .prepare(`SELECT value FROM app_metadata WHERE key = 'instance_id'`)
    .get() as { value: string } | undefined;
  if (!row?.value) {
    throw new Error("В базе отсутствует instance_id");
  }
  return { db, instanceId: row.value };
}

export { STAGE_CODES };
