# Roadmap — DENCO Content Hub Frontend

## Sprint 1 — Auth & Skeleton

- [x] Login / Register pages
- [x] Auth store (Zustand) + token management
- [x] API client setup (hey-api)
- [x] Root layout + AppProviders (Mantine, TanStack Query)
- [x] Middleware auth guard

## Sprint 2 — Dashboard & Workspaces

- [x] AppShell layout (header, sidebar, navbar)
- [x] Workspace store + workspace switcher
- [x] Dashboard page
- [x] Workspace CRUD hooks

## Sprint 3 — Content & Library

- [x] Library page (content list, add/delete/retry)
- [x] Content detail page with transcription
- [x] Status badges, pagination, search/filter
- [x] Shared components (LoadingState, ErrorState, EmptyState)

## Sprint 4 — Teams & Invitations

- [x] Settings page (tabs: Team, Invitations)
- [x] Team members list + remove
- [x] Invitation create (link generation) + cancel
- [x] Invite accept page (`/invite`)

## Sprint 5 — Companies ✅

- [x] **Chunk 4**: Company store (Zustand + cookie persist), API hooks (5 CRUD hooks), hey-api regenerate
- [x] **Chunk 5**: CompanySwitcher в header (Select dropdown, platform owner only, client-side filter)
- [x] **Chunk 6**: Company management page (`/companies`) — CRUD, пагинация, поиск, route guard, nav link

## Sprint 6 — Company Roles & Permissions (planned)

- [ ] Company-level roles (admin, member, viewer)
- [ ] Company membership management UI
- [ ] Workspace slug scoping per company

## Sprint 7 — Billing & Limits (planned)

- [ ] Billing integration
- [ ] Usage limits per company
- [ ] Plan management UI
