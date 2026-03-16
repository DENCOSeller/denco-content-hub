# Стратегия: Перенос References и Settings внутрь Workspace

> Sprint 5, Chunk 4 — Frontend workspace-scoped content

---

## Проблема

Сейчас библиотека (`/library`) и настройки (`/settings`) — глобальные роуты, которые берут `workspaceId` из Zustand-стора (`activeWorkspace`). Это создаёт проблемы:

1. **Нет явной привязки к воркспейсу в URL** — нельзя шарить ссылку на библиотеку конкретного воркспейса
2. **Auto-select first workspace** — при отсутствии `activeWorkspace` выбирается первый воркспейс из списка, что может быть не тот, который нужен
3. **Два параллельных сайдбара** — в глобальном контексте сайдбар показывает `/library` и `/settings`, внутри воркспейса — `/workspaces/[id]/library` и `/workspaces/[id]/settings` (заглушки)
4. **Content detail** (`/library/[id]`) — тоже глобальный, без workspace scope в URL

---

## Ребрендинг: Библиотека → Референсы

Решение архитектора: переименовать "Библиотека" → "Референсы" на всех уровнях.

| Что | Было | Стало |
|-----|------|-------|
| Роут (workspace) | `/workspaces/[id]/library` | `/workspaces/[id]/references` |
| Роут (глобальный, redirect) | `/library` | оставить как redirect legacy |
| Роут (detail) | `/workspaces/[id]/library/[contentId]` | `/workspaces/[id]/references/[contentId]` |
| Сайдбар label | "Библиотека" | "Референсы" |
| Заголовок страницы | "Библиотека контента" | "Референсы" |
| Breadcrumbs | "Библиотека" | "Референсы" |
| Workspace Hub card | "Библиотека" + "Контент воркспейса" | "Референсы" + "Контент воркспейса" |
| Иконка | `IconLibrary` | `IconSearch` |
| Папка компонентов | `features/library/` | `features/references/` |

---

## Целевое состояние

```
/workspaces/[id]/references              — полные референсы (ex-библиотека)
/workspaces/[id]/references/[contentId]  — детальный просмотр контента
/workspaces/[id]/settings                — полные настройки

/library                                 — redirect → /workspaces/{activeId}/references
/library/[id]                            — redirect → /workspaces/{activeId}/references/[id]
/settings                                — redirect → /workspaces/{activeId}/settings
```

---

## Архитектурные решения

### 1. Откуда workspace берёт workspaceId

**Решение**: Из URL параметра `params.id` (уже так работает в `workspaces/[id]/layout.tsx`).

Layout `/workspaces/[id]/layout.tsx` уже:
- Валидирует ID
- Фетчит workspace detail
- Устанавливает `activeWorkspace` в стор
- Показывает loading/error states
- Редиректит на `/dashboard` при 403/404

Дочерние страницы получают `workspaceId` из `useParams()` — надёжно и shareable.

### 2. Что делать с глобальными /library и /settings

**Решение**: Превратить в redirect-страницы.

Логика:
1. Читаем `activeWorkspace` из стора
2. Если есть — `router.replace(/workspaces/${id}/references)`
3. Если нет — фетчим список воркспейсов, берём первый, редиректим
4. Если воркспейсов нет — показываем `EmptyState`

**Важно**: redirect должен пробрасывать `searchParams` (`?page=2&status=completed&search=...`), иначе пользователь теряет фильтры при переходе по старой ссылке.

### 3. Что делать с /library/[id] (content detail)

**Решение**: Перенести в `/workspaces/[id]/references/[contentId]/page.tsx`.

Старый `/library/[id]` станет redirect-страницей (аналогично /library).

Важно: сейчас `params.id` на `/library/[id]` — это contentId. В новом роуте — `params.id` это workspaceId, нужен второй параметр для контента.

### 4. Как изменится сайдбар

**Решение**: Убрать `/library` и `/settings` из общей навигации. В workspace навигации — переименовать.

Сейчас `generalLinks` в `layout.tsx`:
```
Главная → /dashboard
Библиотека → /library          ← УБРАТЬ
Настройки → /settings          ← УБРАТЬ
Компании → /companies          (оставить)
```

Сейчас `workspaceLinks` в `layout.tsx`:
```
Обзор → /workspaces/{id}
Библиотека → /workspaces/{id}/library      ← ПЕРЕИМЕНОВАТЬ + новый роут
Настройки → /workspaces/{id}/settings
```

### 5. CSS модули

**Файлы стилей**:
- `library.module.css` — используется в `/library/page.tsx` (страница-список)
- `content-detail.module.css` — используется в `/library/[id]/page.tsx` (детальная)
- `dashboard.module.css` — используется в `/settings/page.tsx` (классы `sectionTitle`, `gradientText`)

**Решение**: НЕ копировать CSS — переместить рядом с новыми страницами. Старые роуты станут redirect-страницами и CSS не используют. Стили для `TeamTab`/`InvitationsTab` (из `dashboard.module.css`) вынести в отдельный `settings.module.css`.

### 6. Компоненты-хелперы

Сейчас всё inline в page.tsx:
- `ContentRow` (library) — ~130 строк
- `TeamTab` (settings) — ~110 строк
- `InvitationsTab` (settings) — ~70 строк
- `extractYouTubeVideoId` — дублирован в library и library/[id]

**Решение**: Вынести в `src/components/features/`:
- `references/ContentRow.tsx` — компонент строки контента
- `settings/TeamTab.tsx` — таб команды
- `settings/InvitationsTab.tsx` — таб приглашений

Утилиты (`extractYouTubeVideoId`, `formatDuration`, `formatTimecode`) — в `src/lib/utils/youtube.ts`.

**НЕ выносить**: `ContentDetail` (детальная страница) — слишком завязана на layout/routing, оставить inline в page.tsx.

### 7. Ссылки внутри компонентов

**Полный список** мест с захардкоженными путями:

| Файл | Строка | Что | Новое |
|------|--------|-----|-------|
| `library/page.tsx:147` | `href={/library/${item.id}}` | Ссылка на контент | Перепишется в redirect |
| `library/[id]/page.tsx:163` | `router.push('/library')` | Кнопка "Назад" | Перепишется в redirect |
| `layout.tsx:60` | `/library` в generalLinks | Навигация | Убрать |
| `layout.tsx:61` | `/settings` в generalLinks | Навигация | Убрать |
| `layout.tsx:71` | `/workspaces/${id}/library` в workspaceLinks | Навигация workspace | → `/workspaces/${id}/references`, label "Референсы" |
| `workspaces/[id]/page.tsx:27-30` | SectionCard "Библиотека" + href library | Workspace Hub | → "Референсы" + href references |
| **`companies/page.tsx:337`** | `router.replace('/library')` | Guard redirect для не-platform-owner | → `router.replace('/dashboard')` |

### 8. Breadcrumbs

Workspace pages уже имеют breadcrumbs с `company → workspace → section`. Нужно сохранить этот паттерн, с label "Референсы" вместо "Библиотека".

### 9. Иконка

**Решение архитектора**: `IconSearch` из `@tabler/icons-react`.

---

## Риски

1. **Breaking bookmarks** — `/library` и `/library/[id]` redirect'ят на workspace-scoped. Прозрачно, но query params надо пробросить.
2. **Размер страниц** — `/library/page.tsx` сейчас 431 строка. При выносе компонентов уменьшится до ~100-150.
3. **Content detail routing** — `[id]` в новом роуте `/workspaces/[id]/references/[contentId]` требует уникальных имён. Next.js не позволяет два `[id]` в одном пути.
4. **`TranscriptionDrawer.tsx`** — существует в `features/library/`, нигде не импортируется сейчас. Оставить как есть — будет использован в следующих спринтах. Папку `features/library/` НЕ переименовывать и НЕ удалять.
5. **N+1 в ContentRow** — каждый `ContentRow` вызывает `useTranscriptionQuery` для статуса. Не в scope, но при выносе в компонент станет заметнее. Зафиксировать как tech debt.

---

## Не трогаем

- Backend API — все эндпоинты уже workspace-scoped (`/api/v1/workspaces/{id}/content/...`)
- API hooks — уже принимают `workspaceId` как параметр
- Zustand store — оставляем, layout уже его обновляет
- Middleware — без изменений
- `/companies` — остаётся глобальным (но fix redirect в нём)
