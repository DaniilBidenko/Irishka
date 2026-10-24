#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  REPO_ROOT,
  pauseIfWindows,
  readConfig,
  resolvePaths,
} from "../lib/paths.mjs";

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

async function main() {
  const file = argValue("--file");
  const confirmed =
    process.argv.includes("--confirm") || process.argv.includes("--yes");
  if (!file) {
    throw new Error(
      'Укажите файл: npm run app:restore -- --file "C:\\\\path\\\\backup.zip" --confirm',
    );
  }
  if (!confirmed) {
    throw new Error(
      "Восстановление требует явного --confirm. Состояние после даты копии будет потеряно.",
    );
  }

  const paths = resolvePaths();
  const config = readConfig(paths);
  if (!config) throw new Error("Нет конфигурации");
  process.env.WORKBOOK_DATA_DIR = paths.root;

  const infra = await import(
    pathToFileURL(
      path.join(REPO_ROOT, "packages/infrastructure/dist/index.js"),
    ).href
  );

  const { manifest } = await infra.restoreVerifiedBackup({
    archivePath: file,
    paths,
    confirmed: true,
  });
  console.log("Восстановлено из копии", manifest.createdAt);
  console.log("instance_id архива:", manifest.instanceId);
  console.log("Запустите npm run app:start и проверьте данные.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  pauseIfWindows();
  process.exit(1);
});
