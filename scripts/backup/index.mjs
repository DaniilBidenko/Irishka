#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  REPO_ROOT,
  pauseIfWindows,
  readConfig,
  resolvePaths,
} from "../lib/paths.mjs";

async function main() {
  const paths = resolvePaths();
  const config = readConfig(paths);
  if (!config) throw new Error("Нет конфигурации. Сначала app:setup");
  process.env.WORKBOOK_DATA_DIR = paths.root;

  const infra = await import(
    pathToFileURL(
      path.join(REPO_ROOT, "packages/infrastructure/dist/index.js"),
    ).href
  );
  const { db, instanceId } = infra.openExistingDatabase(paths.dbPath);
  try {
    const applied = infra.getAppliedMigrations(db);
    const result = await infra.createVerifiedBackup({
      db,
      paths,
      appVersion: "1.0.0",
      schemaVersion: applied[applied.length - 1] ?? "unknown",
      instanceId,
      reason: "manual-cli",
    });
    console.log("Копия создана:", result.archivePath);
    console.log("SHA-256:", result.manifest.dbSha256);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  pauseIfWindows();
  process.exit(1);
});
