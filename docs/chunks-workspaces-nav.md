# Chunks: Навигация по воркспейсам

> Зависимости: Chunk 1 → Chunk 2 → Chunk 3 (последовательно)
> Бэкенд: изменений НЕ требуется
> Scope: навигационный скелет. Перенос library/settings — следующий спринт.

---

## Chunk 1: Главная страница + создание воркспейса

**Цель**: `/dashboard` показывает карточки воркспейсов + модалка создания

### Файлы

| Действие | Файл | Что делать |
|----------|------|------------|
| Изменить | `app/(dashboard)/dashboard/page.tsx` | Убрать `redirect('/library')`. Grid карточек через `useWorkspacesQuery()`. Кнопка "+ Создать воркспейс" → открывает модалку |
| Создать | `components/features/workspace/WorkspaceCard.tsx` | Карточка воркспейса. Клик → `/workspaces/${id}` (hub) |
| Создать | `components/features/workspace/CreateWorkspaceModal.tsx` | Модалка: поле name + submit. `useCreateWorkspaceMutation` |
| Создать | `lib/validations/workspace.ts` | Zod: `createWorkspaceSchema` — name: string, 1-255 chars |
| Создать | `app/(dashboard)/dashboard/dashboard.module.css` | Стили grid карточек |
| Изменить | `api/hooks/useWorkspaces.ts` | Добавить `useCreateWorkspaceMutation` (POST /api/v1/workspaces). Invalidate `['workspaces']` on success |

### WorkspaceCard
```
- Название (name)
- Компания (company_name) — серый текст
- Badge роли (owner/admin/editor/viewer) — цвет по roleColorMap
- Badge "Личный" если is_personal
- Дата создания
- Клик → router.push(`/workspaces/${id}`) -- НА HUB, не на library
```

### CreateWorkspaceModal
```
- TextInput: name (required, 1-255)
- company_id: НЕ показываем (backend сам назначит)
- Submit → POST /api/v1/workspaces → close modal + invalidate queries
- Error handling → notification
```

### Состояния dashboard
- Loading → `<LoadingState />`
- Error → `<ErrorState onRetry={refetch} />`
- Пустой список → `<EmptyState message="Нет воркспейсов" />` (маловероятен — personal ws создаётся при регистрации)

### Проверить
- Карточки отображаются для всех воркспейсов пользователя
- Personal workspace показывается с бейджем "Личный"
- Кнопка "Создать" → модалка → создание → карточка появляется
- Клик карточки ведёт на `/workspaces/[id]` (пока 404 — ОК)
- Responsive: 1 колонка mobile, 2-3 desktop
- Старые роуты `/library`, `/settings` продолжают работать (не трогаем)

---

## Chunk 2: Workspace layout + hub-страница + заглушки разделов

**Цель**: `/workspaces/[id]` показывает hub с карточками разделов, `/workspaces/[id]/library` и `/settings` — заглушки

### Файлы

| Действие | Файл | Что делать |
|----------|------|------------|
| Создать | `app/(dashboard)/workspaces/[id]/layout.tsx` | Data loader: загружает workspace, обновляет store, обрабатывает ошибки. НЕ содержит AppShell/sidebar |
| Создать | `app/(dashboard)/workspaces/[id]/page.tsx` | Hub: заголовок + breadcrumbs + карточки разделов (Библиотека, Настройки) |
| Создать | `app/(dashboard)/workspaces/[id]/library/page.tsx` | Заглушка: breadcrumbs + "Библиотека — скоро" |
| Создать | `app/(dashboard)/workspaces/[id]/settings/page.tsx` | Заглушка: breadcrumbs + "Настройки — скоро" |
| Создать | `components/features/workspace/SectionCard.tsx` | Карточка раздела для hub-страницы |
| Создать | `components/shared/Breadcrumbs.tsx` | Breadcrumbs: company / workspace / section |
| Изменить | `api/hooks/useWorkspaces.ts` | Добавить `useWorkspaceDetailQuery(workspaceId)` — GET /api/v1/workspaces/{id} |

### Workspace layout логика
```
app/(dashboard)/workspaces/[id]/layout.tsx:
1. const params = useParams()
2. const workspaceId = Number(params.id)
3. Если NaN → redirect /dashboard
4. useWorkspaceDetailQuery(workspaceId)
5. Loading → <LoadingState /> (full page)
6. Error 403/404 → redirect /dashboard + notification
7. Success → setActiveWorkspace({ id, name, slug }) в store
8. Рендерит children
```

**Важно**: layout — `'use client'`. Используем `useParams()`, НЕ props.params (Next.js 15 async params).

### Hub-страница (`/workspaces/[id]/page.tsx`)
```
- Breadcrumbs: {company_name} / {workspace_name}
- Title: workspace.name
- Grid 2 колонки:
  - SectionCard "Библиотека" (IconLibrary) → /workspaces/[id]/library
  - SectionCard "Настройки" (IconSettings) → /workspaces/[id]/settings
```

### Breadcrumbs компонент
```
Props: items: Array<{ label: string, href?: string }>
Рендер: item1 / item2 / item3
Последний элемент — без ссылки (текущая страница)
Длинные имена — truncate (max-width: 200px)
```

### Breadcrumbs data flow
Workspace layout загружает WorkspaceResponse → store. Каждая страница строит breadcrumbs:
- Hub: [{ label: company_name }, { label: workspace_name }]
- Library: [{ label: company_name }, { label: workspace_name, href: `/workspaces/${id}` }, { label: "Библиотека" }]
- Settings: [{ label: company_name }, { label: workspace_name, href: `/workspaces/${id}` }, { label: "Настройки" }]

**Откуда данные**: workspace layout кладёт в store `{ id, name, slug, company_name }`. Страницы читают из store. Альтернатива — React context в workspace layout. **Рекомендация**: расширить workspace-store, добавив `company_name`.

### Проверить
- `/workspaces/1` — hub с карточками разделов + breadcrumbs
- `/workspaces/1/library` — заглушка + breadcrumbs
- `/workspaces/1/settings` — заглушка + breadcrumbs
- `/workspaces/999` — redirect на `/dashboard` + notification "Не найден"
- `/workspaces/abc` — redirect на `/dashboard`
- Карточка с Chunk 1 ведёт на hub
- Breadcrumbs: company / workspace / section

---

## Chunk 3: Адаптация сайдбара

**Цель**: сайдбар меняется в зависимости от контекста (вне/внутри воркспейса)

### Файлы

| Действие | Файл | Что делать |
|----------|------|------------|
| Изменить | `app/(dashboard)/layout.tsx` | Conditional sidebar по pathname. Workspace nav vs общий nav |

### Логика определения контекста
```ts
const pathname = usePathname()
const workspaceMatch = pathname.match(/^\/workspaces\/(\d+)/)
const isInWorkspace = !!workspaceMatch
const workspaceId = workspaceMatch ? Number(workspaceMatch[1]) : null
```

### Вне воркспейса (`/dashboard`, `/companies`)
```
Навигация
  Главная           -> /dashboard       (IconHome)
  Компании          -> /companies       (IconBuilding, platform owner only)
```

### Внутри воркспейса (`/workspaces/[id]/*`)
```
<- Все воркспейсы   -> /dashboard       (NavLink, variant="subtle")
---
{workspace.name}                         (Text, section header)
  Обзор             -> /workspaces/[id]           (IconLayoutDashboard)
  Библиотека        -> /workspaces/[id]/library    (IconLibrary)
  Настройки         -> /workspaces/[id]/settings   (IconSettings)
```

### Имя воркспейса в sidebar
Читаем из `useWorkspaceStore((s) => s.activeWorkspace?.name)`.

**Stale data edge case**: при навигации с `/workspaces/1` на `/workspaces/2`:
1. Pathname меняется → sidebar строит ссылки для id=2
2. workspace-store ещё содержит name от workspace 1
3. Workspace layout начинает загрузку workspace 2
4. Layout обновляет store → sidebar перерисовывается с правильным name

Мелькание ~200ms. Допустимо (переход между воркспейсами — редкий сценарий, обычно через dashboard). Если критично — можно показывать skeleton вместо name пока `store.id !== urlId`.

### Active state

| Pathname | Active link |
|----------|-------------|
| `/workspaces/[id]` | Обзор |
| `/workspaces/[id]/library` | Библиотека |
| `/workspaces/[id]/library/[contentId]` | Библиотека |
| `/workspaces/[id]/settings` | Настройки |

Логика:
```ts
// Exact match для Обзор
active={pathname === `/workspaces/${workspaceId}`}
// startsWith для разделов
active={pathname.startsWith(`/workspaces/${workspaceId}/library`)}
active={pathname.startsWith(`/workspaces/${workspaceId}/settings`)}
```

### Проверить
- На `/dashboard` — общий nav (Главная, Компании)
- На `/companies` — общий nav
- На `/workspaces/1` — workspace nav (← Назад, Обзор [active], Библиотека, Настройки)
- На `/workspaces/1/library` — workspace nav (Библиотека [active])
- На `/workspaces/1/settings` — workspace nav (Настройки [active])
- "← Все воркспейсы" ведёт на `/dashboard`
- Имя воркспейса отображается
- Mobile burger работает
- Старые роуты `/library`, `/settings` — сайдбар показывает общий nav (как раньше)

---

## Следующий спринт (НЕ в этом)

| Chunk | Описание |
|-------|----------|
| 4 | Перенос Library page в `/workspaces/[id]/library` (заменить заглушку) |
| 5 | Перенос Settings page в `/workspaces/[id]/settings` (заменить заглушку) |
| 6 | Редиректы `/library` → workspace, `/settings` → workspace. Cleanup store |

---

## Итого (этот спринт)

| Chunk | Файлов | Сложность | Описание |
|-------|--------|-----------|----------|
| 1 | 6 | Средняя | Dashboard: карточки воркспейсов + модалка создания |
| 2 | 7 | Средняя | Workspace layout + hub + заглушки + breadcrumbs |
| 3 | 1 | Средняя | Conditional sidebar (workspace nav vs общий) |

**Общий объём**: ~14 файлов, только фронтенд.
**Бэкенд**: 0 изменений.
**Старые роуты**: НЕ трогаем, работают параллельно.
