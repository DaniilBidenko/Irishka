#!/usr/bin/env node
/**
 * Одна команда первого запуска: зависимости → установка → старт.
 * Без вопросов. Повторный запуск: npm run app:start или ярлык.
 */
import { spawnSync } from "node:child_process";
import {
  REPO_ROOT,
  pauseIfWindows,
} from "../lib/paths.mjs";

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(`Команда не удалась: ${cmd} ${args.join(" ")}`);
  }
}

function main() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) {
    throw new Error(`Нужен Node.js 22+, сейчас ${process.versions.node}`);
  }

  console.log("1/3 Установка зависимостей (npm ci)…\n");
  run("npm", ["ci"]);

  console.log("\n2/3 Установка тетради (сборка, база, ярлыки)…\n");
  run("npm", ["run", "app:setup"]);

  console.log("\n3/3 Запуск…\n");
  run("npm", ["run", "app:start"]);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  pauseIfWindows();
  process.exit(1);
}
