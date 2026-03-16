# Chunks: Перенос References и Settings внутрь Workspace

> **Важно**: chunk'и 2 и 3 можно деплоить отдельно, но полный user flow (без дублирования навигации) — только после chunk 4+5.

---

## Chunk 1: Утилиты и вынос компонентов

**Цель**: Создать переиспользуемые компоненты. Старые страницы НЕ трогаем (они будут полностью перезаписаны позже).

### Файлы создать

| Файл | Что | Откуда |
|------|-----|--------|
| `src/lib/utils/youtube.ts` | `extractYouTubeVideoId`, `formatDuration`, `formatTimecode` | Дублирован в `library/page.tsx` и `library/[id]/page.tsx` |
| `src/components/features/references/ContentRow.tsx` | Компонент строки контента. Принимает `item`, `workspaceId`, `basePath` (для формирования href). | Из `library/page.tsx` (строки 91-223) |
| `src/components/features/settings/TeamTab.tsx` | Таб "Команда". Принимает `workspaceId`. | Из `settings/page.tsx` (строки 73-236) |
| `src/components/features/settings/InvitationsTab.tsx` | Таб "Приглашения". Принимает `workspaceId`. | Из `settings/page.tsx` (строки 240-307) |
| `src/components/features/settings/constants.ts` | `roleLabelMap`, `roleColorMap`, `inviteSchema` | Из `settings/page.tsx` (строки 48-69) |

### Важно при выносе ContentRow

- `ContentRow` сейчас хардкодит `href={/library/${item.id}}`. Новый компонент должен принимать `basePath` prop:
  ```tsx
  href={`${basePath}/${item.id}`}
  ```
- CSS-классы `contentCard`, `thumbnail`, `videoId` из `library.module.css` → создать `ContentRow.module.css` рядом с компонентом.

### Важно при выносе TeamTab/InvitationsTab

- `TeamTab` использует `styles.sectionTitle` из `dashboard.module.css` → создать `TeamTab.module.css` (или inline стиль).
- `InvitationsTab` тоже использует `styles.sectionTitle` → аналогично.

### Файлы НЕ трогаем

- `library/page.tsx` — будет redirect (chunk 4)
- `library/[id]/page.tsx` — будет redirect (chunk 4)
- `settings/page.tsx` — будет redirect (chunk 4)

### Проверка
- Компоненты экспортируются без ошибок
- Нет circular dependencies
- Утилиты покрывают оба кейса URL-парсинга

---

## Chunk 2: Полные референсы внутри воркспейса

**Цель**: `/workspaces/[id]/references` показывает полный список контента. `/workspaces/[id]/references/[contentId]` — детальная страница.

### Файлы создать

| Файл | Что |
|------|-----|
| `src/app/(dashboard)/workspaces/[id]/references/page.tsx` | Список контента. `workspaceId` из `useParams().id`. Использует `ContentRow` из chunk 1. Breadcrumbs: company → workspace → Референсы. |
| `src/app/(dashboard)/workspaces/[id]/references/references.module.css` | Стили страницы-списка (из `library.module.css`, только page-level: `pageTitle`, `addForm`, `sectionTitle`) |
| `src/app/(dashboard)/workspaces/[id]/references/[contentId]/page.tsx` | Детальная страница. `workspaceId` из `params.id`, `contentId` из `params.contentId`. Кнопка "Назад" → `/workspaces/${wsId}/references`. |
| `src/app/(dashboard)/workspaces/[id]/references/[contentId]/content-detail.module.css` | Стили детальной (из `library/[id]/content-detail.module.css`) |

### Удалить

| Файл | Почему |
|------|--------|
| `src/app/(dashboard)/workspaces/[id]/library/page.tsx` | Заглушка, роут больше не нужен |

### Ключевые отличия от старого /library/page.tsx

```diff
- useWorkspacesQuery() + useWorkspaceStore + auto-select useEffect
+ const workspaceId = Number(useParams().id)  // из URL, не из стора

- <ContentRow item={item} workspaceId={wsId} />
+ <ContentRow item={item} workspaceId={wsId} basePath={`/workspaces/${wsId}/references`} />

- Title: "Библиотека контента"
+ Title: "Референсы"

+ Breadcrumbs: [company, workspace, "Референсы"]
```

### Ключевые отличия от старого /library/[id]/page.tsx

```diff
- const workspaceId = activeWorkspace?.id ?? 0  // из стора
+ const workspaceId = Number(params.id)          // из URL
+ const contentId = Number(params.contentId)     // новый param name

- router.push('/library')  // кнопка "Назад"
+ router.push(`/workspaces/${workspaceId}/references`)
```

### Проверка
- `/workspaces/1/references` — показывает контент
- `/workspaces/1/references/42` — показывает детальную страницу
- Кнопка "Назад" ведёт на `/workspaces/1/references`
- Добавление/удаление/retry работает
- `/workspaces/1/library` — 404 (заглушка удалена)

---

## Chunk 3: Полные настройки внутри воркспейса

**Цель**: `/workspaces/[id]/settings` показывает настройки вместо заглушки.

### Файлы перезаписать

| Файл | Что |
|------|-----|
| `src/app/(dashboard)/workspaces/[id]/settings/page.tsx` | Заглушку → полные настройки. `workspaceId` из `useParams().id`. Использует `TeamTab` и `InvitationsTab` из chunk 1. |

### Ключевые отличия от старого /settings/page.tsx

```diff
- useWorkspacesQuery() + useWorkspaceStore + auto-select useEffect
+ const workspaceId = Number(useParams().id)

- import styles from '../dashboard.module.css'
+ (стили через компоненты TeamTab/InvitationsTab)

+ Breadcrumbs: [company, workspace, "Настройки"]
```

### Проверка
- `/workspaces/1/settings` — показывает Team/Invitations
- Приглашение/удаление/отмена работает
- Сайдбар подсвечивает "Настройки"

---

## Chunk 4: Редиректы, сайдбар, Workspace Hub

**Цель**: Старые роуты → redirect. Сайдбар и Hub обновлены.

### Файлы перезаписать (→ redirect)

| Файл | Новая логика |
|------|-------------|
| `src/app/(dashboard)/library/page.tsx` | Redirect: `activeWorkspace` → `/workspaces/${id}/references` с пробросом `searchParams`. Fallback: fetch workspaces → первый → redirect. Нет воркспейсов → `EmptyState`. |
| `src/app/(dashboard)/library/[id]/page.tsx` | Redirect: `activeWorkspace` → `/workspaces/${wsId}/references/${params.id}`. |
| `src/app/(dashboard)/settings/page.tsx` | Redirect: `activeWorkspace` → `/workspaces/${wsId}/settings`. |

### Проброс searchParams (critical)

```tsx
// /library redirect должен сохранять фильтры
const search = searchParams.toString()
const target = `/workspaces/${wsId}/references${search ? `?${search}` : ''}`
router.replace(target)
```

Без этого: пользователь с закладкой `/library?status=completed&page=3` теряет фильтры.

### Файлы изменить

| Файл | Что |
|------|-----|
| `src/app/(dashboard)/layout.tsx` | 1) Убрать `/library`, `/settings` из `generalLinks`. 2) В `workspaceLinks`: `/workspaces/${id}/library` → `/workspaces/${id}/references`, label "Референсы", icon `IconSearch`. 3) Заменить импорт `IconLibrary` → `IconSearch`. |
| `src/app/(dashboard)/workspaces/[id]/page.tsx` | SectionCard: "Библиотека" → "Референсы", href → `/workspaces/${id}/references`, icon `IconSearch`. Заменить импорт `IconLibrary` → `IconSearch`. |
| `src/app/(dashboard)/companies/page.tsx` | Строка 337: `router.replace('/library')` → `router.replace('/dashboard')`. |

### Файлы удалить (мёртвый код)

| Файл | Почему |
|------|--------|
| `src/app/(dashboard)/library/library.module.css` | Redirect-страница не использует стили |
| `src/app/(dashboard)/library/[id]/content-detail.module.css` | Redirect-страница не использует стили |

### Проверка
- `/library` → redirect на `/workspaces/X/references`
- `/library?status=completed&page=2` → redirect с сохранением params
- `/library/42` → redirect на `/workspaces/X/references/42`
- `/settings` → redirect на `/workspaces/X/settings`
- Сайдбар на `/dashboard`: только "Главная" (+ "Компании" для platform owner)
- Сайдбар внутри workspace: "Обзор", "Референсы", "Настройки"
- Workspace Hub: карточка "Референсы" ведёт на `/workspaces/X/references`
- `/companies` guard redirect → `/dashboard` (не `/library`)

---

## Chunk 5: Cleanup

**Цель**: Удалить мёртвый код.

### Файлы проверить/удалить

| Действие | Файл |
|----------|------|
| Удалить заглушку (если не удалена в chunk 2) | `workspaces/[id]/library/` (вся папка) |
| НЕ трогать | `features/library/TranscriptionDrawer.tsx` + `.module.css` — будет использован в следующих спринтах |
| Убрать неиспользуемый `IconLibrary` import | `layout.tsx`, `workspaces/[id]/page.tsx` |
| Проверить `dashboard.module.css` | `sectionTitle`, `gradientText` — если больше не используются из settings redirect → убрать |

### Проверка
- `next build` без ошибок
- Нет unused imports warnings
- Все страницы рендерятся

---

## Зависимости между chunks

```
Chunk 1 (компоненты, утилиты)
    ↓
Chunk 2 (references в workspace) + Chunk 3 (settings в workspace)  ← параллельно
    ↓
Chunk 4 (redirects + сайдбар + hub + companies fix)  ← после 2 и 3
    ↓
Chunk 5 (cleanup)
```

**Деплой-стратегия**: Chunk 1 → (2+3 параллельно) → 4 → 5. Минимально деплоить: после chunk 4 (когда все роуты работают и навигация обновлена).

---

## Итого файлов

### Создать новые (~9)
- `src/lib/utils/youtube.ts`
- `src/components/features/references/ContentRow.tsx`
- `src/components/features/references/ContentRow.module.css`
- `src/components/features/settings/TeamTab.tsx`
- `src/components/features/settings/InvitationsTab.tsx`
- `src/components/features/settings/constants.ts`
- `src/app/(dashboard)/workspaces/[id]/references/page.tsx`
- `src/app/(dashboard)/workspaces/[id]/references/references.module.css`
- `src/app/(dashboard)/workspaces/[id]/references/[contentId]/page.tsx`
- `src/app/(dashboard)/workspaces/[id]/references/[contentId]/content-detail.module.css`

### Перезаписать существующие (~4)
- `src/app/(dashboard)/workspaces/[id]/settings/page.tsx` (заглушка → полные настройки)
- `src/app/(dashboard)/library/page.tsx` (полная → redirect)
- `src/app/(dashboard)/library/[id]/page.tsx` (полная → redirect)
- `src/app/(dashboard)/settings/page.tsx` (полная → redirect)

### Изменить (~3)
- `src/app/(dashboard)/layout.tsx` (сайдбар: убрать general links, rename workspace links)
- `src/app/(dashboard)/workspaces/[id]/page.tsx` (hub: rename + new route)
- `src/app/(dashboard)/companies/page.tsx` (fix redirect)

### Удалить (~3)
- `src/app/(dashboard)/workspaces/[id]/library/page.tsx` (заглушка)
- `src/app/(dashboard)/library/library.module.css` (после redirect)
- `src/app/(dashboard)/library/[id]/content-detail.module.css` (после redirect)

### НЕ трогать
- `src/components/features/library/TranscriptionDrawer.tsx` + `.module.css` — будет использован в следующих спринтах
