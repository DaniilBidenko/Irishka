import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppPorts } from "@workbook/application";
import {
  assertSafeDataDir,
  composePorts,
  openExistingDatabase,
  readConfig,
  resolveWorkbookPaths,
  type AppConfig,
  type SqliteDb,
  type WorkbookPaths,
} from "@workbook/infrastructure";

export const APP_VERSION = "1.0.0";

export type AppContext = {
  paths: WorkbookPaths;
  config: AppConfig;
  db: SqliteDb;
  ports: AppPorts;
  maintenance: { enabled: boolean; reason: string | null };
  webDist: string | null;
};

let ctx: AppContext | null = null;

export function getContext(): AppContext {
  if (!ctx) throw new Error("Контекст приложения не инициализирован");
  return ctx;
}

export function setMaintenance(enabled: boolean, reason: string | null): void {
  const c = getContext();
  c.maintenance = { enabled, reason };
}

export function createAppContext(env: NodeJS.ProcessEnv = process.env): AppContext {
  const paths = resolveWorkbookPaths(env);
  assertSafeDataDir(paths, env);

  const config = readConfig(paths);
  if (!config) {
    throw new Error(
      "Конфигурация не найдена. Выполните npm run app:setup для первого запуска.",
    );
  }

  if (!fs.existsSync(config.dataPath) && !fs.existsSync(paths.dbPath)) {
    throw new Error(
      `База данных не найдена по пути ${config.dataPath || paths.dbPath}. Пустая база не создаётся автоматически. Используйте восстановление копии или укажите базу.`,
    );
  }

  const dbPath = fs.existsSync(paths.dbPath) ? paths.dbPath : config.dataPath;
  const { db, instanceId } = openExistingDatabase(dbPath);
  if (instanceId !== config.instanceId) {
    db.close();
    throw new Error(
      "instance_id базы не совпадает с конфигурацией. Остановка для защиты данных.",
    );
  }

  const ports = composePorts(db);
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const webDistCandidate = path.join(repoRoot, "apps", "web", "dist");
  const webDist = fs.existsSync(webDistCandidate) ? webDistCandidate : null;

  ctx = {
    paths,
    config,
    db,
    ports,
    maintenance: { enabled: false, reason: null },
    webDist,
  };
  return ctx;
}

export function closeAppContext(): void {
  if (ctx) {
    ctx.db.close();
    ctx = null;
  }
}
