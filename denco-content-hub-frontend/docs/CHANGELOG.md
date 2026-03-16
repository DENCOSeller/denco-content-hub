# Changelog

## Sprint 5 — Companies

### Chunk 4: Frontend — Company store + API hooks + hey-api regenerate

**Цель**: Фронтенд-инфраструктура для компаний. Без UI изменений.

**Новые файлы:**

| Файл | Описание |
|------|----------|
| `src/stores/company-store.ts` | Zustand store: `activeCompany`, persist в cookie `active_company` (30 дней), hydrate при init |
| `src/api/hooks/useCompanies.ts` | TanStack Query hooks для Company CRUD (5 hooks, все enabled только для `is_platform_owner`) |

**Изменённые файлы:**

| Файл | Что изменено |
|------|-------------|
| `src/api/client/` | Регенерация hey-api — появились типы `CompanyCreate`, `CompanyUpdate`, `CompanyResponse`, `CompanyDetailResponse`, `PaginatedResponseCompanyResponse` и SDK-функции для 5 CRUD endpoints. `WorkspaceResponse` теперь содержит `company_id` и `company_name` |
| `src/stores/auth-store.ts` | Добавлено `is_platform_owner: boolean` в `User` interface (необходимо для `enabled` в hooks) |
| `src/components/providers/AppProviders.tsx` | Hydrate company store из cookie при инициализации приложения |

**Hooks:**

- `useCompaniesQuery(page, size, search)` — `GET /platform/companies` (paginated, с поиском)
- `useCompanyDetailQuery(companyId)` — `GET /platform/companies/{id}` (детали + статистика)
- `useCreateCompanyMutation()` — `POST /platform/companies`
- `useUpdateCompanyMutation()` — `PATCH /platform/companies/{id}`
- `useDeleteCompanyMutation()` — `DELETE /platform/companies/{id}`

Все мутации инвалидируют query key `['companies']`.

**Проверки**: `npx tsc --noEmit` — 0 ошибок, `npm run lint` — чисто.

---

### Chunk 5: Frontend — Company Switcher в header

**Цель**: Platform Owner видит dropdown с компаниями в header. При переключении выбранная компания сохраняется в store/cookie для client-side фильтрации workspace list. Закрывает fix #13 (state persistence).

**Новые файлы:**

| Файл | Описание |
|------|----------|
| `src/components/features/company/CompanySwitcher.tsx` | Select-dropdown: "Все компании" + список из `useCompaniesQuery()`. При выборе — `setActiveCompany()` → cookie persist. Показывается только для `is_platform_owner` |
| `src/components/features/company/CompanySwitcher.module.css` | Стили switcher: тёмная тема, `border-subtle`, hover с `neon-blue` |

**Изменённые файлы:**

| Файл | Что изменено |
|------|-------------|
| `src/app/(dashboard)/layout.tsx` | Добавлен `CompanySwitcher` в header между логотипом и user menu. Условный рендер: `user?.is_platform_owner && <CompanySwitcher />` |

**Поведение:**

- Platform owner: видит dropdown с компаниями в header, переключение сохраняется в cookie
- Обычный юзер: dropdown не отображается
- Refresh страницы: выбранная компания восстанавливается из cookie (hydration из Chunk 4)
- "Все компании" (value `null`) — сброс фильтра (`clearActiveCompany`)
- Client-side фильтрация: страницы могут читать `useCompanyStore().activeCompany` и фильтровать workspaces по `company_id`

**Проверки**: `npx tsc --noEmit` — 0 ошибок.

---

### Chunk 6: Frontend — Company management page

**Цель**: Platform Owner может создавать, редактировать, удалять компании через UI. Закрывает fix #14 (route protection) и fix #11 (default company deletion prevention на UI).

**Новые файлы:**

| Файл | Описание |
|------|----------|
| `src/app/(dashboard)/companies/page.tsx` | Страница управления компаниями: список с пагинацией и поиском, модалы Create/Edit/Delete. Client-side guard — non-platform-owner редиректится на `/library` |
| `src/app/(dashboard)/companies/companies.module.css` | Стили страницы: карточки компаний, заголовок с gradient, section title |

**Изменённые файлы:**

| Файл | Что изменено |
|------|-------------|
| `src/app/(dashboard)/layout.tsx` | Добавлен `IconBuilding` в импорт. Навигационная ссылка "Компании" (`/companies`) — условный рендер только для `is_platform_owner` |

**Функциональность:**

- **Список компаний**: карточки с названием, slug, датой создания. Пагинация и поиск через URL search params
- **Create**: модальное окно с формой (Zod + `@mantine/form`), валидация name (1–255 символов)
- **Edit**: модальное окно редактирования названия компании
- **Delete**: модальное окно подтверждения. Кнопка удаления не рендерится для default-компании (`is_default`)
- **Default badge**: компания с `is_default=true` помечена бейджем "Default" с `IconShieldStar`
- **Route guard**: `useEffect` проверяет `is_platform_owner`, редирект на `/library` если нет доступа. До загрузки user — `<LoadingState />`
- **Nav link**: "Компании" в sidebar, видна только platform owner

**Проверки**: `npx tsc --noEmit` — 0 ошибок.

---

**Sprint 5 — ЗАВЕРШЁН** (Chunks 4–6: frontend infrastructure, CompanySwitcher, Company management page)
