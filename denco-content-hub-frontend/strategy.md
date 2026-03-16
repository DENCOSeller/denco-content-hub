# Strategy — Sprint 1: Frontend Foundation

## Цель спринта

Запустить рабочий фронтенд DENCO Content Hub: Next.js 15 проект с аутентификацией, дашбордом и подключением к бэкенду.

**Результат:** пользователь может зарегистрироваться, войти, увидеть дашборд с AppShell, выйти.

---

## Backend API (уже работает)

**Base URL:** `http://localhost:8001/api/v1`

### Эндпоинты, которые нужны в Sprint 1

| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| `POST` | `/auth/register` | Регистрация | Нет |
| `POST` | `/auth/login` | Вход | Нет |
| `POST` | `/auth/refresh` | Обновление токенов | Нет |
| `POST` | `/auth/logout` | Выход | Bearer |
| `GET` | `/users/me` | Текущий пользователь | Bearer |
| `GET` | `/workspaces` | Список воркспейсов | Bearer |

### Ключевые модели ответов

```
TokenResponse:     { access_token, refresh_token, token_type }
UserResponse:      { id, email, name, is_active, created_at }
WorkspaceResponse: { id, name, slug, is_personal, role, created_at }
WorkspaceRole:     "owner" | "admin" | "editor" | "viewer" | "contractor"
```

### Аутентификация

- JWT Bearer Token (HS256)
- Access Token: 30 мин, Refresh Token: 7 дней
- Header: `Authorization: Bearer <token>`
- При 401 — refresh или редирект на /login

---

## Архитектура фронтенда

### Стек (из CLAUDE.md)

```
Next.js 15 (App Router) + TypeScript strict
Mantine UI + CSS Modules
Hey-api (автогенерация клиента)
TanStack Query v5 (серверный стейт)
Zustand (клиентский стейт — токены)
Zod (валидация форм)
```

### Маршруты Sprint 1

```
/              → редирект на /login или /dashboard
/login         → страница входа
/register      → страница регистрации
/dashboard     → главная дашборда (список воркспейсов)
```

### Структура файлов Sprint 1

```
src/
├── app/
│   ├── layout.tsx                    # Root layout + providers
│   ├── page.tsx                      # Редирект → /login или /dashboard
│   ├── (auth)/
│   │   ├── layout.tsx                # Центрированный layout для auth-страниц
│   │   ├── login/page.tsx            # Страница входа
│   │   └── register/page.tsx         # Страница регистрации
│   └── (dashboard)/
│       ├── layout.tsx                # AppShell (header + navbar + main)
│       └── page.tsx                  # Dashboard home
│
├── components/
│   ├── providers/
│   │   └── AppProviders.tsx          # Mantine + QueryClient + Notifications
│   ├── forms/
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   ├── layouts/
│   │   └── DashboardShell.tsx        # AppShell wrapper (вынесен из layout)
│   └── shared/
│       ├── LoadingState.tsx
│       ├── ErrorState.tsx
│       └── EmptyState.tsx
│
├── api/
│   ├── client/                       # Hey-api автогенерация (НЕ ТРОГАТЬ)
│   ├── hooks/
│   │   ├── useAuth.ts                # login, register, logout, refresh
│   │   ├── useUsers.ts               # useCurrentUser
│   │   └── useWorkspaces.ts          # useWorkspacesQuery
│   └── instance.ts                   # Base URL, interceptors, auth headers
│
├── lib/
│   ├── auth.ts                       # getAccessToken, setTokens, clearAuth
│   └── validations/
│       └── auth.ts                   # loginSchema, registerSchema (Zod)
│
├── stores/
│   └── auth-store.ts                 # Zustand: tokens + user
│
├── theme/
│   └── index.ts                      # Mantine theme config
│
└── middleware.ts                      # Auth guard: публичные/защищённые маршруты
```

---

## Ключевые решения

### 1. Хранение токенов

**Zustand store** (in-memory) + **localStorage** для persist между вкладками/рефрешами.

Почему не cookies: бэкенд ожидает `Authorization: Bearer` header, не cookie-based auth.

### 2. Hey-api клиент

Генерируем по OpenAPI-спеке бэкенда:
```bash
npx @hey-api/openapi-ts --input http://localhost:8001/openapi.json --output src/api/client
```

Все типы и сервисы — из автогенерации. Руками не пишем.

### 3. Interceptor-паттерн

`api/instance.ts` — единая точка для:
- Добавления `Authorization` header ко всем запросам
- Обработки 401 → попытка refresh → если не удалось → logout + redirect /login
- Base URL из `NEXT_PUBLIC_API_URL`

### 4. Auth flow

```
Регистрация/Логин
  → POST /auth/register или /auth/login
  → Получаем TokenResponse
  → Сохраняем в Zustand + localStorage
  → Redirect → /dashboard

Dashboard load
  → middleware.ts проверяет наличие токена
  → GET /users/me (TanStack Query)
  → GET /workspaces (TanStack Query)
  → Рендер AppShell + данные

Token refresh
  → При 401 ответе → POST /auth/refresh
  → Если OK → обновляем токены, повторяем запрос
  → Если fail → clearAuth → redirect /login

Logout
  → POST /auth/logout (отзыв токена на бэке)
  → clearAuth (Zustand + localStorage)
  → Redirect → /login
```

### 5. AppShell layout

Mantine `AppShell` с:
- **Header:** логотип + имя пользователя + кнопка выхода
- **Navbar:** навигация (Dashboard, Workspaces — в будущих спринтах)
- **Main:** контент страницы
- Responsive: Burger на мобильных

---

## Риски и зависимости

| Риск | Митигация |
|------|-----------|
| Бэкенд не запущен | `.env` с `NEXT_PUBLIC_API_URL`, fallback сообщение |
| Hey-api не генерирует корректно | Ручная проверка после генерации, fallback на типы |
| Mantine SSR hydration mismatch | `'use client'` на интерактивных компонентах, `suppressHydrationWarning` |
| Token expiry race condition | Interceptor с retry + refresh логикой |

---

## Порядок реализации

1. **Scaffold** — `npx create-next-app`, установка зависимостей
2. **Infra** — theme, providers, API instance, auth store
3. **Auth pages** — login, register формы + API hooks
4. **Dashboard** — AppShell layout, /users/me, список воркспейсов
5. **Polish** — middleware, error states, loading states, redirect logic
