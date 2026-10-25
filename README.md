# Рабочая тетрадь

Локальное приложение для ведения корпоративных и розничных клиентов и монтажей.

- UI + API: `http://127.0.0.1:4318`
- Данные: `%LOCALAPPDATA%\WorkNotebook\` (вне Git)
- ТЗ: [WORKBOOK_MASTER_SPEC.md](./WORKBOOK_MASTER_SPEC.md)
- Для пользователя: [START_HERE_RU.md](./START_HERE_RU.md)
- Правила Cursor: [AGENTS.md](./AGENTS.md)

## Разработка

```powershell
npm ci
npm run dev
```

Dev использует `.tmp/dev-data` (не production DATA_DIR).

```powershell
npm run check
npm test
npm run build
```

## Команды приложения

| Команда | Назначение |
|---|---|
| `npm run app:install` | первый запуск: зависимости + установка + старт (без вопросов) |
| `npm run app:setup` | только установка (без `npm ci` и без старта) |
| `npm run app:start` / `app:stop` | запуск / остановка |
| `npm run app:backup` / `app:restore` | копия / восстановление |
| `npm run app:update` | безопасное обновление |
| `npm run app:doctor` | диагностика |
