# Обновление и восстановление

1. `npm run app:update` — backup → stop → build; при грязном git — стоп.
2. `npm run app:backup` / `app:restore -- --file ... --confirm`.
3. Журнал: `%LOCALAPPDATA%\WorkNotebook\update-journal.jsonl`.

После допуска записей автоматический откат snapshot запрещён.
