import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "../../packages/application/src/index.ts";
import {
  composePorts,
  createVerifiedBackup,
  initializeNewDatabase,
  openExistingDatabase,
  resolveWorkbookPaths,
  restoreVerifiedBackup,
} from "../../packages/infrastructure/src/index.ts";

describe("backup/restore", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-bak-"));
    process.env.WORKBOOK_DATA_DIR = dir;
    process.env.WORKBOOK_TEST = "1";
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("восстанавливает данные из проверенного архива", async () => {
    const paths = resolveWorkbookPaths();
    const instanceId = randomUUID();
    let db = initializeNewDatabase(paths.dbPath, {
      instanceId,
      appVersion: "1.0.0",
      currencyCode: "RUB",
      currencyScale: 2,
    });
    let ports = composePorts(db);
    createClient(ports, { kind: "retail", displayName: "Ирина К." });

    const { archivePath, manifest } = await createVerifiedBackup({
      db,
      paths,
      appVersion: "1.0.0",
      schemaVersion: "001_initial",
      instanceId,
      reason: "test",
    });
    db.close();

    // wipe db
    fs.unlinkSync(paths.dbPath);
    for (const side of ["-wal", "-shm"]) {
      const p = paths.dbPath + side;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    await restoreVerifiedBackup({
      archivePath,
      paths,
      confirmed: true,
    });

    const opened = openExistingDatabase(paths.dbPath);
    ports = composePorts(opened.db);
    const list = ports.clients.listByKind("retail");
    expect(list.some((c) => c.displayName === "Ирина К.")).toBe(true);
    expect(opened.instanceId).toBe(manifest.instanceId);
    opened.db.close();
  });
});
