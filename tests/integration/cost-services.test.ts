import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createCostService,
  trashCostService,
  updateCostService,
} from "../../packages/application/src/index.ts";
import {
  composePorts,
  initializeNewDatabase,
  openExistingDatabase,
} from "../../packages/infrastructure/src/index.ts";

describe("cost services persistence", () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-cost-"));
    process.env.WORKBOOK_DATA_DIR = dir;
    process.env.WORKBOOK_TEST = "1";
    dbPath = path.join(dir, "data", "workbook.sqlite3");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("услуги справочника переживают переоткрытие БД", () => {
    const instanceId = randomUUID();
    let db = initializeNewDatabase(dbPath, {
      instanceId,
      appVersion: "1.0.0",
      currencyCode: "RUB",
      currencyScale: 2,
    });
    let ports = composePorts(db);

    const created = createCostService(ports, {
      category: "polygraphy",
      name: "Визитки 1000",
      priceInput: "450,00",
    });
    expect(created.priceMinor).toBe(45000);

    const updated = updateCostService(ports, created.id, {
      revision: created.revision,
      name: "Визитки 1000 (матовые)",
      priceInput: "520,50",
    });
    expect(updated.name).toContain("матовые");
    expect(updated.priceMinor).toBe(52050);

    db.close();

    const opened = openExistingDatabase(dbPath);
    expect(opened.instanceId).toBe(instanceId);
    ports = composePorts(opened.db);

    const list = ports.costServices.list({ category: "polygraphy" });
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("Визитки 1000 (матовые)");
    expect(list[0]?.priceMinor).toBe(52050);

    trashCostService(ports, list[0]!.id, list[0]!.revision);
    expect(ports.costServices.list({ category: "polygraphy" })).toHaveLength(0);

    opened.db.close();
  });
});
