import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createClient,
  createInstallation,
  listTrash,
  restoreClientBatch,
  restoreInstallation,
  trashClient,
  trashInstallation,
} from "../../packages/application/src/index.ts";
import {
  composePorts,
  initializeNewDatabase,
} from "../../packages/infrastructure/src/index.ts";

describe("trash", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-trash-"));
    process.env.WORKBOOK_DATA_DIR = dir;
    process.env.WORKBOOK_TEST = "1";
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("удаление клиента с монтажами одной партией и восстановление", () => {
    const dbPath = path.join(dir, "data", "workbook.sqlite3");
    const db = initializeNewDatabase(dbPath, {
      instanceId: randomUUID(),
      appVersion: "1.0.0",
      currencyCode: "RUB",
      currencyScale: 2,
    });
    const ports = composePorts(db);

    const client = createClient(ports, {
      kind: "corporate",
      displayName: "Студия Север",
    });
    const a = createInstallation(ports, {
      clientId: client.id,
      title: "Вывеска",
      workDate: "2026-03-01",
    });
    const b = createInstallation(ports, {
      clientId: client.id,
      title: "Оклейка",
      workDate: "2026-03-02",
    });
    trashInstallation(ports, b.id, b.revision);

    const { batchId, affectedInstallations } = trashClient(ports, client.id);
    expect(affectedInstallations).toBe(1);

    const trash = listTrash(ports);
    expect(trash.clients.some((c) => c.id === client.id)).toBe(true);
    expect(trash.installations.some((i) => i.id === a.id)).toBe(true);
    expect(trash.installations.some((i) => i.id === b.id)).toBe(true);

    restoreClientBatch(ports, batchId);
    expect(ports.clients.findById(client.id)).not.toBeNull();
    expect(ports.installations.findById(a.id)).not.toBeNull();
    // b was trashed earlier with another batch — not restored by client batch
    expect(ports.installations.findById(b.id)).toBeNull();

    restoreInstallation(ports, b.id);
    expect(ports.installations.findById(b.id)?.title).toBe("Оклейка");

    db.close();
  });
});
