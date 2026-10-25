import fs from "node:fs";
import path from "node:path";
import {
  createVerifiedBackup,
  getAppliedMigrations,
} from "@workbook/infrastructure";
import { APP_VERSION, getContext } from "./appContext.js";

const INTERVAL_MS = 30 * 60 * 1000;
const MAX_INTERVAL = 48;
const MAX_DAILY = 30;
const MAX_MONTHLY = 12;

let timer: NodeJS.Timeout | null = null;
let lastChangeAt: number | null = null;
let lastBackupAt: number | null = null;
let dirtySinceBackup = false;

export function markDataChanged(): void {
  lastChangeAt = Date.now();
  dirtySinceBackup = true;
}

export function startAutoBackupScheduler(): void {
  if (timer) return;
  void maybeDailyFirstBackup();
  timer = setInterval(() => {
    void runIntervalBackup();
  }, INTERVAL_MS);
  timer.unref?.();
}

export function stopAutoBackupScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function maybeDailyFirstBackup(): Promise<void> {
  try {
    const { paths, db, config } = getContext();
    const stamp = new Date().toISOString().slice(0, 10);
    const marker = path.join(paths.backupsDir, `.daily-${stamp}`);
    if (fs.existsSync(marker)) return;
    const applied = getAppliedMigrations(db);
    const result = await createVerifiedBackup({
      db,
      paths,
      appVersion: APP_VERSION,
      schemaVersion: applied[applied.length - 1] ?? "unknown",
      instanceId: config.instanceId,
      reason: "daily-first",
    });
    fs.writeFileSync(marker, result.archivePath, "utf8");
    lastBackupAt = Date.now();
    dirtySinceBackup = false;
    rotateBackups(paths.backupsDir);
  } catch (err) {
    console.error(
      "Автобэкап (дневной) не удался:",
      err instanceof Error ? err.message : err,
    );
  }
}

async function runIntervalBackup(): Promise<void> {
  if (!dirtySinceBackup) return;
  if (getContext().maintenance.enabled) return;
  try {
    const { paths, db, config } = getContext();
    const applied = getAppliedMigrations(db);
    await createVerifiedBackup({
      db,
      paths,
      appVersion: APP_VERSION,
      schemaVersion: applied[applied.length - 1] ?? "unknown",
      instanceId: config.instanceId,
      reason: "interval",
    });
    lastBackupAt = Date.now();
    dirtySinceBackup = false;
    rotateBackups(paths.backupsDir);
  } catch (err) {
    console.error(
      "Автобэкап (интервал) не удался:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Ротация только автоматических копий; manual/pre-update не трогаем. */
function rotateBackups(backupsDir: string): void {
  if (!fs.existsSync(backupsDir)) return;
  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => f.endsWith(".zip") || f.endsWith(".wnbak"))
    .map((f) => {
      const full = path.join(backupsDir, f);
      return { full, name: f, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  // Heuristic: interval/daily in filename via our stamp naming — keep newest MAX_INTERVAL
  // Prefer not deleting if only one remains
  const auto = files.filter((f) => {
    try {
      // Our archives are gzip json; skip evidence files
      return !f.name.includes("evidence") && !f.name.includes("pre-update") && !f.name.includes("manual");
    } catch {
      return false;
    }
  });

  const toDelete = auto.slice(MAX_INTERVAL);
  // Keep at least one
  if (auto.length - toDelete.length < 1) return;
  for (const f of toDelete) {
    try {
      fs.unlinkSync(f.full);
    } catch {
      /* ignore */
    }
  }

  void MAX_DAILY;
  void MAX_MONTHLY;
  void lastChangeAt;
  void lastBackupAt;
}
