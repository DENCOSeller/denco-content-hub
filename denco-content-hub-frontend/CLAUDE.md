# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Этот файл автоматически загружается в контекст при каждом запросе.
> Следуй этим правилам ВСЕГДА, без исключений.

---

## ТВОЯ РОЛЬ

Ты — Senior Frontend Developer, специализирующийся на Next.js, TypeScript и Mantine UI. Ты работаешь в паре с человеком-архитектором. Твоя задача — писать чистый, типизированный, продакшен-готовый код.

Ты НЕ принимаешь архитектурных решений самостоятельно. Если задача требует выбора подхода — предложи варианты и жди решения.

**Контекст:** Фронтенд работает с отдельным Backend (Python FastAPI). Связь через REST API. Клиент генерируется автоматически через Hey-api.

---

## ТЕХНОЛОГИЧЕСКИЙ СТЕК

Используй ТОЛЬКО эти технологии. НЕ предлагай альтернативы.

```
Language:        TypeScript (strict mode)
Framework:       Next.js 15 (App Router)
UI Library:      Mantine (последняя версия) + @mantine/form + @mantine/notifications
API Client:      Hey-api (автогенерация по OpenAPI)
Server State:    TanStack Query v5
Client State:    Zustand
Validation:      Zod
Styling:         Mantine + CSS Modules
Package Manager: npm
```

### Критичные правила

- UI-компоненты — ТОЛЬКО Mantine. НЕ предлагай shadcn/ui, Radix, Chakra, MUI.
- API-вызовы — ТОЛЬКО через Hey-api сгенерированный клиент. НЕ пиши fetch/axios вручную.
- Стили — ТОЛЬКО Mantine props + CSS Modules. НЕ предлагай Tailwind CSS.
- Не выдумывай несуществующие Mantine-компоненты и пропсы.

---

## ПОРЯДОК РАБОТЫ

### Перед написанием кода

1. **Объясни план.** Что делаешь, какие файлы. Жди подтверждения.
2. **Проверь существующий код.** НЕ дублируй компоненты.
3. **Одна задача за раз.**

### Во время

4. **Маленькие изменения.** Минимум файлов за шаг.
5. **Не трогай то, о чём не просили.**
6. **Объясняй неочевидное.**

### После

7. **Проверь типы:** `npx tsc --noEmit`
8. **Подтверди завершение.** Файлы, что проверить, коммит.

---

## СТРУКТУРА ПРОЕКТА

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Маршруты аутентификации
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/            # Защищённые маршруты
│   │   ├── layout.tsx          # AppShell layout
│   │   └── page.tsx
│   ├── layout.tsx              # Root layout (providers)
│   ├── page.tsx
│   ├── error.tsx               # Global error boundary
│   ├── loading.tsx             # Global loading
│   └── not-found.tsx           # 404
│
├── components/
│   ├── providers/              # Все providers (Mantine, Query, Auth)
│   │   └── AppProviders.tsx
│   ├── forms/                  # Компоненты форм
│   ├── layouts/                # AppShell, Header, Sidebar, Navbar
│   ├── shared/                 # Переиспользуемые: DataTable, EmptyState, ErrorState
│   └── features/               # По фичам
│       ├── users/
│       ├── orders/
│       └── ...
│
├── api/
│   ├── client/                 # Hey-api автогенерация (НЕ РЕДАКТИРУЙ!)
│   ├── hooks/                  # TanStack Query обёртки
│   │   ├── useUsers.ts
│   │   ├── useAuth.ts
│   │   └── ...
│   ├── instance.ts             # Настройка API-клиента (base URL, interceptors)
│   └── index.ts
│
├── lib/
│   ├── utils.ts
│   ├── auth.ts                 # Хранение/получение токена, refresh logic
│   └── validations/            # Zod-схемы для форм
│
├── hooks/                      # Кастомные хуки
│   └── useAuth.ts              # Хук аутентификации
│
├── stores/                     # Zustand
│   └── auth-store.ts           # Auth state (user, tokens)
│
├── types/                      # Дополнительные типы
│
├── theme/
│   └── index.ts                # Mantine theme
│
└── middleware.ts                # Auth guard
```

### Куда класть код

| Что | Куда | НЕ сюда |
|-----|------|---------|
| Страница | `app/` | components/ |
| Переиспользуемый UI | `components/shared/` | Внутри page.tsx |
| Фича-компонент | `components/features/[name]/` | shared |
| API-хук | `api/hooks/` | Внутри компонента |
| Валидация форм | `lib/validations/` | Внутри компонента |
| Глобальный стейт | `stores/` | React Context |
| Mantine тема | `theme/` | Inline стили |
| Auth-логика | `lib/auth.ts` + `stores/auth-store.ts` | Разбросанная по компонентам |

**ВАЖНО:** `api/client/` — автогенерация Hey-api. **НИКОГДА не редактируй вручную.**

---

## НАСТРОЙКА PROVIDERS

### src/app/layout.tsx — Root Layout

```tsx
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

import { ColorSchemeScript } from '@mantine/core'
import { AppProviders } from '@/components/providers/AppProviders'

export const metadata = {
  title: 'MyApp',
  description: 'Описание',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
```

### src/components/providers/AppProviders.tsx

```tsx
'use client'

import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { theme } from '@/theme'

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,           // 1 минута
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Notifications position="top-right" />
        {children}
      </MantineProvider>
    </QueryClientProvider>
  )
}
```

### src/theme/index.ts — Mantine Theme

```tsx
import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, sans-serif',
  defaultRadius: 'md',
  components: {
    Button: { defaultProps: { size: 'md' } },
    TextInput: { defaultProps: { size: 'md' } },
    Select: { defaultProps: { size: 'md' } },
  },
})
```

Кастомизируй через тему, НЕ через пропсы на каждом компоненте.

---

## АУТЕНТИФИКАЦИЯ

### src/stores/auth-store.ts

```tsx
import { create } from 'zustand'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setTokens: (access: string, refresh: string) => void
  clearTokens: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setTokens: (access, refresh) =>
    set({ accessToken: access, refreshToken: refresh, isAuthenticated: true }),
  clearTokens: () =>
    set({ accessToken: null, refreshToken: null, isAuthenticated: false }),
}))
```

### src/lib/auth.ts — Token management

```tsx
import { useAuthStore } from '@/stores/auth-store'

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken
}

export function setTokens(access: string, refresh: string): void {
  useAuthStore.getState().setTokens(access, refresh)
}

export function clearAuth(): void {
  useAuthStore.getState().clearTokens()
}

export function isAuthenticated(): boolean {
  return useAuthStore.getState().isAuthenticated
}
```

### src/api/instance.ts — API Client с interceptors

```tsx
import { getAccessToken, clearAuth } from '@/lib/auth'

// Конфигурация Hey-api клиента
// Настрой base URL и interceptors

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// Interceptor: добавляй Authorization header
export function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken()
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

// Interceptor: обработка 401
export function handleUnauthorized(): void {
  clearAuth()
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}
```

### src/middleware.ts — Auth Guard

```tsx
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicRoutes = ['/login', '/register', '/']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Публичные маршруты — пропускаем
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Проверка токена (из cookie или header)
  // Адаптируй под своё хранение токена
  const token = request.cookies.get('access_token')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

---

## HEY-API И API-ХУКИ

### Генерация клиента

```bash
npx @hey-api/openapi-ts \
  --input http://localhost:8000/openapi.json \
  --output src/api/client
```

Запускай после КАЖДОГО изменения API на бэкенде. Файлы в `api/client/` — НЕ РЕДАКТИРУЙ.

### src/api/hooks/ — TanStack Query обёртки

```tsx
// src/api/hooks/useUsers.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UsersService } from '@/api/client'
import { getAuthHeaders } from '@/api/instance'

export function useUsersQuery(page = 1, size = 20) {
  return useQuery({
    queryKey: ['users', { page, size }],
    queryFn: () => UsersService.listUsers({ query: { page, size }, headers: getAuthHeaders() }),
  })
}

export function useUserQuery(userId: number) {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => UsersService.getUser({ path: { user_id: userId }, headers: getAuthHeaders() }),
    enabled: !!userId,
  })
}

export function useCreateUserMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; name: string; password: string }) =>
      UsersService.createUser({ body: data, headers: getAuthHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}
```

```tsx
// src/api/hooks/useAuth.ts

import { useMutation } from '@tanstack/react-query'
import { AuthService } from '@/api/client'
import { setTokens, clearAuth } from '@/lib/auth'

export function useLoginMutation() {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      AuthService.login({ body: data }),
    onSuccess: (response) => {
      setTokens(response.access_token, response.refresh_token)
    },
  })
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (data: { email: string; password: string; name: string }) =>
      AuthService.register({ body: data }),
    onSuccess: (response) => {
      setTokens(response.access_token, response.refresh_token)
    },
  })
}

export function useLogout() {
  return () => {
    clearAuth()
    window.location.href = '/login'
  }
}
```

### Git Workflow
- **НИКОГДА** не коммитить напрямую в `main`, `dev` или `master`
- Для каждой задачи создавать ветку: `feat/<название>`, `fix/<название>`, `refactor/<название>`
- После завершения — `git push -u origin <ветка>`
- Merge в основную ветку делает только программист (человек), не агент
- PR создаётся через GitHub или Gitea

### Правила

- ВСЕГДА TanStack Query для серверного стейта.
- Query keys иерархичные: `['users']`, `['users', id]`, `['users', { page, filter }]`.
- Мутации: `onSuccess` → `invalidateQueries`.
- Типы — из Hey-api автоматически. НЕ дублируй.
- Если нужен новый эндпоинт — скажи что нужно на бэкенде. НЕ хачь обход.

---

## ФОРМЫ

### Паттерн: Mantine Form + Zod

```tsx
// lib/validations/user.ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
```

```tsx
// components/forms/LoginForm.tsx
'use client'

import { Button, TextInput, PasswordInput, Stack } from '@mantine/core'
import { useForm, zodResolver } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/navigation'

import { useLoginMutation } from '@/api/hooks/useAuth'
import { loginSchema, type LoginFormValues } from '@/lib/validations/user'

export function LoginForm() {
  const router = useRouter()
  const login = useLoginMutation()

  const form = useForm<LoginFormValues>({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '' },
    validate: zodResolver(loginSchema),
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
      router.push('/dashboard')
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Неверный email или пароль',
        color: 'red',
      })
    }
  })

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        <TextInput
          label="Email"
          placeholder="your@email.com"
          key={form.key('email')}
          {...form.getInputProps('email')}
        />
        <PasswordInput
          label="Пароль"
          placeholder="Пароль"
          key={form.key('password')}
          {...form.getInputProps('password')}
        />
        <Button type="submit" loading={login.isPending} fullWidth>
          Войти
        </Button>
      </Stack>
    </form>
  )
}
```

Используй этот паттерн для ВСЕХ форм:
- Zod-схема в `lib/validations/`
- `useForm` + `zodResolver`
- `loading` состояние кнопки
- Ошибки через `notifications.show()`

---

## LOADING / ERROR / EMPTY STATES

### Стандартные компоненты

```tsx
// components/shared/LoadingState.tsx
'use client'

import { Center, Loader, Stack, Text } from '@mantine/core'

interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = 'Загрузка...' }: LoadingStateProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="sm">
        <Loader size="lg" />
        <Text c="dimmed" size="sm">{message}</Text>
      </Stack>
    </Center>
  )
}
```

```tsx
// components/shared/ErrorState.tsx
'use client'

import { Alert, Button, Stack } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = 'Произошла ошибка', onRetry }: ErrorStateProps) {
  return (
    <Alert icon={<IconAlertCircle />} color="red" title="Ошибка">
      <Stack gap="sm">
        {message}
        {onRetry && (
          <Button variant="light" color="red" size="xs" onClick={onRetry}>
            Повторить
          </Button>
        )}
      </Stack>
    </Alert>
  )
}
```

```tsx
// components/shared/EmptyState.tsx
'use client'

import { Center, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconInbox } from '@tabler/icons-react'

interface EmptyStateProps {
  message?: string
}

export function EmptyState({ message = 'Нет данных' }: EmptyStateProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="sm">
        <ThemeIcon size="xl" variant="light" color="gray">
          <IconInbox />
        </ThemeIcon>
        <Text c="dimmed" size="sm">{message}</Text>
      </Stack>
    </Center>
  )
}
```

### Использование с TanStack Query

```tsx
export function UsersList() {
  const { data, isLoading, isError, refetch } = useUsersQuery()

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState onRetry={refetch} />
  if (!data?.items.length) return <EmptyState message="Пользователей пока нет" />

  return (/* таблица / список */)
}
```

Используй этот паттерн `if loading → if error → if empty → render data` ВЕЗДЕ.

---

## ПАГИНАЦИЯ

```tsx
'use client'

import { Pagination, Group } from '@mantine/core'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

export function usePagination() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const page = Number(searchParams.get('page')) || 1
  const size = Number(searchParams.get('size')) || 20

  const setPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.push(`${pathname}?${params.toString()}`)
  }

  return { page, size, setPage }
}
```

```tsx
// Использование
export function UsersPage() {
  const { page, size, setPage } = usePagination()
  const { data, isLoading } = useUsersQuery(page, size)

  return (
    <Stack>
      {/* таблица */}
      {data && (
        <Group justify="center">
          <Pagination
            total={data.pages}
            value={page}
            onChange={setPage}
          />
        </Group>
      )}
    </Stack>
  )
}
```

Пагинация синхронизируется с URL. Это позволяет делиться ссылками и использовать back/forward.

---

## LAYOUT — APPSHELL

### src/app/(dashboard)/layout.tsx

```tsx
'use client'

import { AppShell, Burger, Group, NavLink, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconHome, IconUsers, IconSettings } from '@tabler/icons-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure()
  const pathname = usePathname()

  const links = [
    { href: '/dashboard', label: 'Главная', icon: IconHome },
    { href: '/dashboard/users', label: 'Пользователи', icon: IconUsers },
    { href: '/dashboard/settings', label: 'Настройки', icon: IconSettings },
  ]

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Title order={3}>MyApp</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {links.map((link) => (
          <NavLink
            key={link.href}
            component={Link}
            href={link.href}
            label={link.label}
            leftSection={<link.icon size={20} />}
            active={pathname === link.href}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
```

- `AppShell` — стандартный layout для дашбордов.
- Navbar автоматически сворачивается на мобильных.
- `breakpoint: 'sm'` — Burger появляется ниже sm.

---

## REACT И NEXT.JS

### Server Components (по умолчанию)

- Все компоненты серверные по умолчанию.
- `'use client'` — ТОЛЬКО для интерактивности (onClick, формы, хуки Mantine, TanStack Query).
- Оборачивай клиентские компоненты в `<Suspense>` с fallback.

### Что НЕ делать

- НЕ используй `useEffect` для получения данных — Server Components или TanStack Query.
- НЕ используй fetch/axios напрямую — только Hey-api.
- НЕ используй Pages Router паттерны.
- НЕ создавай `app/api/` — бэкенд отдельный.

### Оптимизация

- `<Image>` из next/image, формат WebP, lazy loading.
- `next/font` для шрифтов.
- `generateMetadata` для SEO.

---

## СТИЛЬ КОДА

### TypeScript

- `strict: true`. Никогда `any`. Используй `unknown` + type guard.
- `interface` для объектов и пропсов, НЕ `type`.
- Не используй `enum` — `as const` или union.
- Алиас `@/` → `src/`.

### Именование

```
Директории:     kebab-case        (user-profile)
Компоненты:     PascalCase        (UserProfile.tsx)
Функции/хуки:   camelCase         (useAuth, getUserById)
Переменные:     camelCase         (isLoading, hasError)
Типы:           PascalCase        (UserProfileProps)
CSS Modules:    camelCase         (styles.container)
```

### Компоненты

- `function` declaration, НЕ `const Component = () =>`.
- ТОЛЬКО named exports. НИКОГДА default exports.
- Максимум **200 строк** на файл.

### Стилизация

```tsx
// ✅ ПРАВИЛЬНО — Mantine props
<Button size="md" variant="filled" color="blue">OK</Button>
<Box className={styles.custom}>...</Box>

// ❌ НЕПРАВИЛЬНО
<button style={{ backgroundColor: 'blue' }}>OK</button>
<div className="flex items-center p-4">...</div>
```

---

## БЕЗОПАСНОСТЬ

- НЕ хардкодь секреты. ТОЛЬКО `process.env` / `NEXT_PUBLIC_*`.
- `NEXT_PUBLIC_*` — ТОЛЬКО для публичных данных (URL бэкенда).
- НЕ используй `dangerouslySetInnerHTML` без санитизации.
- НЕ выводи `console.log` с чувствительными данными в проде.
- Валидируй на фронте (для UX), но ВСЕГДА перевалидируй на бэкенде.

### .env.example

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## ЗАПРЕЩЁННЫЕ ДЕЙСТВИЯ

```bash
rm -rf /
git push --force
git reset --hard
npm run build (может быть долгим — только по запросу)
```

Защищённые файлы: `.env`, `api/client/*` (автогенерация), `.git/`

---

## КОГДА ТЫ НЕ УВЕРЕН

1. **Не знаешь Mantine API** — скажи, не выдумывай пропсы.
2. **Нужен новый API-эндпоинт** — скажи что нужно на бэкенде. НЕ хачь обход.
3. **Задача большая** — предложи разбить.
4. **Баг не фиксится 3 итерации** — скажи прямо, предложи откат.

---

## ПАТТЕРНЫ ОТВЕТОВ

**Новая задача:**
```
"Понял: [суть]. План: 1... 2... Файлы: [...].
Нужно что-то на бэкенде? [да/нет]. Начинаю?"
```

**Нужен бэкенд:**
```
"Для этой фичи нужен эндпоинт на бэкенде:
- POST /api/v1/users — body: {email, name, password} → response: {id, email, name}
После добавления — перегенерировать Hey-api:
npx @hey-api/openapi-ts --input http://localhost:8000/openapi.json --output src/api/client"
```

**Завершение:**
```
"Готово: [файлы]. Проверь: [...]. Коммит: git add -A && git commit -m '...'"
```

---

## КОМАНДЫ

```bash
npm run dev                      # Dev-сервер (:3000)
npm run lint && npm run lint:fix # ESLint
npx tsc --noEmit                 # TypeScript check
npm run build                    # Продакшен-сборка

# Hey-api
npx @hey-api/openapi-ts --input http://localhost:8000/openapi.json --output src/api/client

# Тесты
npm run test                     # Vitest
npm run test:e2e                 # Playwright
```

---

## GIT

```
feat(auth): add login page
fix(users): resolve avatar crash
refactor(api): migrate to Hey-api hooks
style: format with prettier
test(forms): add validation tests
chore: update Mantine
```

---

## Текущие задачи (Sprint 7 — Knowledge Graph Frontend)

| Chunk | Статус | Что |
|-------|--------|-----|
| 1 | ✅ DONE | Dependencies + API hooks + node type utils |
| 2 | ✅ DONE | React Flow canvas POC (gate chunk) |
| 3 | ✅ DONE | Custom node cards + custom edges |
| 4 | ✅ DONE | Toolbar + CreateNodeModal + фильтры + поиск |
| 5 | ✅ DONE | NodeEditorDrawer + TipTap editor + version history |
| 6 | ✅ DONE | Edges — создание связей (drag + modal) |
| 7 | ✅ DONE | Batch positions + MiniMap polish + motion animations + keyboard shortcuts |
| 8 | ✅ DONE | Company knowledge page (reuse components) |
| 9 | ✅ DONE | NodeListView + responsive (mobile = list) |

**Sprint 7 ЗАВЕРШЁН** ✅ — все 9 chunks реализованы.

**Chunk 1 детали:**
- Установлены: `@xyflow/react`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-link`, `@tiptap/extension-underline`, `motion`
- Перегенерирован hey-api клиент (20 knowledge endpoints)
- `src/lib/knowledge-utils.ts` — конфиг 8 типов нодов (цвета, градиенты, иконки)
- `src/api/hooks/useKnowledge.ts` — 10 TanStack Query хуков для workspace knowledge API

**Chunk 2 детали:**
- React Flow POC работает с React 19 ✅
- `src/app/globals.css` — React Flow CSS import + dark theme overrides
- `src/lib/knowledge-transform.ts` — backend KnowledgeGraphResponse → React Flow nodes/edges
- `src/hooks/useKnowledgeGraph.ts` — state + debounced batch position save on drag end
- `src/components/knowledge/KnowledgeNode.tsx` — кастомный нод с иконкой типа и градиентом
- `src/components/knowledge/KnowledgeGraph.tsx` — canvas с Background, Controls, MiniMap, fitView
- `src/app/(dashboard)/workspaces/[id]/knowledge/page.tsx` — страница с dynamic import (ssr: false)
- Workspace hub — добавлена карточка "Граф знаний"

**Chunk 3 детали:**
- `src/components/knowledge/KnowledgeNodeCard.tsx` — карточка 220px с градиентной иконкой, превью текста, company стиль (dashed border + lock)
- `src/components/knowledge/KnowledgeEdgeCustom.tsx` — Безье кривая, цвет по source ноде, label, hover подсветка + кнопка удаления
- `src/lib/knowledge-transform.ts` — расширен: contentPreview, isCompanyNode, edge sourceColor
- `src/components/knowledge/KnowledgeNode.tsx` — удалён (заменён на KnowledgeNodeCard)
- `src/hooks/useKnowledgeGraph.ts` — типизация edge data
- `src/app/globals.css` — hover эффект карточки, handle видимость при наведении

**Chunk 4 детали:**
- `src/components/knowledge/KnowledgeToolbar.tsx` — glass toolbar (backdrop-blur), кнопка создания, Select фильтр по типу, TextInput поиск с debounce 300ms, fit view кнопка
- `src/components/knowledge/CreateNodeModal.tsx` — Modal с карточками выбора типа (иконки + градиенты), title + textarea, submit через useCreateNodeMutation, TipTap JSON формат для контента
- `src/hooks/useKnowledgeGraph.ts` — filterType/searchQuery state, filteredNodes/filteredEdges через useMemo, edges фильтруются по видимым нодам
- `src/components/knowledge/KnowledgeGraph.tsx` — ReactFlowProvider обёртка (для useReactFlow в toolbar), KnowledgeGraphInner паттерн, toolbar сверху + createModal state

**Chunk 5 детали:**
- `src/components/knowledge/TipTapEditor.tsx` — редактор с toolbar (Bold, Italic, Underline, Link, H2, H3, BulletList, OrderedList), тёмная тема, onChange callback
- `src/components/knowledge/NodeEditorDrawer.tsx` — Drawer справа 480px, dynamic import TipTap (ssr: false), вкладки Редактор/История, auto-save debounce 2сек, удаление с подтверждением (2 клика), Timeline версий
- `src/components/knowledge/KnowledgeGraph.tsx` — selectedNodeId state, onNodeClick → открывает drawer, убран внешний prop onNodeClick

**Chunk 6 детали:**
- `src/components/knowledge/CreateEdgeModal.tsx` — модалка создания связи: TextInput label, submit → useCreateEdgeMutation, onSuccess → close + invalidate graph
- `src/hooks/useKnowledgeGraph.ts` — onConnect callback (React Flow), pendingConnection state (source/target node ids), блокировка company nodes
- `src/components/knowledge/KnowledgeGraph.tsx` — onConnect передан в ReactFlow, CreateEdgeModal с pending connection
- Удаление edges уже работало в KnowledgeEdgeCustom (Chunk 3)

**Chunk 7 детали:**
- `src/hooks/useKnowledgeGraph.ts` — useEffect cleanup: flush pending batch positions при unmount
- `src/components/knowledge/KnowledgeGraph.tsx` — MiniMap: pannable, zoomable, тёмный фон, border-radius, border. Loading skeleton вместо LoadingState. Улучшенный empty state с иконкой +. Delete/Backspace shortcut для выбранного узла (confirm dialog)
- `src/components/knowledge/KnowledgeNodeCard.tsx` — motion.div обёртка: fade-in + scale анимация при появлении (0.25s)
- `src/components/knowledge/KnowledgeToolbar.tsx` — motion.div обёртка: fade-in сверху (0.3s). Tooltips на кнопке «Создать» и фильтре типов
- `src/components/knowledge/NodeEditorDrawer.tsx` — keyboard shortcuts: Escape → close drawer, Cmd/Ctrl+S → save (preventDefault + flush debounce)

**Chunk 8 детали:**
- `src/api/hooks/useCompanyKnowledge.ts` — 10 хуков для company knowledge API
- `src/components/knowledge/KnowledgeGraph.tsx` — scope/scopeId props вместо workspaceId
- `src/components/knowledge/CreateNodeModal.tsx`, `CreateEdgeModal.tsx`, `NodeEditorDrawer.tsx` — scope routing
- `src/hooks/useKnowledgeGraph.ts` — scope-aware: workspace/company graph + batch positions
- `src/app/(dashboard)/companies/[id]/knowledge/page.tsx` — company knowledge graph page
- `src/app/(dashboard)/layout.tsx` — sidebar навигация компании (← Все компании, Граф знаний)

**Chunk 9 детали:**
- `src/components/knowledge/NodeListView.tsx` — мобильный список: карточки с gradient-иконкой, badge типа, превью текста, встроенные фильтр + поиск, пустое состояние
- `src/components/knowledge/KnowledgeGraph.tsx` — `useMediaQuery('(max-width: 48em)')`: мобильные → NodeListView, десктоп → ReactFlow. ReactFlowProvider только на десктопе. Skeleton при SSR hydration

### Sprint 7 итого: Knowledge Graph Frontend (полностью готов)
- 9 чанков, React Flow граф с кастомными узлами и связями
- TipTap rich text редактор в drawer
- Toolbar с фильтрами по типу и поиском
- Создание/удаление узлов и связей через модалки
- Drag & drop с debounced сохранением позиций
- Версионирование узлов (Timeline в drawer)
- Company + Workspace графы (scope routing)
- Мобильная версия (NodeListView с адаптивным переключением)
- Анимации (motion), MiniMap, keyboard shortcuts (Del, Cmd+S, Esc)

### Post-Sprint 7: Knowledge Graph Editor Redesign (Apple 2026 style)
- **CreateNodeModal** — size="xl", тёмный фон #0a0a0f, карточки типов 80x80 с glow + gradient border, borderless title 20px, TipTap editor вместо textarea (dynamic import), gradient submit кнопка меняет цвет по типу
- **NodeEditorDrawer** — 640px, кастомная шапка: иконка 48x48 с gradient glow, inline-editable заголовок 22px/700, badge типа + дата, TipTap borderless на всё пространство, footer: save status (●/○ анимация) + ghost delete
- **TipTapEditor** — новые props: accentGradient, placeholder, borderless. Стеклянный toolbar (backdrop-blur), gradient-активные кнопки через CSS variable, font-size 15px, line-height 1.7
- Все стили через CSS Modules (3 файла .module.css), без inline styles
- Дизайн-система: стекло + размытие, скругления 16/12/10px, rgba карточки, glow тени, cubic-bezier анимации 200-300ms

---

## Текущие задачи (Sprint 8 — Глобальный AI Ассистент)

### Концепция
Глобальная AI панель справа (380px, `AppShell.Aside`) на ВСЕХ страницах дашборда.
AI — эксперт по маркетингу и контент-стратегии DENCO.
Видит контекст текущей страницы (page context provider).
История чата сохраняется в БД per user.

### Принятые архитектурные решения
- **Стриминг:** SSE через `fetch()` + `ReadableStream` (не EventSource — нужны POST body + auth headers). Кастомный хук, не Hey-api
- **AI actions:** Confirm before apply (кнопка "Применить"). Безопаснее
- **Company knowledge:** Toggle в панели, по умолчанию выключен. Бэкенд флаг `include_company_knowledge`
- **Файлы в чате:** 10MB max, PDF/docx/images. Upload через бэкенд → S3
- **Файлы в узлах (NodeAttachment):** НЕТ в Sprint 8 → Sprint 9
- **Rate limit:** 30 сообщений/час per user
- **Сессии:** Последние 50, архивация через 30 дней
- **Панель:** Фиксированная 380px, не resizable в MVP
- **Suggestions:** 4 карточки в пустом чате
- **Page context:** Фронт отправляет дескриптор (page_type + IDs), бэкенд сам загружает данные из БД
- **Node references:** Формат `[[node:ID:Название]]` → парсинг на фронте в кликабельные badges
- **AI action endpoints:** Через бэкенд (`/actions/{index}/apply`), не через фронтовые мутации

### Chunks

| Chunk | Статус | Что |
|-------|--------|-----|
| 1 | ✅ DONE | Layout + Panel Shell + Zustand Store |
| 2 | ✅ DONE | Page Context Provider |
| 3 | ✅ DONE | SSE стриминг + базовый чат (текст) |
| 4 | ✅ DONE | Chat Sessions (история, переключение) |
| 5 | ⬜ TODO | Node References (ссылки на узлы в ответах) |
| 6 | ⬜ TODO | AI Actions (propose → confirm → apply) |
| 7 | ⬜ TODO | Файлы в чате |
| 8 | ⬜ TODO | Polish + Mobile + Keyboard shortcuts |

### Зависимости чанков

```
Chunk 1 (layout shell) ─┬──→ Chunk 3 (SSE + chat) ──→ Chunk 4 (sessions)
                         │                                     │
Chunk 2 (page context) ─┘                                     ├→ Chunk 5 (node refs)
                                                               ├→ Chunk 6 (AI actions)
                                                               ├→ Chunk 7 (files)
                                                               └→ Chunk 8 (polish)
```

Chunks 1+2 параллельно. Chunk 3 зависит от 1+2. Chunks 5/6/7 между собой параллельны.

### Chunk 1 детали: Layout + Panel Shell + Store
**Бэкенд:** Не нужен
**Файлы:**
- `src/stores/ai-panel-store.ts` — Zustand с `persist` (localStorage): `isOpen`, `activeSessionId`, `toggle()`. `skipHydration: true` для SSR
- `src/components/ai/AiAssistantPanel.tsx` — панель с header ("AI Ассистент"), close button
- `src/components/ai/AiAssistantPanel.module.css` — glass/dark стили
- `src/app/(dashboard)/layout.tsx` — `AppShell.Aside` width=380, breakpoint='md', collapsed из store. Toggle кнопка в Header
- Responsive: `< md` → Drawer вместо Aside
- Transition анимация open/close
**Gate:** Кнопка в header → панель открывается/закрывается, состояние сохраняется при reload

### Chunk 2 детали: Page Context Provider
**Бэкенд:** Не нужен
**Реализация:**
- `src/contexts/AiPageContext.tsx` — React Context: `AiPageContextProvider`, `useSetAiPageContext()` (auto-clear on unmount), `useAiPageContext()`
- Provider в `layout.tsx` — обёртка `<AiPageContextProvider>` вокруг children в `AppShell.Main`
- Интеграция в 4 страницы:
  - `dashboard/page.tsx` → `{ page_type: 'dashboard' }`
  - `workspaces/[id]/page.tsx` → `{ page_type: 'workspace', workspace_id, workspace_name }` (name из store)
  - `workspaces/[id]/knowledge/page.tsx` → `{ page_type: 'workspace_knowledge', workspace_id }`
  - `companies/[id]/knowledge/page.tsx` → `{ page_type: 'company_knowledge', company_id }`
- `AiAssistantPanel.tsx` — context badge с IconMapPin, `getContextLabel()` helper
- `AiAssistantPanel.module.css` — `.contextBar`, `.contextBadge` стили
- workspace_name передаётся только на workspace hub (вариант A), на knowledge — просто "Граф знаний"
**Тип контекста:**
```typescript
interface AiPageContext {
  page_type: 'dashboard' | 'workspace' | 'workspace_knowledge' | 'company_knowledge' | 'content_item'
  workspace_id?: number
  company_id?: number
  workspace_name?: string
  content_item_id?: number
  focused_node_ids?: number[]
  selected_content_ids?: number[]
}
```
**Gate:** ✅ Навигация между страницами → badge в панели обновляется

### Chunk 3 детали: SSE стриминг + базовый чат
**Бэкенд нужен:** P0
**Реализация:**
- `src/hooks/useAiChat.ts` — SSE streaming хук: `fetch()` + `ReadableStream` + `TextDecoder`, парсинг SSE events (token/done/error), auto-create session при первом сообщении, abort/stop streaming, accumulated content вне try для catch-доступа
- `src/api/hooks/useAiSessions.ts` — TanStack Query: `useSessionMessagesQuery` (загрузка истории), `useCreateSessionMutation`, `useDeleteSessionMutation`, `aiSessionKeys` для кэширования
- `src/components/ai/AiChatMessage.tsx` + `.module.css` — `AiChatMessageItem` (user/assistant с аватарами), `AiStreamingMessage` (мигающий cursor), минимальный markdown парсер (bold, italic, code blocks, lists, links) с XSS protection (HTML escape)
- `src/components/ai/AiChatInput.tsx` + `.module.css` — uncontrolled textarea с auto-resize (max 120px), Cmd+Enter отправка, gradient Send кнопка, красная Stop кнопка при стриминге
- `src/components/ai/AiAssistantPanel.tsx` — интеграция: `useAiChat` + `useSessionMessagesQuery`, скроллируемый `.body` с messageList, placeholder при пустом чате, auto-scroll to bottom через `scrollIntoView`
- `src/components/ai/AiAssistantPanel.module.css` — `.body` overflow-y: auto + scrollbar-width: thin, `.messageList` flex column, `:has(.placeholder)` центрирует пустое состояние
**Без:** файлов, node references, AI actions, множественных сессий. Одна сессия, только текст
**Gate:** ✅ Набрал текст → Cmd+Enter → SSE стриминг ответа → при reload загружается из истории

### Chunk 4 детали: Chat Sessions
**Бэкенд нужен:** P1 (list sessions, auto-title)
**Реализация:**
- `src/components/ai/ChatSessionList.tsx` + `.module.css` — overlay-панель истории: список сессий с title + relative date, удаление (корзина на hover), "Новый чат" кнопка, active подсветка
- `src/components/ai/AiSuggestionCards.tsx` + `.module.css` — 4 карточки подсказок в пустом чате (Целевая аудитория, Контент-план, Каналы, Написать текст), клик → отправка как сообщение
- `src/api/hooks/useAiSessions.ts` — добавлен `useSessionsListQuery()` (GET /api/v1/ai/sessions)
- `src/hooks/useAiChat.ts` — добавлен `resetChat()` (stop streaming + clear messages)
- `src/components/ai/AiAssistantPanel.tsx` — кнопка IconHistory в header → toggle ChatSessionList overlay, переключение сессий с resetChat, AiSuggestionCards в empty state
- `src/components/ai/AiAssistantPanel.module.css` — `position: relative` на panel, `.headerActions`, `.headerButton`
**Gate:** ✅ Несколько сессий, переключение, history persistence, suggestion cards

### Chunk 5 детали: Node References
**Бэкенд нужен:** P1 (формат ссылок в system prompt, `node_reference` SSE events)
**Файлы:**
- `src/lib/chat-message-parser.ts` — парсинг `[[node:ID:Title]]` → React elements
- `src/components/ai/NodeReference.tsx` — inline badge: иконка типа + название, цвет по node type
- Click: на knowledge page → fitView + select; на другой → `router.push()` + query `?focusNode=ID`
- `AiChatMessage.tsx` — рендер через parser
**Gate:** AI упоминает узел → badge → клик → навигация на граф

### Chunk 6 детали: AI Actions
**Бэкенд нужен:** P1 (Claude tool_use → AiAction, apply/reject endpoints)
**Файлы:**
- `src/components/ai/AiActionCard.tsx` — карточка действия: "Применить" / "Отклонить"
  - `create_node`: preview (тип + название)
  - `update_node`: diff
  - `create_edge`: "Связать X → Y"
- `src/components/ai/AiActionCard.module.css`
- Apply → `POST /actions/{index}/apply` → invalidate knowledge queries
- Статус: proposed (синий) → applied (зелёный) → rejected (серый)
- Actions доступны ТОЛЬКО на knowledge pages
**Gate:** AI предлагает узел → "Применить" → узел на графе

### Chunk 7 детали: Файлы в чате
**Бэкенд нужен:** P1 (upload endpoint, PDF text extraction, image → Claude vision)
**Файлы:**
- `src/api/hooks/useAiAttachments.ts` — upload mutation (multipart/form-data, ручной fetch)
- `src/components/ai/ChatAttachmentChip.tsx` — chip (filename + size + remove)
- `AiChatInput.tsx` — кнопка 📎 + drag-and-drop
- `AiChatMessage.tsx` — attachments в user message
- Лимит: 10MB per file, макс 3 файла на сообщение
- Типы: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.docx`
**Gate:** Прикрепил PDF → отправил → AI анализирует в ответе

### Chunk 8 детали: Polish + Mobile + Keyboard shortcuts
**Бэкенд:** Не нужен
**Файлы:**
- `Cmd+.` — toggle AI panel
- Typing indicator (animated dots) при стриминге
- Resize observer для React Flow при toggle панели
- Mobile: FAB кнопка в правом нижнем углу → full-screen Drawer
- Skeleton loading для messages
- Error state + retry
- Rate limit UI: "Подождите N секунд" при 429
- Плавные transition анимации (Mantine Transition)
**Gate:** Полный polish, мобильная версия, shortcuts

### Бэкенд-блокеры

| Приоритет | Что | Блокирует | Детали |
|-----------|-----|-----------|--------|
| P0 | ChatSession + ChatMessage модели | Chunk 3 | user_id FK, session_id FK, content text, role enum, page_context JSON |
| P0 | SSE endpoint + Claude integration | Chunk 3 | Anthropic SDK streaming, system prompt + graph serialization |
| P0 | Умная сериализация графа | Chunk 3 | Title + type + connections summary. Full content только для focused_node_ids. Лимит ~30K tokens |
| P1 | Auto-title сессии | Chunk 4 | Extraction из первого сообщения |
| P1 | `[[node:ID:Title]]` в system prompt | Chunk 5 | Claude знает формат + список узлов с ID |
| P1 | Claude tool_use → AiAction | Chunk 6 | Tools: create_node, update_node, create_edge. Apply/reject endpoints |
| P1 | File upload + processing | Chunk 7 | S3 storage, PDF extraction, image → vision, docx → text |
| P2 | Rate limiting (30 msg/hr) | Chunk 8 | Per-user, 429 response |
| P2 | Prompt caching | Ongoing | Anthropic prompt caching для system + graph context |

### Бэкенд API endpoints

**Chat Sessions:**
```
POST   /api/v1/ai/chat/sessions → ChatSessionResponse
GET    /api/v1/ai/chat/sessions → ChatSessionResponse[] (per user, last 50)
GET    /api/v1/ai/chat/sessions/{session_id} → ChatSessionResponse
DELETE /api/v1/ai/chat/sessions/{session_id} → void
PATCH  /api/v1/ai/chat/sessions/{session_id} → ChatSessionResponse
```

**Chat Messages:**
```
GET    /api/v1/ai/chat/sessions/{session_id}/messages → ChatMessageResponse[] (cursor pagination)
POST   /api/v1/ai/chat/sessions/{session_id}/messages → SSE stream
       body: { content, page_context, attachment_ids?, include_company_knowledge? }
```

**Chat Attachments:**
```
POST   /api/v1/ai/chat/attachments → ChatAttachmentResponse (multipart/form-data)
DELETE /api/v1/ai/chat/attachments/{attachment_id} → void
```

**AI Actions:**
```
POST   /api/v1/ai/chat/messages/{message_id}/actions/{action_index}/apply → result
POST   /api/v1/ai/chat/messages/{message_id}/actions/{action_index}/reject → void
```

### SSE Event Protocol

```
event: token         → {"content": "текст"}
event: node_reference → {"node_id", "title", "node_type", "scope_type", "scope_id"}
event: ai_action     → {"index", "action_type", "description", "params"}
event: error         → {"code", "message"}
event: done          → {"message_id", "referenced_nodes", "ai_actions"}
```

### System Prompt структура

```
[CACHEABLE — system + graph context]
Роль: эксперт по маркетингу и контент-стратегии DENCO
Правила: русский язык, [[node:ID:Title]] формат ссылок, tools для действий
Workspace graph: {serialized} — title + type + connections summary
Company graph: {serialized} — если include_company_knowledge=true
Focused nodes: {full content} — для focused_node_ids
[END CACHEABLE]

[NON-CACHED — chat history]
```

### Фронтенд файловая структура Sprint 8

```
src/
├── components/ai/
│   ├── AiAssistantPanel.tsx + .module.css
│   ├── AiChatMessage.tsx + .module.css
│   ├── AiChatInput.tsx + .module.css
│   ├── AiActionCard.tsx + .module.css
│   ├── NodeReference.tsx
│   ├── ChatSessionList.tsx
│   └── ChatAttachmentChip.tsx
├── contexts/
│   └── AiPageContext.tsx
├── hooks/
│   └── useAiChat.ts          # SSE streaming hook
├── api/hooks/
│   ├── useAiChat.ts          # TanStack Query: sessions + messages
│   └── useAiAttachments.ts   # File upload
├── stores/
│   └── ai-panel-store.ts     # Zustand persist: panel state
└── lib/
    └── chat-message-parser.ts # [[node:ID:Title]] → React
```

**Следующий**: Sprint 9 — Файлы в узлах (NodeAttachment) + TBD

---

## Post-Sprint 8 Bug Fixes (2026-03-13)

| Fix | Файл | Проблема |
|-----|------|----------|
| fix(ai): SSE parsing — type from JSON | `src/hooks/useAiChat.ts` | Бэкенд шлёт `data: {"type": "token", ...}` без `event:` строки. Хук искал `event: token` → контент терялся |
| fix(ai): typing indicator before first token | `src/components/ai/AiAssistantPanel.tsx` | `isStreaming && streamingContent` → убрал `&& streamingContent`, добавил три анимированные точки |
| fix(ai): Telegram-style chat redesign | `src/components/ai/AiChatMessage.tsx` + `.module.css` | Пузыри: user справа (gradient blue), assistant слева (dark border). Аватары, время, typing dots |
| fix(knowledge): graph not updating after mutation | `src/hooks/useKnowledgeGraph.ts` | `useEffect` deps `[initial, setNodes, setEdges]` нестабильны → заменены на `[dataUpdatedAt]` из React Query |
| fix(knowledge): refetchQueries instead of invalidate | `src/api/hooks/useCompanyKnowledge.ts`, `useKnowledge.ts` | `invalidateQueries` не гарантирует refetch → `await refetchQueries` для graph после create/update/delete |

---

## AI Ассистент (Sprint 9)

- **READ tools:** `search_knowledge_nodes`, `get_node_with_edges`, `get_workspace_overview`, `search_across_workspaces`
- **Tool loop:** до 5 раундов, READ tools выполняются автоматически на бэкенде (non-streaming → streaming финальный ответ)
- **Prompt Caching:** system prompt кэшируется через `cache_control: {"type": "ephemeral"}` (экономия ~80% токенов)
- **Flat dump убран:** вместо всех нод — краткое саммари воркспейса (node counts by type, ~30 tokens)
- **Slash команды:** `/overview`, `/search`, `/find-all`, `/connections` — бэкенд инструктирует AI ВСЕГДА вызывать tools
- **Tool Progress UI:** анимированные индикаторы поиска (`tool_progress` SSE event → фронт показывает какой tool выполняется)
- **Badge "N поисков"** на сообщениях ассистента (счётчик tool rounds)

---

## Sprint 10 — Universal Source Processor (вкладка Референсы)

### Суть
Универсальный процессор источников контента во вкладке References. Пользователь добавляет источник (YouTube видео, PDF файл, веб-страница, ручной текст) → система извлекает контент → AI анализирует → пользователь общается с контентом через чат.

### Типы источников
- `youtube_video`, `pdf_file`, `web_page`, `manual_text`

### Бэкенд API
- `POST /api/v1/content/source` — добавление нового источника
- `GET /api/v1/content/{id}/analysis` — получение анализа контента
- `POST /api/v1/content/{id}/chat` — чат с контентом

### Новые таблицы (бэкенд)
- `content_analyses` — результат AI-анализа
- `content_chat_messages` — сообщения чата с контентом

### Бэкенд: Plugin-архитектура адаптеров
- `app/integrations/sources/` — адаптеры по типу источника (YouTube, PDF, Web, Text)
- `SourceAdapterRegistry` — фабрика, выбирает адаптер по `SourceType`

---

## Sprint 11 — Контент-план (Планировщик публикаций)

### Суть
Новый раздел "Контент-план" — планировщик публикаций готового контента из Библиотеки.
Третье звено воронки: Референсы → Библиотека → **Контент-план**.

### Новые файлы
```
src/
├── app/(dashboard)/workspaces/[id]/content-plan/
│   ├── page.tsx                    — страница с Calendar/List toggle
│   └── content-plan.module.css
├── components/features/content-plan/
│   ├── CalendarView.tsx            — месячный календарь (@mantine/dates)
│   ├── ListView.tsx                — хронологический список по дням
│   ├── PlanItemCard.tsx            — карточка элемента плана (цвет по платформе)
│   ├── AddToPlanModal.tsx          — модалка добавления в план (выбор library item + дата/время + assignee)
│   ├── MetricsModal.tsx            — модалка ввода метрик (просмотры, охват, лайки, комментарии)
│   ├── PlanItemActions.tsx         — кнопки действий (опубликовать, отменить)
│   ├── calendar-view.module.css
│   ├── list-view.module.css
│   └── plan-item-card.module.css
├── api/hooks/
│   └── useContentPlan.ts           — 7 TanStack Query хуков (list, get, create, update, delete, publish, metrics)
└── lib/validations/
    └── content-plan.ts             — Zod схемы (addToPlanSchema, metricsSchema)
```

### Изменённые файлы
- `src/app/(dashboard)/layout.tsx` — пункт "Контент-план" в сайдбар
- `src/components/features/library/LibraryItemCard.tsx` — кнопка "В план"
- `src/app/(dashboard)/workspaces/[id]/library/[itemId]/page.tsx` — кнопка "В план"
- `src/api/client/*` — перегенерированный hey-api клиент (content-plan endpoints)
- `package.json` — `@mantine/dates`, `dayjs`

### Зависимости добавлены
- `@mantine/dates` — календарь (Mantine native)
- `dayjs` — peer dependency для @mantine/dates

---

## Sprint 12 — Content Intelligence Frontend

### Суть
Замена отдельных панелей анализа References и Competitors на единый ContentIntelligencePanel.

### Новые файлы
- `src/components/features/content-intelligence/` — 11 секционных компонентов + мастер-панель
- `src/api/hooks/useIntelligence.ts` — TanStack Query хуки для Intelligence API
- `src/api/types/intelligence.ts` — TypeScript типы

### Удалённые файлы
- `src/api/analysis.ts`, `src/api/hooks/useAnalysis.ts`
- `src/components/features/competitors/PostAnalysisPanel.tsx`
- `src/components/features/references/AnalysisTabPanel.tsx`
- `src/components/features/references/analysis/` — вся директория (7 файлов)

### Коммит
- `91301c0` — unified Content Intelligence

---

## Sprint 13 — Trend Discovery Frontend

### Суть
Фронтенд модуля обнаружения и мониторинга трендов. 4 страницы: Feed, Niches, Detail, Alerts.

### Новые файлы
```
src/
├── api/types/trend.ts              — TypeScript типы (TrendItem, TrendNiche, TrendAlert, etc.)
├── api/hooks/useTrends.ts          — 20+ TanStack Query хуков для Trends API
├── app/(dashboard)/workspaces/[id]/trends/
│   ├── page.tsx                    — Trend Feed (табы, фильтры, grid карточек)
│   ├── trends.module.css
│   ├── [trendId]/page.tsx          — Trend Detail (2 колонки, график, метрики)
│   ├── niches/page.tsx             — Управление нишами мониторинга
│   └── alerts/page.tsx             — Настройки алертов + история
├── components/features/trends/
│   ├── TrendCard.tsx + .module.css  — карточка тренда (thumbnail, metrics, badges)
│   ├── TrendFilters.tsx            — фильтры (период, ниша, стадия, сортировка)
│   ├── TrendStatsStrip.tsx         — статистика вверху страницы
│   ├── TrendGrowthChart.tsx        — AreaChart роста из snapshots
│   ├── TrendEmbedPreview.tsx       — встроенный видеоплеер/превью
│   ├── TrendHeader.tsx             — шапка детальной страницы
│   ├── TrendIntelligenceSection.tsx — Intelligence панель (reuse секций)
│   ├── TrendMetricsPanel.tsx       — viral score, engagement, metrics
│   ├── NicheCard.tsx + .module.css  — карточка ниши (keywords, platforms, sparkline)
│   ├── NicheFormModal.tsx          — модалка создания/редактирования ниши
│   ├── AlertSettings.tsx           — настройки порогов (Switch + Slider)
│   └── AlertHistory.tsx + .module.css — история алертов
```

### Изменённые файлы
- `src/app/(dashboard)/layout.tsx` — IconFlame "Тренды" в sidebar
- `src/components/features/settings/ContentSettingsTab.tsx` — ссылка на настройки трендов
- `src/api/client/*` — перегенерированный hey-api клиент

### Коммит
- `ff6392a` — feat: Trend Discovery

---

*Конец инструкций. Следуй им при каждом запросе.*