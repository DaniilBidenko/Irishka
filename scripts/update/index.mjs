#!/usr/bin/env node
/**
 * Безопасное обновление (раздел 13 ТЗ).
 * До появления version tags — обновление из текущего checkout с предупреждением.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  REPO_ROOT,
  pauseIfWindows,
  readConfig,
  resolvePaths,
} from "../lib/paths.mjs";

function journal(paths, entry) {
  fs.mkdirSync(paths.root, { recursive: true });
  fs.appendFileSync(
    path.join(paths.root, "update-journal.jsonl"),
    JSON.stringify({ ...entry, at: new Date().toISOString() }) + "\n",
  );
}

async function main() {
  const paths = resolvePaths();
  const config = readConfig(paths);
  if (!config) throw new Error("Нет конфигурации");

  journal(paths, { phase: "start" });

  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (status.status !== 0) {
    throw new Error("Git недоступен");
  }
  if (status.stdout.trim()) {
    throw new Error(
      "В исходниках есть локальные изменения. Обновление остановлено (без reset/clean).",
    );
  }

  console.log(
    "Канал по умолчанию — теги vX.Y.Z. До первого тега: сборка текущего commit с предупреждением разработчику.",
  );
  console.log("1) Предобновительный backup…");

  process.env.WORKBOOK_DATA_DIR = paths.root;
  const infra = await import(
    pathToFileURL(
      path.join(REPO_ROOT, "packages/infrastructure/dist/index.js"),
    ).href
  );
  // Backup до apply: открываем sqlite без проверки pending (иначе устаревшая схема блокирует backup).
  const dbForBackup = infra.openSqlite(paths.dbPath);
  let backupPath;
  let instanceId;
  try {
    const applied = infra.getAppliedMigrations(dbForBackup);
    const meta = dbForBackup
      .prepare(`SELECT value FROM app_metadata WHERE key = 'instance_id'`)
      .get();
    instanceId = meta?.value;
    if (!instanceId) throw new Error("В базе отсутствует instance_id");
    const backup = await infra.createVerifiedBackup({
      db: dbForBackup,
      paths,
      appVersion: "1.0.0",
      schemaVersion: applied[applied.length - 1] ?? "unknown",
      instanceId,
      reason: "pre-update",
    });
    backupPath = backup.archivePath;
    journal(paths, { phase: "backup-ok", backupPath });
    console.log("Backup:", backupPath);
  } finally {
    dbForBackup.close();
  }

  console.log("2) Остановка сервера…");
  spawnSync("npm", ["run", "app:stop"], {
    cwd: REPO_ROOT,
    shell: true,
    env: { ...process.env, WORKBOOK_DATA_DIR: paths.root },
  });

  console.log("3) Сборка…");
  const build = spawnSync("npm", ["run", "build"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: true,
  });
  if (build.status !== 0) {
    journal(paths, { phase: "build-failed", backupPath });
    throw new Error("Сборка не удалась. Рабочая БД не менялась. Backup: " + backupPath);
  }

  console.log("4) Применение ожидающих миграций (controlled)…");
  // После сборки — свежий import (cache-bust), чтобы взять новый код миграций.
  const infraAfter = await import(
    pathToFileURL(
      path.join(REPO_ROOT, "packages/infrastructure/dist/index.js"),
    ).href + `?t=${Date.now()}`
  );
  const upgraded = infraAfter.upgradeExistingDatabase(paths.dbPath, {
    appVersion: "1.0.0",
  });
  try {
    journal(paths, {
      phase: "migrate-ok",
      schemaVersion: upgraded.schemaVersion,
      applied: upgraded.applied,
      backupPath,
    });
    if (upgraded.applied.length) {
      console.log("Применены миграции:", upgraded.applied.join(", "));
    } else {
      console.log("Схема уже актуальна:", upgraded.schemaVersion);
    }
  } finally {
    upgraded.db.close();
  }

  journal(paths, { phase: "done", backupPath });
  console.log("Обновление завершено. Запустите npm run app:start");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  pauseIfWindows();
  process.exit(1);
});
