# DENCO Content Hub — Roadmap

## Sprint 4 ✅ Done — Команды и воркспейсы
- [x] Chunk 1: Platform owner, invitation model
- [x] Chunk 2: Platform owner read-only access
- [x] Chunk 3: Platform admin API
- [x] Chunk 4: Transfer ownership
- [x] Chunk 5: Invitation service + repository
- [x] Chunk 6: Invitation API
- [x] Chunk 7: Auto-accept при register

## Sprint 5 ✅ Done — Organizations (Компании)
Добавлен уровень Company над Workspace (лёгкая группировка).
- [x] Таблица companies + company_id в workspaces
- [x] Company schemas и repository
- [x] CRUD API для компаний (platform owner)
- [x] UI: CompanySwitcher, страница управления компаниями

## Sprint 6 ✅ Done — Workspace Navigation
Навигационный скелет: dashboard с карточками воркспейсов, hub-страница, conditional sidebar. Только фронтенд.
- [x] Chunk 1: Dashboard — карточки воркспейсов + модалка создания
- [x] Chunk 2: Workspace layout + hub-страница + заглушки разделов + breadcrumbs
- [x] Chunk 3: Conditional sidebar (workspace nav vs общий nav)

## Sprint 7 ✅ Done — Workspace Content Migration
Перенос контента library/settings внутрь workspace routes. Ребрендинг "Библиотека" → "Референсы". Старые роуты → redirect.
- [x] Chunk 1: Утилиты и вынос компонентов (ContentRow, TeamTab, InvitationsTab, youtube utils)
- [x] Chunk 2: Полные референсы внутри воркспейса (`/workspaces/[id]/references` + detail page)
- [x] Chunk 3: Полные настройки внутри воркспейса (`/workspaces/[id]/settings`)
- [x] Chunk 4: Редиректы `/library` → workspace, сайдбар, Workspace Hub, cleanup CSS
- [x] Chunk 5: Cleanup — удаление мёртвого кода из `dashboard.module.css`

## Sprint 8 — Knowledge Base: структура и CRUD
База знаний двух уровней: компания (общая) и воркспейс (специфичная).

### Уровень Компании (общая база знаний)
- [ ] Описание компании, миссия, ценности
- [ ] Целевые аудитории (ЦА) с описанием
- [ ] Смыслы и ключевые сообщения для каждой ЦА
- [ ] SEO: ключевые слова, по которым находят
- [ ] Архитектура влияния и воронки (контентная, продажная)
- [ ] Позиционирование, УТП

### Уровень Воркспейса (специфичная база знаний)
- [ ] База знаний конкретного проекта/бренда
- [ ] Структурированные документы (не просто текст)

### Технически
- [ ] Модели и миграции (company_knowledge, workspace_knowledge)
- [ ] CRUD API для обоих уровней
- [ ] Версионирование изменений (история правок)
- [ ] UI: страницы просмотра и редактирования базы знаний

## Sprint 9 — Knowledge Base: AI-агент
AI-ассистент с доступом к базе знаний, редактирование через чат.

- [ ] Подключённые AI-ассистенты, которые читают базу знаний воркспейса
- [ ] Интеграция с Anthropic API (Claude)
- [ ] Редактирование базы знаний через чат с AI-агентом
- [ ] Стратегический маркетинг помощник (генерация смыслов, ЦА, позиционирования)
- [ ] AI-агент может редактировать базу прямо в интерфейсе

## Sprint 10 — Billing
- [ ] Подписки
- [ ] Оплата за компанию

## Будущие блоки (после продукт-маркет фит)
- CRM блок
- Управление проектами
- ERP
