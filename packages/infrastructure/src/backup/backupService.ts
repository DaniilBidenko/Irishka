import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createWriteStream, createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip, createGunzip } from "node:zlib";
import type { SqliteDb } from "../sqlite/connection.js";
import { openSqlite } from "../sqlite/connection.js";
import type { WorkbookPaths } from "../paths.js";

export type BackupManifest = {
  appVersion: string;
  schemaVersion: string;
  instanceId: string;
  createdAt: string;
  reason: string;
  dbSha256: string;
  sizeBytes: number;
};

function sha256File(filePath: string): string {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

export async function createVerifiedBackup(opts: {
  db: SqliteDb;
  paths: WorkbookPaths;
  appVersion: string;
  schemaVersion: string;
  instanceId: string;
  reason: string;
}): Promise<{ archivePath: string; manifest: BackupManifest }> {
  const { paths } = opts;
  fs.mkdirSync(paths.backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tempDir = path.join(paths.backupsDir, `.tmp-${stamp}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const snapshotPath = path.join(tempDir, "workbook.sqlite3");

  try {
    // Online Backup API via better-sqlite3
    await new Promise<void>((resolve, reject) => {
      opts.db.backup(snapshotPath)
        .then(() => resolve())
        .catch(reject);
    });

    const checkDb = openSqlite(snapshotPath);
    try {
      const integrity = checkDb.pragma("integrity_check") as Array<{
        integrity_check: string;
      }>;
      if (integrity[0]?.integrity_check !== "ok") {
        throw new Error(`integrity_check failed: ${JSON.stringify(integrity)}`);
      }
      const fk = checkDb.pragma("foreign_key_check") as unknown[];
      if (fk.length > 0) {
        throw new Error(`foreign_key_check failed: ${JSON.stringify(fk)}`);
      }
    } finally {
      checkDb.close();
    }

    const dbSha256 = sha256File(snapshotPath);
    const prefsPath = path.join(tempDir, "preferences-export.json");
    // portable settings snapshot (non-absolute)
    fs.writeFileSync(
      prefsPath,
      JSON.stringify({ exportedAt: new Date().toISOString() }),
      "utf8",
    );

    const manifest: BackupManifest = {
      appVersion: opts.appVersion,
      schemaVersion: opts.schemaVersion,
      instanceId: opts.instanceId,
      createdAt: new Date().toISOString(),
      reason: opts.reason,
      dbSha256,
      sizeBytes: fs.statSync(snapshotPath).size,
    };
    fs.writeFileSync(
      path.join(tempDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );

    const archiveName = `workbook-backup-${stamp}.zip`;
    const archiveTmp = path.join(paths.backupsDir, `${archiveName}.partial`);
    const archivePath = path.join(paths.backupsDir, archiveName);

    // Simple tar-like: gzip of concatenated files with lengths — use zip via manual pack
    // For Windows without extra deps: write a .wnbak (gzip json+db)
    const payload = {
      manifest,
      dbBase64: fs.readFileSync(snapshotPath).toString("base64"),
      preferences: JSON.parse(fs.readFileSync(prefsPath, "utf8")),
    };
    const jsonPath = path.join(tempDir, "payload.json");
    fs.writeFileSync(jsonPath, JSON.stringify(payload));
    await pipeline(
      createReadStream(jsonPath),
      createGzip(),
      createWriteStream(archiveTmp),
    );
    fs.renameSync(archiveTmp, archivePath);
    return { archivePath, manifest };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function restoreVerifiedBackup(opts: {
  archivePath: string;
  paths: WorkbookPaths;
  confirmed: boolean;
  expectedInstanceId?: string;
}): Promise<{ manifest: BackupManifest }> {
  if (!opts.confirmed) {
    throw new Error("Восстановление требует явного подтверждения");
  }
  if (!fs.existsSync(opts.archivePath)) {
    throw new Error(`Архив не найден: ${opts.archivePath}`);
  }

  const tempDir = path.join(opts.paths.backupsDir, `.restore-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const payloadPath = path.join(tempDir, "payload.json");

  try {
    await pipeline(
      createReadStream(opts.archivePath),
      createGunzip(),
      createWriteStream(payloadPath),
    );
    const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as {
      manifest: BackupManifest;
      dbBase64: string;
    };
    const manifest = payload.manifest;
    const restoredDb = path.join(tempDir, "workbook.sqlite3");
    fs.writeFileSync(restoredDb, Buffer.from(payload.dbBase64, "base64"));

    const hash = sha256File(restoredDb);
    if (hash !== manifest.dbSha256) {
      throw new Error("Checksum базы в архиве не совпадает");
    }

    const checkDb = openSqlite(restoredDb);
    try {
      const integrity = checkDb.pragma("integrity_check") as Array<{
        integrity_check: string;
      }>;
      if (integrity[0]?.integrity_check !== "ok") {
        throw new Error("Восстановленная база не прошла integrity_check");
      }
    } finally {
      checkDb.close();
    }

    // Evidence copy of current DB if present
    if (fs.existsSync(opts.paths.dbPath)) {
      const evidence = path.join(
        opts.paths.backupsDir,
        `pre-restore-evidence-${Date.now()}.sqlite3`,
      );
      fs.copyFileSync(opts.paths.dbPath, evidence);
      for (const side of ["-wal", "-shm"]) {
        const p = opts.paths.dbPath + side;
        if (fs.existsSync(p)) fs.copyFileSync(p, evidence + side);
      }
    }

    // Replace: remove WAL/SHM so they don't attach to restored file
    for (const side of ["", "-wal", "-shm"]) {
      const p = opts.paths.dbPath + side;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    fs.mkdirSync(opts.paths.dataDir, { recursive: true });
    const finalTmp = opts.paths.dbPath + ".restoring";
    fs.copyFileSync(restoredDb, finalTmp);
    fs.renameSync(finalTmp, opts.paths.dbPath);

    return { manifest };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
