# Golf Cart Rental Management System — Implementation Tracker

**Project:** Golf Cart Rental Management System
**PRD Version:** 1.0
**Last Updated:** 2026-04-11
**Updated By:** PM / Architect

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete |
| `[!]` | Blocked |

---

## Deviations from PRD

> Log any implementation decisions that differ from the PRD here.
> If a deviation is significant, flag for PRD version bump.

| Date | Phase | Deviation | Reason | PRD Update Needed? |
|------|-------|-----------|--------|-------------------|
| 2026-04-09 | Phase 1 — Foundation | Dev Postgres host port uses `5440` instead of PRD sample port `5432` | Local machine already has other Postgres instances bound to common ports | No |
| 2026-04-09 | Phase 1 — Foundation | Added root `.env.example` and contributor `README.md` before the Phase 7 documentation milestone | User explicitly requested earlier contributor onboarding docs and environment setup guidance | No |
| 2026-04-10 | Phase 2 — Auth & Multi-Tenancy | `POST /auth/login` and `POST /auth/customer/login` accept `organizationSlug` in the request body | Schema `@@unique([organizationId, email])` means email is not globally unique; tenant must be identified at login time. PRD rule "never `organizationId` in body" applies to protected routes only. | No |
| 2026-04-11 | Phase 6 — Frontend | Added Design Foundation task group before App Foundation | PRD had no design system or component library tasks; required before any page work begins | No |
| 2026-04-11 | Phase 6 — Frontend | Component library: shadcn/ui | Chosen for unstyled primitives, CSS variable theming compatibility, and Phase 2 runtime theming readiness | No |
| 2026-04-11 | Phase 6 — Frontend | Design language: minimalist/Apple-inspired, neutral default palette, Inter font | Client direction; token system designed to support per-org runtime theming in Phase 2 with no component refactoring | No |
| 2026-04-11 | Phase 6 — Frontend | Logo slot designed into sidebar from MVP | Org logo renders if available, falls back to org name text; `Organization.logoUrl` field to be added in Phase 2 alongside theming settings UI | No |

---

## Phase 1 — Foundation

**Goal:** Monorepo scaffold, database schema, local dev environment running.
**Status:** Complete
**Completed:** Monorepo scaffold, Shared package bootstrap, Prisma schema, Initial Prisma migration, Docker dev environment, NestJS app bootstrap, Prisma module + service wiring, Root workspace scripts, Dev seed script

### Tasks
- [x] Monorepo scaffold (pnpm workspaces, folder structure per PRD)
- [x] Shared package bootstrap (enums, types, index exports)
- [x] Prisma schema (full data model per PRD section 5)
- [x] Initial Prisma migration (`0001_init`)
- [x] Docker dev environment (Postgres container running locally)
- [x] NestJS app bootstrap (`main.ts`, `app.module.ts`, global exception filter)
- [x] Prisma module + service wired into NestJS
- [x] Root `package.json` scripts validated (`dev:api`, `dev:web`, `db:migrate`, `db:studio`)
- [x] Dev seed script (`pnpm db:seed` — org, users, customer, cart type, cart)

### Notes
> Add implementation notes, decisions, or issues here as tasks are completed.

- 2026-04-09: Created the initial pnpm workspace manifests and PRD-aligned directory scaffold for `apps/api`, `apps/web`, `packages/shared`, and `docker`.
- 2026-04-09: Kept the scaffold intentionally minimal to avoid pulling Phase 1 follow-on tasks forward; Nest bootstrap, Prisma schema, Docker Compose files, and shared exports remain separate tasks.
- 2026-04-09: Initialized the local Git repository, added a stack-specific `.gitignore`, connected the `origin` remote to GitHub, and pushed the initial `main` branch.
- 2026-04-09: Added the shared package enums, grouped API-safe entity contract types, and root exports. `passwordHash` fields were intentionally excluded from shared contracts because the package is consumed by both the API and web apps.
- 2026-04-09: Added the full Prisma schema in `apps/api/prisma/schema.prisma`, following PRD section 5 and mapping camelCase schema fields to snake_case database columns per the project engineering standards.
- 2026-04-09: Bootstrapped the `api` workspace with Prisma CLI and `@prisma/client` plus package-local Prisma scripts to unblock schema validation and the upcoming initial migration task.
- 2026-04-09: Added `docker/docker-compose.dev.yml` for local Postgres development and bound the host to port `5440` to avoid collisions with other local database instances.
- 2026-04-09: Started the dev Postgres container and generated the initial Prisma migration via `prisma migrate dev --name 0001_init`; Prisma created `apps/api/prisma/migrations/20260409204617_0001_init/migration.sql` and applied it successfully.
- 2026-04-09: Added the initial NestJS bootstrap in `apps/api/src` with `main.ts`, `app.module.ts`, a global exception filter, and a global response-envelope interceptor so API responses follow the PRD envelope conventions from the start.
- 2026-04-09: Added `api` workspace build/start/test scripts plus a compiled Node test that verifies the `/v1` prefix and standardized success/error envelopes.
- 2026-04-09: Added `PrismaModule` and `PrismaService`, imported the module into `AppModule`, and verified the provider resolves through Nest DI and can query the local dev Postgres instance.
- 2026-04-09: Re-ran `prisma generate` after wiring the Nest Prisma service so the generated Prisma client types matched the existing schema in the current workspace state.
- 2026-04-09: Added root workspace scripts for `dev:api`, `dev:web`, `db:migrate`, and `db:studio`.
- 2026-04-09: Validated the root scripts directly. `dev:api` started the Nest app successfully on port `3000`, `db:migrate` completed against the local dev Postgres instance, and `db:studio` launched successfully on a custom port during validation.
- 2026-04-09: `dev:web` is intentionally a placeholder script for Phase 1 workspace validation only; the real Vite dev server remains scoped to the Phase 6 frontend scaffold task.
- 2026-04-09: Documented the root developer commands in `AGENTS.md` so future agents can discover and reuse the validated workspace scripts without re-deriving them from `package.json`.
- 2026-04-09: Added a root `.env.example` and a contributor-facing `README.md` with clone, install, database, migration, and run instructions that match the current Phase 1 repository state.
- 2026-04-09: Switched the API and Prisma scripts to load configuration from the root `.env` file directly and removed the temporary root `DATABASE_URL` fallback helper.

---

## Phase 2 — Auth & Multi-Tenancy

**Goal:** Secure, role-based auth working for staff and customers. Org scoping enforced on all requests.
**Status:** Complete
**Completed:** Staff/admin JWT auth (login, refresh, logout), Customer JWT auth (login), JWT strategies, JwtAuthGuard, CustomerJwtGuard, RolesGuard, OrgGuard, @Roles() decorator, @CurrentUser() decorator, guard registration per-module, cross-org mismatch rejection

### Tasks
- [x] Staff/admin JWT auth — login endpoint (`POST /auth/login`)
- [x] Staff/admin JWT auth — refresh endpoint (`POST /auth/refresh`)
- [x] Staff/admin JWT auth — logout endpoint (`POST /auth/logout`)
- [x] Customer JWT auth — login endpoint (`POST /auth/customer/login`)
- [x] JWT strategy — staff claims: `{ userId, organizationId, role }`
- [x] JWT strategy — customer claims: `{ customerId, organizationId, role: 'customer' }`
- [x] `JwtAuthGuard` — validates token on protected routes
- [x] `RolesGuard` — validates role from token claims
- [x] `OrgGuard` — injects `organizationId` from token, prevents cross-org access
- [x] `@Roles()` decorator wired to `RolesGuard`
- [x] `@CurrentUser()` decorator to extract user from request
- [x] All guards registered globally or per-module as agreed
- [x] Cross-org access rejection validated (`ORG_MISMATCH` → 403)

### Notes
- 2026-04-10: `POST /auth/login` (and customer/login) requires `organizationSlug` in the request body to identify the tenant, since `@@unique([organizationId, email])` means the same email can exist in multiple orgs. This is a pre-auth endpoint so the PRD rule of "never `organizationId` in the request body" applies only to protected routes.
- 2026-04-10: Added `CustomerJwtGuard` (extends `AuthGuard('customer-jwt')`) in addition to the tracked `JwtAuthGuard`. PRD section 8 explicitly calls for separate customer guards; this is not a deviation.
- 2026-04-10: Added `refreshTokenHash String?` to `User` and `Customer` Prisma models (migration `20260409221052_add_refresh_token_hash`). Refresh tokens are stored as bcrypt hashes so logout can invalidate them without a separate token table.
- 2026-04-10: `pnpm.onlyBuiltDependencies` added to root `package.json` to allow `bcrypt` and Prisma to run native build scripts during `pnpm install`.
- 2026-04-10: Added `ValidationPipe({ whitelist: true })` globally in `app.setup.ts` to enforce class-validator rules on all DTOs.
- 2026-04-10: All 14 integration tests pass (11 new auth tests + 3 existing Phase 1 tests).

---

## Phase 3 — Core Inventory

**Goal:** All core entities (orgs, locations, carts, customers, users) manageable via API.
**Status:** Complete
**Completed:** Organizations endpoints (`GET /organizations`, `POST /organizations`, `GET /organizations/:id`, `PATCH /organizations/:id`), Locations endpoints (`GET /locations`, `POST /locations`, `GET /locations/:id`, `PATCH /locations/:id`), Users endpoints (`GET /users`, `POST /users`, `GET /users/:id`, `PATCH /users/:id`, `DELETE /users/:id`), Customers endpoints (`GET /customers`, `POST /customers`, `GET /customers/:id`, `PATCH /customers/:id`) with duplicate email conflict handling, Cart Types endpoints (`GET /cart-types`, `POST /cart-types`, `GET /cart-types/:id`, `PATCH /cart-types/:id`, `DELETE /cart-types/:id`) with in-use protection, and Carts endpoints (`GET /carts`, `POST /carts`, `GET /carts/:id`, `PATCH /carts/:id`) with status transition validation

### Tasks

#### Organizations
- [x] `GET /organizations` — list all orgs (super_admin only)
- [x] `POST /organizations` — create org
- [x] `GET /organizations/:id` — get org
- [x] `PATCH /organizations/:id` — update org (name, status, settings)

#### Locations
- [x] `GET /locations` — list locations for org
- [x] `POST /locations` — create location
- [x] `GET /locations/:id` — get location
- [x] `PATCH /locations/:id` — update location

#### Users
- [x] `GET /users` — list users in org
- [x] `POST /users` — create user (org_admin only), password hashing
- [x] `GET /users/:id` — get user
- [x] `PATCH /users/:id` — update user
- [x] `DELETE /users/:id` — soft delete (set `isActive = false`)

#### Customers
- [x] `GET /customers` — list customers in org
- [x] `POST /customers` — create customer (composite unique enforced)
- [x] `GET /customers/:id` — get customer
- [x] `PATCH /customers/:id` — update customer
- [x] Duplicate email rejection (`CUSTOMER_EMAIL_EXISTS` → 409)

#### Cart Types
- [x] `GET /cart-types` — list cart types for org
- [x] `POST /cart-types` — create cart type
- [x] `GET /cart-types/:id` — get cart type
- [x] `PATCH /cart-types/:id` — update cart type
- [x] `DELETE /cart-types/:id` — delete (reject if carts assigned → `CART_TYPE_IN_USE` → 409)

#### Carts
- [x] `GET /carts` — list carts (filters: `?locationId=&status=`)
- [x] `POST /carts` — register new cart
- [x] `GET /carts/:id` — get cart details
- [x] `PATCH /carts/:id` — update cart
- [x] Cart status transition validation (invalid transitions rejected → `INVALID_STATUS_TRANSITION` → 422)

### Notes
> Add implementation notes, decisions, or issues here as tasks are completed.

- 2026-04-10: Implemented `GET /organizations` with `super_admin` access control (`JwtAuthGuard` → `RolesGuard` → `OrgGuard`) and consistent response envelopes.
- 2026-04-10: Added a reusable API-wide pagination/search pattern in `apps/api/src/common/pagination` (`page`, `pageSize`, `search`) plus envelope `meta.pagination` support in the shared response interceptor utilities.
- 2026-04-10: Added integration tests for organizations listing, role enforcement, pagination/search behavior, and invalid pagination query validation.
- 2026-04-10: Implemented `POST /organizations`, `GET /organizations/:id`, and `PATCH /organizations/:id` for `super_admin`, including request DTO validation, slug uniqueness conflict handling (`409 CONFLICT`), and explicit `404 NOT_FOUND` behavior.
- 2026-04-10: Expanded organizations integration coverage for create/get/update success and error paths, and updated the workspace script test expectation to match the existing root `db:seed` script.
- 2026-04-10: Implemented `GET /locations`, `POST /locations`, `GET /locations/:id`, and `PATCH /locations/:id` with role matrix enforcement (`staff` read, `org_admin/super_admin` write) and strict organization scoping from JWT `organizationId`.
- 2026-04-10: Added locations DTO validation plus shared pagination/search support for location listing and integration tests covering auth, role authorization, pagination validation, cross-org access rejection, and update flows.
- 2026-04-10: Implemented `GET /users`, `POST /users`, `GET /users/:id`, `PATCH /users/:id`, and `DELETE /users/:id` with strict org scoping, `org_admin`-only write access, password hashing on create/update, and soft delete behavior (`isActive=false`).
- 2026-04-10: Added users integration coverage for auth/role permissions, pagination/search listing, duplicate email conflict handling, cross-org isolation, password hash verification, and live curl validation against localhost (`admin@demo-org.com`, `staff@demo-org.com`).
- 2026-04-10: Implemented `GET /customers`, `POST /customers`, `GET /customers/:id`, and `PATCH /customers/:id` with org-scoped queries, password hashing on create/update, and `CUSTOMER_EMAIL_EXISTS` (`409`) on duplicate customer email in the same org.
- 2026-04-10: Added customer integration tests for auth and org isolation, pagination/search listing, create/update password hash verification, and duplicate email conflict behavior. Also validated with live curls against localhost using seeded `staff@demo-org.com` and `admin@demo-org.com` credentials.
- 2026-04-10: Implemented `GET /cart-types`, `POST /cart-types`, `GET /cart-types/:id`, `PATCH /cart-types/:id`, and `DELETE /cart-types/:id` with strict org scoping, shared pagination/search metadata, role matrix enforcement (`staff` read, `org_admin/super_admin` write), and `CART_TYPE_IN_USE` (`409`) protection when carts are assigned.
- 2026-04-10: Implemented `GET /carts`, `POST /carts`, `GET /carts/:id`, and `PATCH /carts/:id` with org-scoped location/cart-type validation, list filters (`locationId`, `status`) plus shared pagination/search metadata, and role handling where `staff` can only patch `status`.
- 2026-04-10: Added explicit cart status transition map validation for all status mutations and return `INVALID_STATUS_TRANSITION` (`422`) when transition rules are violated.
- 2026-04-10: Verified all cart-types and carts endpoints with integration tests and live curls against `http://localhost:3000/v1` using seeded `admin@demo-org.com` and `staff@demo-org.com` credentials.

---

## Phase 4 — Rentals

**Goal:** Full rental lifecycle working for both daily and lease rentals. Double-booking prevention enforced.
**Status:** Complete
**Completed:** Availability endpoint (`GET /carts/availability`) with overlap filtering and transaction-scoped query execution; Daily rental creation (`POST /rentals`) with snapshot pricing, overlap protection, and cart reservation; Lease rental creation and lease contract endpoints; Rental action endpoints (`checkout`, `checkin`, `cancel`, list/detail/update)

### Tasks

#### Availability
- [x] `GET /carts/availability` — availability check endpoint
- [x] Overlap query implemented (per PRD section 6)
- [x] Query runs inside DB transaction to prevent race conditions

#### Daily Rentals
- [x] `POST /rentals` — create daily rental
- [x] Rate snapshot copied from CartType at time of booking
- [x] Double-booking prevention enforced (overlap check in transaction)
- [x] Cart status set to `reserved` on create
- [x] `totalAmount` calculation: `dailyRateSnapshot × days`

#### Lease Rentals
- [x] `POST /rentals` — create lease rental (type: lease)
- [x] `contractMonths` validation against `org.minLeaseMonths` (`LEASE_MIN_MONTHS` → 422)
- [x] `POST /rentals/:id/contract` — create lease contract record
- [x] `PATCH /rentals/:id/contract` — update contract (signed date, document URL)
- [x] `GET /rentals/:id/contract` — get contract
- [x] Rate snapshot copied from CartType at time of booking
- [x] Cart blocked for full contract period

#### Rental Actions
- [x] `POST /rentals/:id/checkout` — validate status, set cart to `rented`
- [x] `POST /rentals/:id/checkin` — set `actualReturnDate`, calculate final `totalAmount`, set cart to `available`
- [x] `POST /rentals/:id/cancel` — release cart to `available`, set rental to `cancelled`
- [x] `GET /rentals` — list rentals (filters: `?type=&status=&customerId=&cartId=`)
- [x] `GET /rentals/:id` — get rental detail
- [x] `PATCH /rentals/:id` — update rental (dates, notes)

### Notes
> Add implementation notes, decisions, or issues here as tasks are completed.

- 2026-04-10: Implemented `GET /carts/availability` in the carts module using org-scoped JWT context with validated query params (`startDate`, `endDate`, `locationId`, `type`).
- 2026-04-10: Availability logic now excludes carts with overlapping `pending`/`active` rentals via the PRD overlap rule (`startDate < endDate` and `endDate > startDate`) while requiring `cart.status = available`.
- 2026-04-10: Executed overlap lookup and available-cart query inside a single Prisma `$transaction`, and added integration tests for overlap exclusion, location filtering, and invalid date-range rejection.
- 2026-04-11: Added `RentalsModule` with `POST /rentals` (staff/admin) for daily rentals, including strict org scoping, date-range validation, and full-day duration validation.
- 2026-04-11: Daily rental creation now runs inside one Prisma `$transaction`: verifies customer/cart ownership, enforces cart availability, applies overlap conflict detection (`RENTAL_OVERLAP`), snapshots `CartType.dailyRate` to `dailyRateSnapshot`, calculates `totalAmount`, creates the rental, and updates cart status to `reserved`.
- 2026-04-11: Added daily rental integration tests for success path, `CART_NOT_AVAILABLE`, `RENTAL_OVERLAP`, cross-org customer rejection, and invalid date ranges; also validated via live curl against `http://127.0.0.1:3000/v1`.
- 2026-04-11: Extended `POST /rentals` to support lease rentals with `contractMonths` validation against `organization.minLeaseMonths` (`LEASE_MIN_MONTHS`), monthly rate snapshotting (`monthlyRateSnapshot`), total amount calculation (`monthlyRateSnapshot × contractMonths`), and contract-period end-date calculation.
- 2026-04-11: Added lease contract endpoints (`POST /rentals/:id/contract`, `PATCH /rentals/:id/contract`, `GET /rentals/:id/contract`) with org-scoped rental checks and lease-only enforcement.
- 2026-04-11: Added lease integration coverage for min-month validation, lease creation, and contract create/update/get flows; validated all lease APIs with live curls using seeded credentials.
- 2026-04-11: Added rental action endpoints (`POST /rentals/:id/checkout`, `POST /rentals/:id/checkin`, `POST /rentals/:id/cancel`) with transactional status updates for both rental and cart, enforcing valid status transitions via `INVALID_STATUS_TRANSITION`.
- 2026-04-11: Implemented rentals listing/detail/update (`GET /rentals`, `GET /rentals/:id`, `PATCH /rentals/:id`) with org scoping, filter support (`type`, `status`, `customerId`, `cartId`), shared pagination metadata, and overlap-safe date updates.
- 2026-04-11: Verified rental actions with integration tests and live curls (create → checkout → checkin, create → cancel, list/detail/patch flow).

---

## Phase 5 — Payments

**Goal:** Manual payment recording per rental. No gateway integration.
**Status:** Complete
**Completed:** Payments endpoints (`GET /rentals/:id/payments`, `POST /rentals/:id/payments`, `PATCH /rentals/:id/payments/:pid`), payment status tracking (`unpaid`, `partial`, `paid`, `refunded`), recorded-by attribution from authenticated staff/admin JWT

### Tasks
- [x] `GET /rentals/:id/payments` — list payments for rental
- [x] `POST /rentals/:id/payments` — record payment (amount, method, status, paid_at)
- [x] `PATCH /rentals/:id/payments/:pid` — update payment record
- [x] Payment status tracking (`unpaid`, `partial`, `paid`, `refunded`)
- [x] `recordedById` set from JWT (staff user)

### Notes
> Add implementation notes, decisions, or issues here as tasks are completed.

- 2026-04-11: Extended `RentalsController` and `RentalsService` with nested payments endpoints for list/create/update, protected by existing staff/admin guard stack and strict tenant scoping (`organizationId` from JWT only).
- 2026-04-11: Added payment DTO validation for amount/method/status/paid date and ensured `recordedById` is always populated from authenticated JWT claims (`CurrentUser.userId`) instead of request input.
- 2026-04-11: Implemented list pagination/search metadata for `GET /rentals/:id/payments` using shared pagination utilities and response meta helpers; search is case-insensitive across `notes`, recorder name, and enum terms.
- 2026-04-11: Added rentals integration coverage for payment create/list/update flows, status lifecycle values (`unpaid`, `partial`, `paid`, `refunded`), and cross-org rental rejection.
- 2026-04-11: Updated rentals test cleanup to remove legacy rows safely by both organization and customer linkage, preventing FK failures during repeated local runs.

---

## Phase 6 — Frontend

**Goal:** Fully functional web app for staff/admin operations and customer read-only portal.
**Status:** In progress
**Completed:** Vite + React + TypeScript app scaffold, Tailwind CSS configuration, shadcn/ui setup, base shadcn component primitives, shared `cn()` utility, CSS variable token baseline, neutral default theme wiring, Inter font integration, Tailwind typography baseline, shared runtime theme token contract in `packages/shared`

### Tasks

#### Design Foundation
- [x] Install and configure Tailwind CSS
- [x] Install and configure shadcn/ui
- [x] Add base shadcn components: `Button`, `Input`, `Select`, `Table`, `Badge`, `Card`, `Dialog`, `AlertDialog`, `DropdownMenu`, `Separator`, `Skeleton`, `Sonner`
- [x] Configure `cn()` utility (`clsx` + `tailwind-merge`)
- [x] Define CSS variable token set in `index.css` (colors, radius, shadows — per `DESIGN.md` section 2)
- [x] Hardcode neutral default theme (zinc/slate scale)
- [x] Install Inter font via `@fontsource/inter`
- [x] Configure Tailwind typography scale (per `DESIGN.md` section 3)
- [x] Document token shape in `packages/shared` for Phase 2 runtime theming
- [ ] Build `AppLayout` component (sidebar + main content area)
- [ ] Build `Sidebar` component (logo slot, role-aware nav links, org name, user/logout)
- [ ] Build `TopBar` component (page title, contextual action slot, user menu)
- [ ] Build `PageWrapper` component (consistent padding, heading slot)
- [ ] Build `StatusBadge` component (cart, rental, payment status → color map per `DESIGN.md` section 5)
- [ ] Build `EmptyState` component (icon + heading + subtext + optional CTA)
- [ ] Build `PageError` component (inline error card + retry button)
- [x] Add `DESIGN.md` to `apps/web/` root

#### App Foundation
- [x] Vite + React + TypeScript app scaffold
- [ ] React Router configured (role-based routing per PRD section 9)
- [ ] Zustand store (auth state, current user/org)
- [ ] TanStack Query configured (API client, caching)
- [ ] API service layer (typed, uses shared DTOs)
- [ ] Auth route guard (redirect if not authenticated)
- [ ] Role-based route protection (redirect if insufficient role)

#### Auth Pages
- [ ] Staff/admin login page (`/login`)
- [ ] Customer portal login page (`/portal/login`)

#### Dashboard
- [ ] Today's active rentals count
- [ ] Cart status summary (available / rented / reserved / retired)
- [ ] Upcoming check-ins today
- [ ] Upcoming check-outs today

#### Carts
- [ ] Carts list page (status badges, filters)
- [ ] Register new cart form
- [ ] Cart detail page (current rental, history)

#### Customers
- [ ] Customers list page (search)
- [ ] Customer detail page (profile + rental history)
- [ ] Create customer form

#### Rentals
- [ ] Rentals list page (filters: type, status, date range)
- [ ] New rental flow:
  - [ ] Step 1 — Select customer
  - [ ] Step 2 — Availability check (date/type input → available carts returned)
  - [ ] Step 3 — Select cart
  - [ ] Step 4 — Confirm + create rental
- [ ] Rental detail page (status, contract if lease, payments)
- [ ] Check-out confirmation screen
- [ ] Check-in confirmation screen (shows calculated total)
- [ ] Cancel rental action

#### Payments
- [ ] Payment recording form (per rental)
- [ ] Payment list on rental detail

#### Customer Portal
- [ ] `/portal/rentals` — list own rentals
- [ ] `/portal/rentals/:id` — rental detail
- [ ] `/portal/rentals/:id/contract` — lease contract (if applicable)
- [ ] `/portal/rentals/:id/payments` — payment records

#### Settings (org_admin only)
- [ ] Organization settings page
- [ ] Locations management page
- [ ] Cart types management page
- [ ] Users management page

### Notes
> Add implementation notes, decisions, or issues here as tasks are completed.

- 2026-04-11: Added Design Foundation task group based on PM/Architect direction. Design system must be established before any page work begins to ensure consistency across all 37 page/feature tasks.
- 2026-04-11: Component library selected: shadcn/ui. Token system defined in `DESIGN.md` using CSS custom properties to support Phase 2 runtime per-org theming with zero component refactoring.
- 2026-04-11: Design language confirmed: minimalist/Apple-inspired, neutral zinc/slate default palette, Inter font. Full conventions documented in `apps/web/DESIGN.md`.
- 2026-04-11: Logo slot designed into sidebar from day one. MVP: renders env-var or hardcoded logo URL, falls back to org name text. Phase 2: loads from `Organization.logoUrl` set via settings UI.
- 2026-04-11: Scaffolded `apps/web` with Vite + React + TypeScript (`index.html`, Vite config, TS configs, app entry files) and replaced the Phase 1 placeholder dev script.
- 2026-04-11: Configured Tailwind + PostCSS + `tailwindcss-animate`, mapped utility colors/radius/shadows to `DESIGN.md` token variables in `src/index.css`, and wired Inter as the default font.
- 2026-04-11: Installed and configured shadcn/ui with the required primitive set (`Button`, `Input`, `Select`, `Table`, `Badge`, `Card`, `Dialog`, `AlertDialog`, `DropdownMenu`, `Separator`, `Skeleton`, `Sonner`) plus the shared `cn()` helper in `src/lib/utils.ts`.
- 2026-04-11: Updated `components.json` aliases to `src/*` paths after initial CLI generation emitted components to an incorrect literal `@/` directory; moved generated files into `src/components/ui`.
- 2026-04-11: Validation: `pnpm --filter web build` passes; Vite dev server boots successfully via `pnpm --filter web dev`.
- 2026-04-11: Added shared Phase 2 runtime theming contract in `packages/shared/src/types/theme.types.ts`, including canonical overridable CSS variable names (`primary`, `secondary`, `accent` pairs) and exported token map typing for API/web reuse.

---

## Phase 7 — Production Deployment

**Goal:** System running in production, all containers healthy, migrations applied.
**Status:** Not started
**Completed:** —

### Tasks
- [ ] API Dockerfile validated (build + run)
- [ ] Web Dockerfile + nginx.conf validated
- [ ] `docker-compose.prod.yml` validated (all services healthy)
- [ ] Environment variables documented (`.env.example` committed)
- [ ] Prisma migrations applied in prod environment
- [ ] API health check endpoint (`GET /health`)
- [ ] Production smoke test (login, create rental, check-in)

### Notes
> Add implementation notes, decisions, or issues here as tasks are completed.

---

## Summary Progress

| Phase | Status | Completed Tasks |
|-------|--------|----------------|
| Phase 1 — Foundation | Complete | 9 / 9 |
| Phase 2 — Auth & Multi-Tenancy | Complete | 13 / 13 |
| Phase 3 — Core Inventory | Complete | 24 / 24 |
| Phase 4 — Rentals | Complete | 21 / 21 |
| Phase 5 — Payments | Complete | 5 / 5 |
| Phase 6 — Frontend | In progress | 11 / 54 |
| Phase 7 — Production Deployment | Not started | 0 / 7 |
| **Total** | | **83 / 133** |

---

*Tracker initialized from PRD v1.0 — 2026-04-09*
