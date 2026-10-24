#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { stdin as input, stdout as output } from "node:process";
import {
  REPO_ROOT,
  ensureDirs,
  pauseIfWindows,
  readConfig,
  resolvePaths,
} from "../lib/paths.mjs";

async function main() {
  console.log("Первичная установка «Рабочая тетрадь»\n");

  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) {
    throw new Error(`Нужен Node.js 22+, сейчас ${process.versions.node}`);
  }

  const paths = resolvePaths();
  ensureDirs(paths);

  const existing = readConfig(paths);
  if (existing && fs.existsSync(paths.dbPath)) {
    console.log("Установка уже выполнена.");
    console.log(`Данные: ${paths.dbPath}`);
    console.log("Запуск: npm run app:start или ярлык «Рабочая тетрадь».");
    return;
  }

  if (existing && !fs.existsSync(paths.dbPath)) {
    throw new Error(
      `Конфигурация есть, но база отсутствует: ${paths.dbPath}\nПустая база не создаётся автоматически. Восстановите копию (npm run app:restore).`,
    );
  }

  const rl = readline.createInterface({ input, output });
  let currency = "RUB";
  let scale = 2;
  let externalBackupDir = null;
  try {
    const c = (await rl.question("Код валюты по умолчанию [RUB]: ")).trim();
    if (c) currency = c.toUpperCase();
    const s = (await rl.question("Знаков после запятой [2]: ")).trim();
    if (s) scale = Number(s);
    if (!Number.isInteger(scale) || scale < 0 || scale > 6) {
      throw new Error("Масштаб валюты: целое 0–6");
    }
    const ext = (
      await rl.question("Папка внешних копий (Enter — пропустить): ")
    ).trim();
    externalBackupDir = ext || null;
  } finally {
    rl.close();
  }

  console.log("Сборка…");
  const build = spawnSync("npm", ["run", "build"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: true,
  });
  if (build.status !== 0) throw new Error("Сборка не удалась");

  const infra = await import(
    pathToFileURL(
      path.join(REPO_ROOT, "packages/infrastructure/dist/index.js"),
    ).href
  );

  const instanceId = randomUUID();
  const db = infra.initializeNewDatabase(paths.dbPath, {
    instanceId,
    appVersion: "1.0.0",
    currencyCode: currency,
    currencyScale: scale,
  });
  db.close();

  infra.writeConfig(paths, {
    instanceId,
    dataPath: paths.dbPath,
    port: 4318,
    createdAt: new Date().toISOString(),
    defaultCurrencyCode: currency,
    defaultCurrencyScale: scale,
    externalBackupDir,
    schemaVersion: "001_initial",
  });

  writeLauncher(paths);
  writeShortcuts(paths);

  console.log("\nГотово.");
  console.log(`База: ${paths.dbPath}`);
  console.log("Запуск: npm run app:start");
}

function writeLauncher(paths) {
  const launcher = path.join(paths.launcherDir, "start.mjs");
  const content = `import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = ${JSON.stringify(REPO_ROOT)};
const dataRoot = ${JSON.stringify(paths.root)};
const port = 4318;
process.env.WORKBOOK_DATA_DIR = dataRoot;

async function alreadyRunning() {
  try {
    const res = await fetch("http://127.0.0.1:" + port + "/api/v1/identity");
    if (!res.ok) return false;
    const j = await res.json();
    return j.name === "WorkNotebook";
  } catch { return false; }
}

if (await alreadyRunning()) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", "http://127.0.0.1:" + port], { detached: true, stdio: "ignore" }).unref();
  }
  process.exit(0);
}

const serverEntry = path.join(root, "apps/server/dist/index.js");
const child = spawn(process.execPath, [serverEntry], {
  cwd: root,
  env: { ...process.env, WORKBOOK_DATA_DIR: dataRoot },
  detached: true,
  stdio: "ignore",
});
child.unref();
fs.mkdirSync(path.join(dataRoot, "runtime"), { recursive: true });
fs.writeFileSync(path.join(dataRoot, "runtime", "server.pid"), String(child.pid));
await new Promise(r => setTimeout(r, 1000));
if (process.platform === "win32") {
  spawn("cmd", ["/c", "start", "", "http://127.0.0.1:" + port], { detached: true, stdio: "ignore" }).unref();
}
`;
  fs.writeFileSync(launcher, content, "utf8");
}

function writeShortcuts(paths) {
  const desk = path.join(
    process.env.USERPROFILE || process.env.HOME || "",
    "Desktop",
  );
  const startBody = `node "${path.join(paths.launcherDir, "start.mjs")}"\nif errorlevel 1 pause`;
  const cmds = [
    ["Запустить тетрадь.cmd", startBody],
    [
      "Остановить тетрадь.cmd",
      `cd /d "${REPO_ROOT}"\nset WORKBOOK_DATA_DIR=${paths.root}\ncall npm run app:stop\nif errorlevel 1 pause`,
    ],
    [
      "Создать копию.cmd",
      `cd /d "${REPO_ROOT}"\nset WORKBOOK_DATA_DIR=${paths.root}\ncall npm run app:backup\npause`,
    ],
    [
      "Обновить тетрадь.cmd",
      `cd /d "${REPO_ROOT}"\nset WORKBOOK_DATA_DIR=${paths.root}\ncall npm run app:update\npause`,
    ],
  ];
  for (const [name, body] of cmds) {
    fs.writeFileSync(
      path.join(REPO_ROOT, name),
      `@echo off\nchcp 65001 >nul\n${body}\n`,
      "utf8",
    );
    if (fs.existsSync(desk)) {
      try {
        fs.writeFileSync(
          path.join(desk, name),
          `@echo off\nchcp 65001 >nul\n${body}\n`,
          "utf8",
        );
      } catch {
        console.warn("Не удалось записать на рабочий стол:", name);
      }
    }
  }
  if (fs.existsSync(desk)) {
    try {
      fs.writeFileSync(
        path.join(desk, "Рабочая тетрадь.cmd"),
        `@echo off\nchcp 65001 >nul\n${startBody}\n`,
        "utf8",
      );
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  pauseIfWindows();
  process.exit(1);
});
