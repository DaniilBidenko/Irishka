# IMPLEMENTATION_STATUS

Версия задания: WORKBOOK_MASTER_SPEC.md 1.0 · обновлено после первой реализации.

## Допущения

- Целевая ОС: Windows 11 x64.
- На машине разработки: Node.js **v22.17.1** (в ТЗ — LTS 24). Engines: `>=22`.
- Порт: `127.0.0.1:4318`.
- Origin репозитория: `https://github.com/DaniilBidenko/Irishka.git` (подставлен в START_HERE_RU.md).

## Прогресс этапов (§18)

| Этап | Статус |
|---|---|
| 1. Правила, структура, lockfile, check/test | сделано |
| 2. Domain/application, схема v1, persistence | сделано |
| 3. API, localhost security, launcher | сделано |
| 4. UI разделы и карточки | сделано (основной поток) |
| 5. Редактор, черновики, фильтры, корзина API | частично UI |
| 6. Backup/restore/update | сделано (update упрощён до первого тега) |
| 7. Проверки | unit+integration+arch+smoke API |
| 8. START_HERE_RU, docs | сделано |

## Проверенное

- `npm run build` — OK (domain…web…server).
- `npm test` — 10/10 (деньги, сроки, persistence close/open, backup/restore).
- `npm run check` — typecheck + lint:arch OK.
- Smoke API на временном DATA_DIR: session, health, create client/installation.
- better-sqlite3 установился на Windows x64 без отдельного компилятора.

## Осознанные пробелы относительно полной приёмки §19

- UI корзины / полного набора фильтров сроков/этапов / drag-layout полей — API и схема есть, UI урезан.
- Custom fields: API есть, отдельный экран настройки полей неполный.
- Multi-tab BroadcastChannel / полноценный 409-diff UI — базовая revision на API.
- Автобэкап по таймеру 30 мин / ротация 48·30·12 — ручной backup и pre-update есть; фоновый планировщик не вынесен в сервис.
- `app:update`: без dirty git, pre-backup, rebuild; полный staging worktree + tag channel — после появления `vX.Y.Z`.
- Playwright E2E: smoke; полный прогон матрицы §17 требует поднятого сервера и ручного визуала.
- Node 24 на этой машине не проверялся.

## Принцип

Код можно заменить; пользовательские данные — нет. Production DATA_DIR не трогался в тестах.
