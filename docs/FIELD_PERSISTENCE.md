# Постоянство полей

| Поле | UI | DTO/API | Use case | Таблица.колонка | Тест |
|---|---|---|---|---|---|
| Клиент.название | форма | displayName | create/updateClient | clients.display_name | persistence |
| Клиент.контакт | форма | contactName | updateClient | clients.contact_name | persistence |
| Клиент.телефон | форма | phone | updateClient | clients.phone | persistence |
| Клиент.заметка | форма | notes | updateClient | clients.notes | persistence |
| Клиент.pin | кнопка | pinOrder | pinClient | clients.pin_order | — |
| Монтаж.название | карточка / редактор | title | create/updateInstallation | installations.title | persistence |
| Монтаж.доп инфа | плашка на Монтажи / редактор (полный текст) | summary | updateInstallation | installations.summary | persistence |
| Монтаж.заметки | плашка (клиент и Монтажи) / редактор | notes | updateInstallation | installations.notes | persistence |
| work_date | дата | workDate | create/update | installations.work_date | persistence |
| due_date | дата | dueDate | create/update | installations.due_date | persistence |
| price/cost/installation | деньги | *Input → minor | create/update | *_minor | persistence |
| этапы | StageGrid | enabled | setStage | installation_stages | persistence |
| completed | checkbox | completed | setCompleted | completed, completed_at | — |
| layout | настройки полей | fields | saveLayout | field_layouts | — |
| custom fields | настройки | define | defineCustomField | custom_field_definitions + values | — |
| cost service.name | раздел Себестоимость / пикер | name | create/updateCostService | cost_services.name | cost-services |
| cost service.price | раздел Себестоимость / пикер | priceInput → priceMinor | create/updateCostService | cost_services.price_minor | cost-services |
| cost service.category | колонка справочника | category | createCostService | cost_services.category | cost-services |
| UI prefs | настройки | value_json | settings.setJson | ui_preferences | — |
