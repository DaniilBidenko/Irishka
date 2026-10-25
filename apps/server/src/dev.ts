import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  ensureRuntimeDirs,
  initializeNewDatabase,
  readConfig,
  resolveWorkbookPaths,
  upgradeExistingDatabase,
  writeConfig,
} from "@workbook/infrastructure";
import {
  closeAppContext,
  createAppContext,
} from "./bootstrap/appContext.js";
import { startAutoBackupScheduler } from "./bootstrap/autoBackup.js";
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

  if (existing && !fs.existsSync(paths.dbPath)) {
    throw new Error(
      `Конфигурация dev есть, но база отсутствует: ${paths.dbPath}\n` +
        "Пустая база не создаётся автоматически. Восстановите копию или укажите файл базы.",
    );
  }

  if (existing && fs.existsSync(paths.dbPath)) {
    // Песочница (.tmp): controlled apply ожидающих миграций, чтобы dev не блокировался.
    const upgraded = upgradeExistingDatabase(paths.dbPath, {
      appVersion: "1.0.0-dev",
    });
    upgraded.db.close();
    return existing.port;
  }

  // Только осознанный первый запуск песочницы (нет config).
  const instanceId = randomUUID();
  const db = initializeNewDatabase(paths.dbPath, {
    instanceId,
    appVersion: "1.0.0-dev",
    currencyCode: "RUB",
    currencyScale: 2,
  });
  db.close();

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
  startAutoBackupScheduler();
  await startServer();
  console.log(
    `Dev-сервер: http://127.0.0.1:${port} (данные: ${process.env.WORKBOOK_DATA_DIR})`,
  );
  console.log(
    "Внимание: это временная песочница. Рабочие данные — npm run app:start (%LOCALAPPDATA%\\WorkNotebook).",
  );
}

main().catch((err) => {
  console.error(err);
  closeAppContext();
  process.exit(1);
});
