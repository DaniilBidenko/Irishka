# Постоянство полей

| Поле | UI | DTO/API | Use case | Таблица.колонка | Тест |
|---|---|---|---|---|---|
| Клиент.название | форма | displayName | create/updateClient | clients.display_name | persistence |
| Клиент.контакт | форма | contactName | updateClient | clients.contact_name | persistence |
| Клиент.телефон | форма | phone | updateClient | clients.phone | persistence |
| Клиент.заметка | форма | notes | updateClient | clients.notes | persistence |
| Клиент.pin | кнопка | pinOrder | pinClient | clients.pin_order | — |
| Монтаж.название | редактор | title | create/updateInstallation | installations.title | persistence |
| Монтаж.кратко | редактор | summary | updateInstallation | installations.summary | persistence |
| Монтаж.заметки | редактор | notes | updateInstallation | installations.notes | persistence |
| work_date | дата | workDate | create/update | installations.work_date | persistence |
| due_date | дата | dueDate | create/update | installations.due_date | persistence |
| price/cost/installation | деньги | *Input → minor | create/update | *_minor | persistence |
| этапы | StageGrid | enabled | setStage | installation_stages | persistence |
| completed | checkbox | completed | setCompleted | completed, completed_at | — |
| layout | настройки полей | fields | saveLayout | field_layouts | — |
| custom fields | настройки | define | defineCustomField | custom_field_definitions + values | — |
| UI prefs | настройки | value_json | settings.setJson | ui_preferences | — |
