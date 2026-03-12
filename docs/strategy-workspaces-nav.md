# Стратегия: Навигация по воркспейсам

> Решения архитектора (2026-03-12) отмечены как **[РЕШЕНО]**

## Текущее состояние

### Бэкенд (готов, менять НЕ нужно)
- `GET /api/v1/workspaces` — список воркспейсов пользователя (`list[WorkspaceResponse]`: id, name, slug, is_personal, role, company_id, company_name, created_at)
- `GET /api/v1/workspaces/{workspace_id}` — детали воркспейса
- `POST /api/v1/workspaces` — создание воркспейса (`WorkspaceCreate`: name, optional company_id)
- Контент: `GET /api/v1/workspaces/{workspace_id}/content`
- Команда: `GET /api/v1/workspaces/{workspace_id}/members`
- Приглашения: `GET /api/v1/workspaces/{workspace_id}/invitations`
- **Все API уже workspace-scoped. Бэкенд менять не нужно.**

### Фронтенд (текущие проблемы)
1. **Плоский роутинг**: `/library`, `/settings`, `/companies`, `/dashboard`
2. **Нет выбора воркспейса**: автоматически выбирается первый из списка
3. **Нет карточек воркспейсов**: `/dashboard` сразу редиректит на `/library`
4. **Сайдбар статичный**: фиксированные ссылки (Главная, Библиотека, Настройки, Компании)
5. **workspace-store**: хранит activeWorkspace в cookie, но нет UI для переключения
6. **Контент-ссылки**: `/library/[id]` — не привязаны к воркспейсу в URL

---

## Целевое состояние

### Маршруты

| Маршрут | Что показывает |
|---------|----------------|
| `/dashboard` | Карточки воркспейсов + кнопка "Создать" |
| `/workspaces/[id]` | **Hub-страница**: заголовок + карточки разделов |
| `/workspaces/[id]/library` | Библиотека (заглушка в этом спринте) |
| `/workspaces/[id]/settings` | Настройки (заглушка в этом спринте) |
| `/companies` | Компании (без изменений, platform owner only) |

> **Scope**: в этом спринте — навигационный скелет. Перенос контента library/settings внутрь workspace routes — следующий спринт.

### Сайдбар

**Вне воркспейса** (`/dashboard`, `/companies`):
```
Навигация
  Главная           -> /dashboard
  Компании          -> /companies (platform owner only)
```

**Внутри воркспейса** (`/workspaces/[id]/*`):
```
<- Все воркспейсы   -> /dashboard
---
{workspace.name}
  Обзор             -> /workspaces/[id]
  Библиотека        -> /workspaces/[id]/library
  Настройки         -> /workspaces/[id]/settings
```

### Breadcrumbs **[РЕШЕНО: да]**

Расположение: над контентом, под header.
Формат: `{company_name} / {workspace_name} / {section_name}`

| Страница | Breadcrumb |
|----------|------------|
| `/workspaces/[id]` | Acme Inc / Marketing Team |
| `/workspaces/[id]/library` | Acme Inc / Marketing Team / Библиотека |
| `/workspaces/[id]/settings` | Acme Inc / Marketing Team / Настройки |

Данные: `company_name` и `name` из `WorkspaceResponse` (запрос в workspace layout).
Section name: derive из pathname (статичный маппинг).

### Главная страница (`/dashboard`)

- Grid карточек воркспейсов **[РЕШЕНО: `GET /workspaces`, только свои]**
- Personal workspace показывается с бейджем **[РЕШЕНО: показывать]**
- Кнопка "+ Создать воркспейс" → модалка **[РЕШЕНО: модалка]**
- Карточка: name, company_name, role badge, is_personal badge, created_at
- Клик карточки → `/workspaces/[id]` (hub, НЕ напрямую library)

### Hub-страница (`/workspaces/[id]`) **[РЕШЕНО]**

- Заголовок воркспейса (name)
- Breadcrumbs (Компания / Воркспейс)
- Карточки разделов:
  - Библиотека (клик → `/workspaces/[id]/library`)
  - Настройки (клик → `/workspaces/[id]/settings`)
- Простая страница, без бизнес-логики

---

## Архитектурные решения

### Решение 1: Источник правды для workspace_id **[РЕШЕНО: URL]**

`workspace_id` берётся из `useParams()` (Next.js App Router). НЕ из store.

**workspace-store** остаётся для "последний посещённый" — при заходе на `/dashboard` можно подсветить. Обновляется в workspace layout при каждом заходе.

### Решение 2: Layout-структура **[РЕШЕНО: один layout + pathname]**

~~Вариант A: вложенные layouts~~ — отклонён, т.к. sidebar живёт в dashboard layout и workspace layout не может его контролировать.

**Вариант B (финальный): один dashboard layout с условной логикой sidebar по pathname.**

```
app/(dashboard)/layout.tsx                         -- AppShell + conditional sidebar
app/(dashboard)/dashboard/page.tsx                 -- workspace cards
app/(dashboard)/workspaces/[id]/layout.tsx         -- workspace data loader (NO AppShell, NO sidebar)
app/(dashboard)/workspaces/[id]/page.tsx           -- hub: section cards
app/(dashboard)/workspaces/[id]/library/page.tsx   -- placeholder
app/(dashboard)/workspaces/[id]/settings/page.tsx  -- placeholder
```

Workspace layout: только загружает данные воркспейса (useWorkspaceDetailQuery), обновляет store, обрабатывает 403/404. Sidebar — в dashboard layout.

**Проблема stale data**: при навигации между воркспейсами sidebar читает имя из store, а layout ещё грузит новые данные. Решение: sidebar показывает имя из store, workspace layout обновляет store ДО рендера children (в useEffect). Кратковременное мелькание допустимо, т.к. навигация между воркспейсами — редкий сценарий (обычно через dashboard).

### Решение 3: Старые роуты `/library` и `/settings` **[ОТЛОЖЕНО]**

В этом спринте старые роуты **НЕ трогаем**. Они продолжают работать как раньше (через workspace-store). Перенос контента и редиректы — следующий спринт.

### Решение 4: Валидация workspace_id в URL

Workspace layout:
- `GET /api/v1/workspaces/{id}` через `useWorkspaceDetailQuery`
- 403 → redirect `/dashboard` + notification "Нет доступа"
- 404 → redirect `/dashboard` + notification "Воркспейс не найден"
- Нечисловой id → redirect `/dashboard`

### Решение 5: Переключатель воркспейсов **[РЕШЕНО: только "← Все воркспейсы"]**

Внутри воркспейса — кнопка "← Все воркспейсы" в sidebar. Без dropdown.

---

## Файлы для изменения (этот спринт)

### Новые файлы
1. `app/(dashboard)/workspaces/[id]/layout.tsx` — workspace data loader
2. `app/(dashboard)/workspaces/[id]/page.tsx` — **hub-страница с карточками разделов**
3. `app/(dashboard)/workspaces/[id]/library/page.tsx` — заглушка "Библиотека"
4. `app/(dashboard)/workspaces/[id]/settings/page.tsx` — заглушка "Настройки"
5. `components/features/workspace/WorkspaceCard.tsx` — карточка воркспейса (dashboard)
6. `components/features/workspace/SectionCard.tsx` — карточка раздела (hub)
7. `components/features/workspace/CreateWorkspaceModal.tsx` — модалка создания
8. `components/shared/Breadcrumbs.tsx` — breadcrumbs компонент
9. `lib/validations/workspace.ts` — Zod-схема (name: 1-255)
10. `app/(dashboard)/dashboard/dashboard.module.css` — стили grid

### Изменяемые файлы
1. `app/(dashboard)/layout.tsx` — conditional sidebar (workspace nav vs общий nav)
2. `app/(dashboard)/dashboard/page.tsx` — workspace cards grid + create button
3. `api/hooks/useWorkspaces.ts` — добавить `useWorkspaceDetailQuery`, `useCreateWorkspaceMutation`

### НЕ трогаем (этот спринт)
- `app/(dashboard)/library/*` — старые роуты, работают как раньше
- `app/(dashboard)/settings/page.tsx` — работает как раньше
- `stores/workspace-store.ts` — интерфейс не меняется, store обновляется из workspace layout
- `middleware.ts` — `/workspaces/*` уже protected (проверяет token на всех не-auth роутах)

### Бэкенд
**НЕ трогаем.** Все API уже готовы.

---

## Риски и edge-cases

1. **hey-api клиент**: `POST /api/v1/workspaces` — проверить что сгенерирована функция `createWorkspaceApiV1WorkspacesPost` (или аналог)
2. **Пустой список воркспейсов**: у нового пользователя может быть только personal workspace (auto-created при регистрации). EmptyState маловероятен, но нужен
3. **Mobile sidebar**: при переходе в workspace sidebar должен корректно переключать контент. Burger state сбрасывается при навигации — это ОК (Mantine default)
4. **Breadcrumbs overflow**: длинные имена компаний/воркспейсов — `truncate` или `max-width`
5. **Create modal для platform owner**: backend принимает optional `company_id`. Для обычного пользователя — скрыть поле (backend сам назначит). Для platform owner — показать select с компаниями? **Вопрос: нужен ли company select для platform owner?** (пока не критично, можно добавить позже)
6. **Next.js 15 params**: в App Router `useParams()` возвращает `{ id: string }`. Нужно `Number(params.id)` + валидация что это число
