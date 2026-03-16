# Changelog

## Sprint 6 — Knowledge Graph Foundation (2026-03-13)

### Summary

Backend foundation for the Knowledge Graph feature — structured knowledge management at company and workspace levels.

### Database

- 4 new tables: `company_members`, `knowledge_nodes`, `knowledge_edges`, `knowledge_node_versions`
- CHECK constraint `ck_knowledge_nodes_scope` ensures node belongs to exactly one scope
- Partial unique index `uq_ke_pair_label` prevents duplicate edges
- Migration: `a449b211dd87`

### Models & Enums

- `KnowledgeNode` — nodes with TipTap JSON content, scoped to company or workspace
- `KnowledgeEdge` — labeled, weighted edges between nodes with scope validation
- `KnowledgeNodeVersion` — automatic version snapshots on every change
- `CompanyMember` — company-level membership with OWNER/ADMIN/MEMBER roles
- `NodeType`: target_audience, meaning, channel, funnel, competitor, seo, brand, note
- `ScopeType`: company, workspace
- `ChangeType`: created, updated, ai_created, ai_updated

### API Endpoints (20 total)

**Workspace Knowledge** (`/workspaces/{id}/knowledge`) — 10 endpoints:
- Nodes: GET list, POST create, GET detail, PATCH update, DELETE soft-delete
- Versions: GET node history
- Edges: POST create, DELETE soft-delete
- Graph: GET full graph (workspace + company nodes)
- Positions: PATCH batch update

**Company Knowledge** (`/companies/{id}/knowledge`) — 10 endpoints:
- Same structure as workspace knowledge, scoped to company

**Company Members** (`/companies/{id}/members`) — 4 endpoints:
- GET list, POST add, PATCH update role, DELETE remove

### Services & Repositories

- `KnowledgeService` — CRUD nodes/edges, graph, batch positions, version history, edge scope validation
- `CompanyMemberService` — CRUD with OWNER protection
- `KnowledgeNodeRepository`, `KnowledgeEdgeRepository`, `KnowledgeVersionRepository`, `CompanyMemberRepository`
- `TipTap utility` — JSON to plain text conversion for AI processing

### Dependencies

- `get_company_member` — company membership check with platform owner bypass
- `require_company_admin` — OWNER/ADMIN gate, returns CompanyMember

### Tests

- 16 new tests (11 knowledge + 5 company members), 83 existing pass

---

## Sprint 4 — Workspaces & Teams

### Chunk 2: Platform owner read-only bypass (2026-03-12)

**Commit:** `7aa10d4` — `feat(auth): add platform owner read-only access to all workspaces`

- Added `require_platform_owner` dependency
- Platform owner gets synthetic VIEWER access to all workspaces (read-only)
- Bypass in 3 authorization points: `get_workspace_from_path`, `_require_membership`, `list_members` / `leave_workspace`
- Fix #9: ADMIN cannot modify or remove another ADMIN — only OWNER can
- Added `is_platform_owner` field to `UserResponse` schema

### Chunk 1: DB models + migration (2026-03-12)

**Commit:** (included in `7aa10d4`) — `feat(models): add WorkspaceInvitation model and is_platform_owner field`

- Added `is_platform_owner` boolean to `User` model
- Created `WorkspaceInvitation` model with `InvitationStatus` enum
- Migration `1df12fc898d5` applied
- Added `frontend_url` to config
