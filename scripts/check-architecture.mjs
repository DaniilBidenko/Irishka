#!/usr/bin/env node
/**
 * Проверка направления зависимостей:
 * domain не импортирует application/infrastructure/apps
 * application не импортирует infrastructure/apps
 * web не импортирует infrastructure/server
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    if (name === "dist" || name === "node_modules") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) files.push(p);
  }
  return files;
}

function checkImports(file, forbidden) {
  const text = fs.readFileSync(file, "utf8");
  for (const bad of forbidden) {
    if (text.includes(bad)) {
      violations.push(`${path.relative(root, file)} → запрещённый импорт «${bad}»`);
    }
  }
}

for (const file of walk(path.join(root, "packages/domain/src"))) {
  checkImports(file, [
    "@workbook/application",
    "@workbook/infrastructure",
    "@workbook/server",
    "@workbook/web",
    "better-sqlite3",
    "fastify",
    "react",
  ]);
}

for (const file of walk(path.join(root, "packages/application/src"))) {
  checkImports(file, [
    "@workbook/infrastructure",
    "better-sqlite3",
    "fastify",
    "react",
  ]);
}

for (const file of walk(path.join(root, "apps/web/src"))) {
  checkImports(file, [
    "@workbook/infrastructure",
    "@workbook/server",
    "better-sqlite3",
  ]);
}

if (violations.length) {
  console.error("Архитектурные нарушения:");
  for (const v of violations) console.error(" -", v);
  process.exit(1);
}

console.log("lint:arch OK");
