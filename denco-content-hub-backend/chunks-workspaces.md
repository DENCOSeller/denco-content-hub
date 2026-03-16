# Chunks: Workspaces & Roles — пошаговая реализация

> Каждый chunk = 1-2 часа. Независимый. Тестируемый. Коммитится отдельно.
> Ссылки на дыры: `strategy-workspaces.md` секция 6.

---

## Chunk 1: DB models + migration

**Цель**: Подготовить фундамент в БД. Ноль изменений в поведении.

**Файлы:**
| Действие | Файл |
|----------|------|
| Изменить | `app/models/user.py` — добавить `is_platform_owner: Mapped[bool]` |
| Создать | `app/models/invitation.py` — `WorkspaceInvitation` model, `InvitationStatus` enum |
| Изменить | `app/models/__init__.py` — export `WorkspaceInvitation` |
| Изменить | `app/config.py` — добавить `frontend_url: str = "http://localhost:3000"` |
| Создать | Migration via `alembic revision --autogenerate` |

**Детали модели `WorkspaceInvitation`:**
- `TimestampMixin` (created_at, updated_at)
- НЕ `SoftDeleteMixin` — статусная модель (PENDING → ACCEPTED/EXPIRED/CANCELLED)
- Partial unique index: `UNIQUE(workspace_id, email) WHERE status = 'pending'` (fix #6)
- Unique index: `UNIQUE(token)`
- Index: `(email, status)` для auto-accept при register

**Проверка**: `alembic upgrade head` без ошибок. Существующие тесты проходят.

**Коммит**: `feat(models): add WorkspaceInvitation model and is_platform_owner field`

---

## Chunk 2: Platform owner dependency + bypass в 3 точках

**Цель**: Platform owner получает read-only доступ ко ВСЕМ воркспейсам. Закрывает fix #1.

**Файлы:**
| Действие | Файл |
|----------|------|
| Изменить | `app/dependencies.py` — `require_platform_owner()`, bypass в `get_workspace_from_path` |
| Изменить | `app/services/workspace_service.py` — bypass в `_require_membership()` |
| Изменить | `app/services/workspace_member_service.py` — bypass в `_require_manage_permission()`, `list_members()`, `leave_workspace()` |
| Изменить | `app/schemas/user.py` — `is_platform_owner` в `UserResponse` |

**Логика bypass (одинаковая в 3 точках):**
```
1. Проверить реальный membership
2. Если есть → вернуть реальный (даже для platform owner)
3. Если нет + is_platform_owner → synthetic VIEWER
4. Если нет + обычный юзер → NotFoundException
```

**Для `_require_manage_permission`**: synthetic VIEWER НЕ проходит (VIEWER not in MANAGE_ROLES). Platform owner без реального membership не может управлять members — это ожидаемо.

**Fix #9 (ADMIN vs ADMIN)**: в `update_member_role` добавить:
```python
if target_member.role == WorkspaceRole.ADMIN and actor_member.role != WorkspaceRole.OWNER:
    raise ForbiddenException("Only owner can modify admin members")
```

**Проверка**: Существующие тесты проходят. Вручную: `is_platform_owner=True` в БД → юзер видит чужой workspace через `GET /workspaces/{id}`, не может delete/update.

**Коммит**: `feat(auth): add platform owner read-only access to all workspaces`

---

## Chunk 3: Platform API (endpoints)

**Цель**: PLATFORM_OWNER получает админку — список воркспейсов, юзеров, join. Закрывает fix #2, #8.

**Файлы:**
| Действие | Файл |
|----------|------|
| Создать | `app/schemas/platform.py` — `PlatformWorkspaceResponse` (без role!), `PlatformUserResponse` |
| Создать | `app/services/platform_service.py` — list workspaces, list users, join workspace |
| Создать | `app/api/platform.py` — 4 endpoints |
| Изменить | `app/api/router.py` — подключить platform router |
| Изменить | `app/repositories/workspace_repository.py` — `get_all_workspaces(pagination, search, include_personal)` |
| Изменить | `app/repositories/user_repository.py` — `get_all_users(pagination, search)` |

**Endpoints:**
```
GET  /api/v1/platform/workspaces                   — все ws, фильтр include_personal (default=false)
GET  /api/v1/platform/workspaces/{workspace_id}    — детали + members count
POST /api/v1/platform/workspaces/{workspace_id}/join — добавить себя как member
GET  /api/v1/platform/users                         — все юзеры
```

**`PlatformWorkspaceResponse`** (fix #8):
```python
class PlatformWorkspaceResponse(BaseModel):
    id: int
    name: str
    slug: str
    is_personal: bool
    members_count: int
    content_count: int
    created_at: datetime
    # НЕТ поля role — platform owner не member
```

**Join логика:**
- Проверить что не уже member
- Принимает `role` в body (любая кроме OWNER)
- Создаёт реальный `WorkspaceMember`

**Проверка**: Тесты на все 4 endpoints. Обычный юзер получает 403 на `/platform/*`.

**Коммит**: `feat(platform): add admin API for workspaces and users`

---

## Chunk 4: Transfer ownership

**Цель**: OWNER может передать ownership. Закрывает fix #3.

**Файлы:**
| Действие | Файл |
|----------|------|
| Изменить | `app/services/workspace_service.py` — `transfer_ownership()` |
| Изменить | `app/api/workspaces.py` — `POST /{workspace_id}/transfer-ownership` |
| Создать | `app/schemas/workspace.py` — `TransferOwnershipRequest` (target_member_id) |

**Логика:**
1. Только OWNER может вызвать
2. Target member должен существовать в этом workspace
3. Target member не может быть OWNER (уже)
4. Нельзя transfer personal workspace
5. Атомарно: старый OWNER → ADMIN, target → OWNER
6. Одна транзакция

**Проверка**: Тест: owner transfers → старый стал ADMIN, новый стал OWNER. Тест: не-owner получает 403. Тест: personal workspace → 403.

**Коммит**: `feat(workspaces): add ownership transfer endpoint`

---

## Chunk 5: Invitation model layer (repository + service)

**Цель**: Бизнес-логика инвайтов без API. Закрывает fix #5, #6, #7, #10.

**Файлы:**
| Действие | Файл |
|----------|------|
| Создать | `app/repositories/invitation_repository.py` |
| Создать | `app/services/invitation_service.py` |
| Создать | `app/schemas/invitation.py` |

**Repository методы:**
```python
get_by_token(token) → InvitationResponse | None
get_by_token_for_update(token) → WorkspaceInvitation | None  # SELECT ... FOR UPDATE (fix #5)
get_pending_by_email(email) → list[WorkspaceInvitation]  # для auto-accept
list_by_workspace(workspace_id, params) → PaginatedResponse
count_pending_by_workspace(workspace_id) → int  # для лимита
cancel_all_for_workspace(workspace_id) → None  # для soft-delete ws (fix #7)
```

**Service методы:**
```python
create_invitation(actor, workspace_id, data) → InvitationResponse
    - require OWNER/ADMIN
    - check лимит 20 pending per workspace
    - check workspace.deleted_at IS NULL (fix #7)
    - check нет existing pending для (workspace_id, email) — partial unique поймает, но лучше явная ошибка
    - check юзер не уже member
    - token = secrets.token_urlsafe(32)
    - expires_at = now + 7 days
    - invite_link = f"{settings.frontend_url}/invite/{token}"
    - return response с invite_link

accept_invitation(token, current_user) → WorkspaceMember
    - get_by_token_for_update (fix #5 — row lock)
    - check status == PENDING
    - check expires_at > now (fix #10)
    - check invitation.email == current_user.email (fix #4)
    - check workspace.deleted_at IS NULL (fix #7)
    - check не уже member
    - создать WorkspaceMember
    - status → ACCEPTED
    - commit

cancel_invitation(actor, workspace_id, invitation_id) → None
    - require OWNER/ADMIN
    - check invitation belongs to workspace
    - check status == PENDING
    - status → CANCELLED

get_invitation_info(token) → InvitationPublicResponse
    - public endpoint, без auth
    - check status == PENDING и expires_at > now
    - return workspace_name, role, invited_by_name (без sensitive data)
```

**Schemas:**
```python
CreateInvitationRequest:
    email: EmailStr
    role: WorkspaceRole  # validator: != OWNER

InvitationResponse:
    id, workspace_id, email, role, status, invite_link, expires_at, created_at

InvitationPublicResponse:  # для GET /invitations/{token} (public)
    workspace_name: str
    role: WorkspaceRole
    email: str  # masked: j***@example.com
    expires_at: datetime
```

**Проверка**: Unit-тесты на сервис. Все edge cases: expired, cancelled, duplicate, wrong email, deleted workspace.

**Коммит**: `feat(invitations): add invitation service and repository`

---

## Chunk 6: Invitation API endpoints

**Цель**: HTTP endpoints для инвайтов.

**Файлы:**
| Действие | Файл |
|----------|------|
| Создать | `app/api/invitations.py` — 5 endpoints (3 workspace-scoped + 2 public) |
| Изменить | `app/api/router.py` — подключить invitation router |

**Workspace-scoped** (require `get_workspace_from_path` + OWNER/ADMIN):
```
POST   /api/v1/workspaces/{workspace_id}/invitations
GET    /api/v1/workspaces/{workspace_id}/invitations
DELETE /api/v1/workspaces/{workspace_id}/invitations/{invitation_id}
```

**Public/Auth:**
```
GET  /api/v1/invitations/{token}          — public, no auth
POST /api/v1/invitations/{token}/accept   — requires auth
```

**Проверка**: Integration тесты. Full flow: create invite → get info → accept → verify member.

**Коммит**: `feat(invitations): add invitation API endpoints`

---

## Chunk 7: Registration auto-accept + workspace soft-delete cleanup

**Цель**: Новый юзер автоматически вступает в воркспейсы по pending инвайтам. Soft-delete workspace отменяет инвайты. Закрывает fix #7, #12.

**Файлы:**
| Действие | Файл |
|----------|------|
| Изменить | `app/services/auth_service.py` — auto-accept в `register()` |
| Изменить | `app/services/workspace_service.py` — cancel invites в `delete_workspace()` |

**Auto-accept логика:**
```python
# В register(), после создания юзера и personal workspace:
invitation_repo = InvitationRepository(self.db)
member_repo = WorkspaceMemberRepository(self.db)

pending = await invitation_repo.get_pending_by_email(user.email)
for inv in pending:
    # Проверяем что workspace не удалён
    ws = await workspace_repo.get_by_id_or_none(inv.workspace_id)
    if not ws or ws.deleted_at is not None:
        inv.status = InvitationStatus.CANCELLED
        continue
    # Проверяем что не уже member (fix #12 — дубликаты)
    existing = await member_repo.get_membership(user.id, inv.workspace_id)
    if existing:
        inv.status = InvitationStatus.CANCELLED
        continue
    # Accept
    await member_repo.add_member(user.id, inv.workspace_id, inv.role)
    inv.status = InvitationStatus.ACCEPTED
```

**Soft-delete cleanup (fix #7):**
```python
# В delete_workspace(), после soft_delete:
await invitation_repo.cancel_all_for_workspace(workspace_id)
```

**Проверка**: Тест: register с pending invite → юзер сразу member. Тест: register с invite на deleted workspace → invite cancelled, юзер не member. Тест: delete workspace → все pending invites cancelled.

**Коммит**: `feat(auth): auto-accept invitations on registration`

---

## Порядок и зависимости

```
Chunk 1 (DB) ─────┬── Chunk 2 (Platform bypass) ── Chunk 3 (Platform API)
                   │
                   ├── Chunk 4 (Transfer ownership)  [независим от 2-3]
                   │
                   └── Chunk 5 (Invitation service) ── Chunk 6 (Invitation API) ── Chunk 7 (Auto-accept)
```

**Параллельно можно делать:**
- Chunk 2 и Chunk 4 и Chunk 5 — после Chunk 1
- Chunk 3 — после Chunk 2
- Chunk 6 — после Chunk 5
- Chunk 7 — после Chunk 6

---

## Контрольный список после всех chunks

- [ ] `ruff check . && ruff format .`
- [ ] `pyrefly check .`
- [ ] `pytest -v --cov=app`
- [ ] Проверить OpenAPI schema — новые endpoints видны, старые не сломаны
- [ ] Вручную: создать platform owner в БД, проверить доступ
- [ ] Вручную: полный flow инвайта (create → copy link → register → auto-accept)
- [ ] Вручную: transfer ownership
