import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type WorkbookPaths = {
  root: string;
  dataDir: string;
  dbPath: string;
  backupsDir: string;
  logsDir: string;
  launcherDir: string;
  configDir: string;
  configPath: string;
  releasesDir: string;
  updateJournalPath: string;
};

/** Пути независимы от cwd. Dev/test: WORKBOOK_DATA_DIR. */
export function resolveWorkbookPaths(env: NodeJS.ProcessEnv = process.env): WorkbookPaths {
  if (env.WORKBOOK_DATA_DIR) {
    const root = path.resolve(env.WORKBOOK_DATA_DIR);
    return buildPaths(root);
  }

  const localAppData =
    env.LOCALAPPDATA ||
    (process.platform === "win32"
      ? path.join(os.homedir(), "AppData", "Local")
      : path.join(os.homedir(), ".local", "share"));

  const root = path.join(localAppData, "WorkNotebook");
  return buildPaths(root);
}

function buildPaths(root: string): WorkbookPaths {
  const dataDir = path.join(root, "data");
  const configDir = path.join(root, "config");
  return {
    root,
    dataDir,
    dbPath: path.join(dataDir, "workbook.sqlite3"),
    backupsDir: path.join(root, "backups"),
    logsDir: path.join(root, "logs"),
    launcherDir: path.join(root, "launcher"),
    configDir,
    configPath: path.join(configDir, "config.json"),
    releasesDir: path.join(root, "releases"),
    updateJournalPath: path.join(root, "update-journal.jsonl"),
  };
}

export type AppConfig = {
  instanceId: string;
  dataPath: string;
  port: number;
  createdAt: string;
  defaultCurrencyCode: string;
  defaultCurrencyScale: number;
  externalBackupDir: string | null;
  schemaVersion: string;
};

export function readConfig(paths: WorkbookPaths): AppConfig | null {
  if (!fs.existsSync(paths.configPath)) return null;
  const raw = fs.readFileSync(paths.configPath, "utf8");
  return JSON.parse(raw) as AppConfig;
}

export function writeConfig(paths: WorkbookPaths, config: AppConfig): void {
  fs.mkdirSync(paths.configDir, { recursive: true });
  const tmp = `${paths.configPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
  fs.renameSync(tmp, paths.configPath);
}

export function ensureRuntimeDirs(paths: WorkbookPaths): void {
  for (const dir of [
    paths.dataDir,
    paths.backupsDir,
    paths.logsDir,
    paths.launcherDir,
    paths.configDir,
    paths.releasesDir,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Тесты отказываются работать с production DATA_DIR без явного флага. */
export function assertSafeDataDir(paths: WorkbookPaths, env: NodeJS.ProcessEnv = process.env): void {
  if (env.WORKBOOK_ALLOW_PRODUCTION_DATA === "1") return;
  if (env.NODE_ENV === "test" || env.VITEST || env.WORKBOOK_TEST === "1") {
    if (!env.WORKBOOK_DATA_DIR) {
      throw new Error(
        "Тесты требуют WORKBOOK_DATA_DIR (временный каталог). Production DATA_DIR запрещён.",
      );
    }
    const prodHint = path.join("WorkNotebook", "data");
    if (paths.dbPath.includes(prodHint) && !paths.root.includes(".tmp") && !paths.root.includes("temp")) {
      throw new Error("Отказ: тестовый запуск указывает на похожий на production DATA_DIR");
    }
  }
}
