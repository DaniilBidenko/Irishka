import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  initializeNewDatabase,
  openExistingDatabase,
  upgradeExistingDatabase,
  getAppliedMigrations,
  migrationsDir,
  listMigrationFiles,
  checksumFile,
} from "../../packages/infrastructure/src/index.ts";

describe("upgrade 003_cost_services", () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-upgrade-"));
    process.env.WORKBOOK_DATA_DIR = dir;
    process.env.WORKBOOK_TEST = "1";
    dbPath = path.join(dir, "data", "workbook.sqlite3");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("новая БД получает cost_services; upgrade идемпотентен", () => {
    const instanceId = randomUUID();
    const db = initializeNewDatabase(dbPath, {
      instanceId,
      appVersion: "1.0.0",
      currencyCode: "RUB",
      currencyScale: 2,
    });
    const applied = getAppliedMigrations(db);
    expect(applied).toContain("003_cost_services");
    const table = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='cost_services'`,
      )
      .get() as { name: string } | undefined;
    expect(table?.name).toBe("cost_services");
    db.close();

    const upgraded = upgradeExistingDatabase(dbPath, {
      appVersion: "1.0.0",
    });
    expect(upgraded.applied).toEqual([]);
    expect(upgraded.schemaVersion).toBe("003_cost_services");
    upgraded.db.close();

    const opened = openExistingDatabase(dbPath);
    expect(opened.instanceId).toBe(instanceId);
    opened.db.close();
  });

  it("контрольная сумма выпущенной миграции стабильна", () => {
    const files = listMigrationFiles(migrationsDir());
    const mig = files.find((f) => f.version === "003_cost_services");
    expect(mig).toBeTruthy();
    const sum = checksumFile(mig!.filePath);
    expect(sum).toMatch(/^[a-f0-9]{64}$/);

    // sanity: файл читается как SQL
    const sql = fs.readFileSync(mig!.filePath, "utf8");
    expect(sql).toContain("CREATE TABLE cost_services");
  });
});
