# Strategy: Workspaces, Roles & Teams

> Статус: УТВЕРЖДЕНО — решения архитектора зафиксированы (2026-03-12)

---

## Решения архитектора

| # | Вопрос | Решение |
|---|--------|---------|
| Q1 | CONTRACTOR | Оставляем в enum, скрываем в UI |
| Q2 | EDITOR delete | Может удалять любой контент в воркспейсе |
| Q3 | PLATFORM_OWNER | Read-only по умолчанию |
| Q4 | add_member + invite | Два раздельных flow |
| Q5 | Email для инвайтов | Нет. MVP = копировать ссылку |

---

## 1. Текущее состояние (что УЖЕ работает)

| Что | Где | Статус |
|-----|-----|--------|
| Таблица `workspaces` (id, name, slug, is_personal) | `app/models/workspace.py` | ✅ |
| Таблица `workspace_members` (user_id, workspace_id, role) | `app/models/workspace.py` | ✅ |
| Enum `WorkspaceRole`: OWNER, ADMIN, EDITOR, VIEWER, CONTRACTOR | `app/models/workspace.py` | ✅ |
| `get_workspace_from_path` — проверяет membership | `app/dependencies.py` | ✅ |
| `require_role` — проверяет роль в воркспейсе | `app/dependencies.py` | ✅ |
| Личный воркспейс при регистрации | `app/services/auth_service.py` | ✅ |
| CRUD воркспейсов + members | `app/api/workspaces.py` | ✅ |
| Контент привязан к workspace_id | `app/models/content_item.py` | ✅ |
| Role-based access в content/transcription endpoints | `app/api/content.py`, `transcription.py` | ✅ |

**Вывод**: 80% инфраструктуры уже есть. Нужно добавить: PLATFORM_OWNER, инвайты, transfer ownership, закрыть дыры.

---

## 2. Целевая ролевая модель

### 2.1 Платформенный уровень (НЕ workspace role)

| Роль | Как хранится | Возможности |
|------|-------------|-------------|
| PLATFORM_OWNER | `User.is_platform_owner = True` | Видит ВСЕ воркспейсы read-only. Может добавить себя как member через platform API для write-доступа. |

**Почему boolean**: один человек сейчас. Не загрязняет `WorkspaceRole`. Расширяется до enum позже.

### 2.2 Уровень воркспейса (существующий enum)

| Роль | Content CRUD | Members | Settings | Delete WS |
|------|-------------|---------|----------|-----------|
| OWNER | ✅ всё | ✅ все роли | ✅ | ✅ |
| ADMIN | ✅ всё | ✅ кроме OWNER, кроме других ADMIN | ✅ | ❌ |
| EDITOR | ✅ всё | ❌ | ❌ | ❌ |
| VIEWER | 👁 read-only | ❌ | ❌ | ❌ |
| CONTRACTOR | ✅ add + view | ❌ | ❌ | ❌ (скрыт в UI) |

---

## 3. Изменения в БД

### 3.1 User model — новое поле

```python
is_platform_owner: Mapped[bool] = mapped_column(default=False, nullable=False)
```

Миграция: `ALTER TABLE users ADD COLUMN is_platform_owner BOOLEAN NOT NULL DEFAULT FALSE;`
Флаг устанавливается ТОЛЬКО через прямой SQL. API для этого НЕТ.

### 3.2 Новая таблица: workspace_invitations

```
workspace_invitations
├── id: int (PK)
├── workspace_id: int (FK → workspaces.id)
├── email: str(255)
├── role: WorkspaceRole
├── invited_by_user_id: int (FK → users.id)
├── token: str(255) — secrets.token_urlsafe(32)
├── status: InvitationStatus (pending / accepted / expired / cancelled)
├── expires_at: datetime(tz)
├── created_at: datetime(tz)  ← TimestampMixin
├── updated_at: datetime(tz)  ← TimestampMixin
```

**Индексы:**
- `UNIQUE(token)` — lookup по токену
- `UNIQUE(workspace_id, email) WHERE status = 'pending'` — **один pending инвайт на email+workspace** (fix #6)
- `INDEX(email, status)` — при регистрации: найти все pending

**Enum:**
```python
class InvitationStatus(enum.StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
```

### 3.3 Не трогаем

`workspaces`, `workspace_members`, `content_items`, `transcriptions` — структура не меняется.

---

## 4. Новые API эндпоинты

### 4.1 Platform Owner (`/api/v1/platform`)

| Method | Path | Описание | Доступ |
|--------|------|----------|--------|
| GET | `/workspaces` | Все воркспейсы (пагинация, поиск, `include_personal` query param) | PLATFORM_OWNER |
| GET | `/workspaces/{workspace_id}` | Детали воркспейса (members, stats) | PLATFORM_OWNER |
| POST | `/workspaces/{workspace_id}/join` | Добавить себя как member с выбранной ролью **(fix #2)** | PLATFORM_OWNER |
| GET | `/users` | Все юзеры платформы | PLATFORM_OWNER |

### 4.2 Workspace invitations (`/api/v1/workspaces/{workspace_id}/invitations`)

| Method | Path | Описание | Доступ |
|--------|------|----------|--------|
| POST | `/` | Создать приглашение → вернуть invite link | OWNER, ADMIN |
| GET | `/` | Список приглашений | OWNER, ADMIN |
| DELETE | `/{invitation_id}` | Отменить приглашение | OWNER, ADMIN |

### 4.3 Invitation acceptance (`/api/v1/invitations`)

| Method | Path | Описание | Доступ |
|--------|------|----------|--------|
| GET | `/{token}` | Инфо об инвайте (workspace name, role). Проверяет `expires_at`. | Public |
| POST | `/{token}/accept` | Принять инвайт. **Проверяет email == current_user.email (fix #4)** | Authenticated |

### 4.4 Ownership transfer (`/api/v1/workspaces/{workspace_id}`)

| Method | Path | Описание | Доступ |
|--------|------|----------|--------|
| POST | `/transfer-ownership` | Передать ownership другому member **(fix #3)** | OWNER only |

---

## 5. Три точки авторизации (fix #1 — КРИТИЧНО)

### Проблема

Platform owner bypass нужен в **3 местах**, а не в одном:

| Точка | Где | Что использует |
|-------|-----|---------------|
| `get_workspace_from_path` | `app/dependencies.py` | `content.py`, `transcription.py` |
| `WorkspaceService._require_membership` | `app/services/workspace_service.py` | `get_workspace_detail`, `update_workspace`, `delete_workspace` |
| `WorkspaceMemberService._require_manage_permission` | `app/services/workspace_member_service.py` | `add_member`, `update_member_role`, `remove_member` |

Плюс отдельные проверки в `list_members` и `leave_workspace`.

### Решение: helper-функция + synthetic member

```python
# app/utils/platform.py (новый файл)
def make_synthetic_viewer(user_id: int, workspace_id: int) -> WorkspaceMember:
    """Создаёт synthetic VIEWER member для platform owner (read-only)."""
    member = WorkspaceMember.__new__(WorkspaceMember)
    member.id = -1  # sentinel, не в БД
    member.user_id = user_id
    member.workspace_id = workspace_id
    member.role = WorkspaceRole.VIEWER
    return member
```

Применяем в 3 точках:
1. `get_workspace_from_path` → если `is_platform_owner` и нет реального membership → synthetic VIEWER
2. `_require_membership` → аналогично
3. `_require_manage_permission` → platform owner **НЕ** получает manage-доступ через synthetic (VIEWER не в MANAGE_ROLES). Для manage — нужен реальный membership через `/platform/.../join`.

**Важно**: если platform owner УЖЕ является реальным member (через join) — используем реальный membership, НЕ synthetic.

---

## 6. Дыры и решения (полный реестр)

### 6.1 КРИТИЧЕСКИЕ

| # | Дыра | Решение | Где фиксить |
|---|------|---------|-------------|
| 1 | 3 точки авторизации, а не одна | Helper + synthetic member в 3 местах | Секция 5 выше |
| 2 | Platform owner не может join workspace | `POST /platform/workspaces/{id}/join` | Новый endpoint |
| 3 | Нет transfer ownership, OWNER заблокирован | `POST /workspaces/{id}/transfer-ownership` | Новый endpoint |

### 6.2 ВЫСОКИЕ (security)

| # | Дыра | Решение | Где фиксить |
|---|------|---------|-------------|
| 4 | Invitation accept без проверки email | Проверять `invitation.email == current_user.email` | `InvitationService.accept()` |
| 5 | Race condition при accept | `SELECT ... FOR UPDATE` на invitation row | `InvitationRepository.get_by_token_for_update()` |
| 6 | Дубликаты invitations | Partial unique index `(workspace_id, email) WHERE status='pending'` | Migration |
| 7 | Soft-deleted workspace + pending invites | При accept: проверять `workspace.deleted_at IS NULL`. При soft-delete workspace: cancel все pending invites. | `InvitationService`, `WorkspaceService` |

### 6.3 СРЕДНИЕ

| # | Дыра | Решение | Где фиксить |
|---|------|---------|-------------|
| 8 | `WorkspaceResponse.role` для platform owner | Отдельная `PlatformWorkspaceResponse` без `role` | `app/schemas/platform.py` |
| 9 | ADMIN может демотировать другого ADMIN | Добавить: `if target.role == ADMIN and actor.role != OWNER: raise` | `workspace_member_service.py` |
| 10 | Invitation expiry — кто отмечает? | Query-time check: `WHERE expires_at > now()`. Celery periodic cleanup — отложить. | `InvitationRepository` |
| 11 | Invite link URL — нужен frontend_url | Добавить `frontend_url` в `config.py`. Link = `{frontend_url}/invite/{token}` | `config.py`, `InvitationService` |
| 12 | Multi-invite accept при register | auto-accept: ловить `ConflictException` per invite, skip если уже member | `AuthService.register()` |

### 6.4 Лимиты (hardcoded MVP)

| Лимит | Значение | Где |
|-------|----------|-----|
| Max members per workspace | 50 | `WorkspaceMemberService.add_member()` |
| Max pending invitations per workspace | 20 | `InvitationService.create()` |
| Invitation expiry | 7 дней | `InvitationService.create()` |
| Token entropy | `secrets.token_urlsafe(32)` | `InvitationService.create()` |

---

## 7. Файлы, которые будут затронуты

### Новые файлы

| Файл | Что |
|------|-----|
| `app/models/invitation.py` | WorkspaceInvitation model + InvitationStatus enum |
| `app/schemas/invitation.py` | CreateInvitationRequest, InvitationResponse |
| `app/schemas/platform.py` | PlatformWorkspaceResponse, PlatformUserResponse |
| `app/repositories/invitation_repository.py` | Invitation DB access (with FOR UPDATE) |
| `app/services/invitation_service.py` | Invitation business logic |
| `app/services/platform_service.py` | Platform-level operations |
| `app/api/platform.py` | Platform endpoints |
| `app/api/invitations.py` | Invitation endpoints (workspace-scoped + public) |
| `migrations/versions/xxx_add_invitations_and_platform_owner.py` | Migration |

### Изменяемые файлы

| Файл | Что меняется |
|------|-------------|
| `app/models/user.py` | + `is_platform_owner` field |
| `app/models/__init__.py` | + export WorkspaceInvitation |
| `app/dependencies.py` | + `require_platform_owner`, platform owner bypass в `get_workspace_from_path` |
| `app/services/workspace_service.py` | + platform owner bypass в `_require_membership`, + transfer ownership, + cancel invites при soft-delete |
| `app/services/workspace_member_service.py` | + platform owner bypass в `_require_manage_permission` и `list_members`, fix #9 ADMIN vs ADMIN |
| `app/services/auth_service.py` | + auto-accept pending invitations при register |
| `app/api/workspaces.py` | + transfer-ownership endpoint |
| `app/api/router.py` | + подключение platform и invitation routers |
| `app/schemas/user.py` | + `is_platform_owner` в UserResponse |
| `app/config.py` | + `frontend_url` setting |

### НЕ трогаем

| Файл | Почему |
|------|--------|
| `app/models/workspace.py` | WorkspaceRole enum уже полный |
| `app/api/content.py` | Role checks уже на месте |
| `app/api/transcription.py` | Role checks уже на месте |
| `app/repositories/content_repository.py` | Workspace filtering работает |
| `migrations/versions/*` | Protected |

---

## 8. Итоговая оценка

| Метрика | Значение |
|---------|----------|
| Новых файлов | 9 |
| Изменённых файлов | 10 |
| Новых таблиц в БД | 1 (workspace_invitations) |
| Новых полей | 1 (users.is_platform_owner) |
| Breaking changes для фронта | 0 |
| Новых API endpoints | 10 |
| Закрытых дыр | 12 |
