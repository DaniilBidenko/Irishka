#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, readConfig, resolvePaths } from "../lib/paths.mjs";

async function main() {
  console.log("Диагностика (без изменения данных)\n");
  console.log("Node:", process.versions.node);
  console.log("Репозиторий:", REPO_ROOT);

  const paths = resolvePaths();
  console.log("DATA root:", paths.root);
  console.log("Config:", fs.existsSync(paths.configPath) ? "есть" : "нет");
  console.log("DB:", fs.existsSync(paths.dbPath) ? paths.dbPath : "не найдена");

  const config = readConfig(paths);
  if (config) {
    console.log("instance_id (config):", config.instanceId);
    console.log("port:", config.port);
  }

  if (fs.existsSync(paths.dbPath)) {
    try {
      const infra = await import(
        pathToFileURL(
          path.join(REPO_ROOT, "packages/infrastructure/dist/index.js"),
        ).href
      );
      const { db, instanceId } = infra.openExistingDatabase(paths.dbPath);
      const applied = infra.getAppliedMigrations(db);
      console.log("instance_id (db):", instanceId);
      console.log("schema:", applied.join(", ") || "—");
      const integrity = db.pragma("integrity_check");
      console.log("integrity_check:", JSON.stringify(integrity));
      db.close();
    } catch (e) {
      console.log("Ошибка открытия БД:", e instanceof Error ? e.message : e);
    }
  }

  try {
    const port = config?.port || 4318;
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    console.log("Сервер:", res.ok ? await res.json() : `HTTP ${res.status}`);
  } catch {
    console.log("Сервер: не запущен");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
