import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  ensureRuntimeDirs,
  initializeNewDatabase,
  openExistingDatabase,
  readConfig,
  resolveWorkbookPaths,
  writeConfig,
} from "@workbook/infrastructure";
import {
  closeAppContext,
  createAppContext,
} from "./bootstrap/appContext.js";
import { startServer } from "./http/server.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function ensureDevData() {
  if (!process.env.WORKBOOK_DATA_DIR) {
    process.env.WORKBOOK_DATA_DIR = path.join(repoRoot, ".tmp", "dev-data");
  }
  process.env.WORKBOOK_TEST = "1";
  const paths = resolveWorkbookPaths(process.env);
  ensureRuntimeDirs(paths);

  const existing = readConfig(paths);
  if (existing && fs.existsSync(paths.dbPath)) {
    return existing.port;
  }

  let instanceId: string = randomUUID();
  if (!fs.existsSync(paths.dbPath)) {
    const db = initializeNewDatabase(paths.dbPath, {
      instanceId,
      appVersion: "1.0.0-dev",
      currencyCode: "RUB",
      currencyScale: 2,
    });
    db.close();
  } else {
    const opened = openExistingDatabase(paths.dbPath);
    instanceId = opened.instanceId;
    opened.db.close();
  }

  const port = Number(process.env.WORKBOOK_PORT ?? 4318);
  writeConfig(paths, {
    instanceId,
    dataPath: paths.dbPath,
    port,
    createdAt: new Date().toISOString(),
    defaultCurrencyCode: "RUB",
    defaultCurrencyScale: 2,
    externalBackupDir: null,
    schemaVersion: "001_initial",
  });
  return port;
}

async function main() {
  const port = ensureDevData();
  createAppContext();
  await startServer();
  console.log(
    `Dev-сервер: http://127.0.0.1:${port} (данные: ${process.env.WORKBOOK_DATA_DIR})`,
  );
}

main().catch((err) => {
  console.error(err);
  closeAppContext();
  process.exit(1);
});
