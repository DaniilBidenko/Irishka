import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export function resolvePaths(env = process.env) {
  if (env.WORKBOOK_DATA_DIR) {
    const root = path.resolve(env.WORKBOOK_DATA_DIR);
    return build(root);
  }
  const localAppData =
    env.LOCALAPPDATA ||
    (process.platform === "win32"
      ? path.join(os.homedir(), "AppData", "Local")
      : path.join(os.homedir(), ".local", "share"));
  return build(path.join(localAppData, "WorkNotebook"));
}

function build(root) {
  return {
    root,
    dataDir: path.join(root, "data"),
    dbPath: path.join(root, "data", "workbook.sqlite3"),
    backupsDir: path.join(root, "backups"),
    logsDir: path.join(root, "logs"),
    launcherDir: path.join(root, "launcher"),
    configDir: path.join(root, "config"),
    configPath: path.join(root, "config", "config.json"),
    releasesDir: path.join(root, "releases"),
    pidPath: path.join(root, "runtime", "server.pid"),
    runtimeDir: path.join(root, "runtime"),
  };
}

export function readConfig(paths) {
  if (!fs.existsSync(paths.configPath)) return null;
  return JSON.parse(fs.readFileSync(paths.configPath, "utf8"));
}

export function writeConfig(paths, config) {
  fs.mkdirSync(paths.configDir, { recursive: true });
  const tmp = `${paths.configPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
  fs.renameSync(tmp, paths.configPath);
}

export function ensureDirs(paths) {
  for (const d of [
    paths.dataDir,
    paths.backupsDir,
    paths.logsDir,
    paths.launcherDir,
    paths.configDir,
    paths.releasesDir,
    paths.runtimeDir,
  ]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export function pauseIfWindows() {
  if (process.platform === "win32" && process.env.WORKBOOK_NO_PAUSE !== "1") {
    console.log("\nНажмите Enter, чтобы закрыть окно…");
    try {
      fs.readSync(0, Buffer.alloc(1), 0, 1, null);
    } catch {
      // non-interactive
    }
  }
}
