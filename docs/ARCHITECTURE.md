# Архитектура

Луковая модель: `UI → HTTP → application use cases → domain`. Infrastructure реализует порты application.

- `packages/domain` — чистые правила (деньги, сроки, этапы, поиск).
- `packages/application` — use cases и порты.
- `packages/infrastructure` — SQLite, backup, пути данных.
- `packages/contracts` — Zod-схемы API.
- `apps/server` — Fastify на `127.0.0.1`.
- `apps/web` — React SPA.

Подробности: `WORKBOOK_MASTER_SPEC.md` §9.
