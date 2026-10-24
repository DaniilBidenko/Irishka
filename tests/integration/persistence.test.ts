import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createClient,
  createInstallation,
  setStage,
  updateInstallation,
} from "../../packages/application/src/index.ts";
import {
  composePorts,
  initializeNewDatabase,
  openExistingDatabase,
} from "../../packages/infrastructure/src/index.ts";

describe("persistence close/open", () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-test-"));
    process.env.WORKBOOK_DATA_DIR = dir;
    process.env.WORKBOOK_TEST = "1";
    dbPath = path.join(dir, "data", "workbook.sqlite3");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("поля, этапы и pin переживают переоткрытие БД", () => {
    const instanceId = randomUUID();
    let db = initializeNewDatabase(dbPath, {
      instanceId,
      appVersion: "1.0.0",
      currencyCode: "RUB",
      currencyScale: 2,
    });
    let ports = composePorts(db);

    const client = createClient(ports, {
      kind: "corporate",
      displayName: "Студия Север",
      phone: "+7 (900) 111-22-33",
    });
    const inst = createInstallation(ports, {
      clientId: client.id,
      title: "Вывеска на фасад",
      summary: "Кратко",
      workDate: "2026-03-15",
      dueDate: "2026-03-20",
      priceInput: "1500,50",
      notes: "Заметка с юникодом — ёлка",
    });
    const withStage = setStage(ports, inst.id, {
      revision: inst.revision,
      stage: "CRM",
      enabled: true,
    });
    updateInstallation(ports, withStage.id, {
      revision: withStage.revision,
      title: "Вывеска на фасад (обновл.)",
    });

    db.close();

    const opened = openExistingDatabase(dbPath);
    expect(opened.instanceId).toBe(instanceId);
    ports = composePorts(opened.db);

    const client2 = ports.clients.findById(client.id);
    expect(client2?.displayName).toBe("Студия Север");
    expect(client2?.phone).toBe("+7 (900) 111-22-33");

    const inst2 = ports.installations.findById(inst.id);
    expect(inst2?.title).toBe("Вывеска на фасад (обновл.)");
    expect(inst2?.priceMinor).toBe(150050);
    expect(inst2?.stages.CRM).toBe(true);
    expect(inst2?.stages.YOU).toBe(false);
    expect(inst2?.notes).toContain("ёлка");

    opened.db.close();
  });

  it("не создаёт пустую БД при отсутствии файла", () => {
    expect(() => openExistingDatabase(dbPath)).toThrow(/не найдена/i);
  });
});
