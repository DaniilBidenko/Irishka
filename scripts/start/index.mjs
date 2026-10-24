#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  pauseIfWindows,
  readConfig,
  resolvePaths,
} from "../lib/paths.mjs";

async function alreadyRunning(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/identity`);
    if (!res.ok) return false;
    const j = await res.json();
    return j.name === "WorkNotebook";
  } catch {
    return false;
  }
}

async function main() {
  const paths = resolvePaths();
  const config = readConfig(paths);
  if (!config) {
    throw new Error("Сначала выполните npm run app:setup");
  }
  if (!fs.existsSync(paths.dbPath)) {
    throw new Error(
      `База не найдена: ${paths.dbPath}. Пустая база не создаётся. Восстановите копию.`,
    );
  }

  process.env.WORKBOOK_DATA_DIR = paths.root;
  const port = config.port || 4318;

  if (await alreadyRunning(port)) {
    console.log("Тетрадь уже запущена, открываю браузер…");
    openBrowser(port);
    return;
  }

  // Check if port occupied by stranger
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    if (res) {
      throw new Error(
        `Порт ${port} занят другой программой. Не убиваем чужой процесс. Укажите другой порт в config явно.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("занят")) throw e;
  }

  const entry = path.join(REPO_ROOT, "apps/server/dist/index.js");
  if (!fs.existsSync(entry)) {
    throw new Error("Сервер не собран. Выполните npm run build или app:setup");
  }

  const logFile = path.join(paths.logsDir, "server.log");
  fs.mkdirSync(paths.logsDir, { recursive: true });
  const out = fs.openSync(logFile, "a");
  const child = spawn(process.execPath, [entry], {
    cwd: REPO_ROOT,
    env: { ...process.env, WORKBOOK_DATA_DIR: paths.root },
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  fs.mkdirSync(paths.runtimeDir, { recursive: true });
  fs.writeFileSync(paths.pidPath, String(child.pid));

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 300));
    if (await alreadyRunning(port)) {
      console.log(`Запущено: http://127.0.0.1:${port}`);
      openBrowser(port);
      return;
    }
  }
  throw new Error(
    `Сервер не ответил. Смотрите лог: ${logFile}`,
  );
}

function openBrowser(port) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", `http://127.0.0.1:${port}`], {
      detached: true,
      stdio: "ignore",
    }).unref();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  pauseIfWindows();
  process.exit(1);
});
