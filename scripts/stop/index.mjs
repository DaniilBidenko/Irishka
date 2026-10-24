#!/usr/bin/env node
import fs from "node:fs";
import { pauseIfWindows, resolvePaths } from "../lib/paths.mjs";

async function main() {
  const paths = resolvePaths();
  if (!fs.existsSync(paths.pidPath)) {
    console.log("PID-файл не найден — возможно, сервер уже остановлен.");
    return;
  }
  const pid = Number(fs.readFileSync(paths.pidPath, "utf8").trim());
  if (!pid) {
    console.log("Некорректный PID");
    return;
  }

  // Verify identity before kill
  try {
    const config = JSON.parse(fs.readFileSync(paths.configPath, "utf8"));
    const res = await fetch(
      `http://127.0.0.1:${config.port || 4318}/api/v1/identity`,
    );
    const j = await res.json();
    if (j.name !== "WorkNotebook") {
      throw new Error("На порту не наша тетрадь — процесс не останавливаем");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("не наша")) throw e;
  }

  try {
    process.kill(pid);
    console.log(`Остановлен процесс ${pid}`);
  } catch {
    console.log("Процесс уже не существует");
  }
  try {
    fs.unlinkSync(paths.pidPath);
  } catch {
    /* ignore */
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  pauseIfWindows();
  process.exit(1);
});
