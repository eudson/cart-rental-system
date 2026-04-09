# Golf Cart Rental Management System — Implementation Tracker

**Project:** Golf Cart Rental Management System
**PRD Version:** 1.0
**Last Updated:** 2026-04-09
**Updated By:** Codex

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

---

## Phase 1 — Foundation

**Goal:** Monorepo scaffold, database schema, local dev environment running.
**Status:** In progress
**Completed:** Monorepo scaffold, Shared package bootstrap, Prisma schema, Initial Prisma migration, Docker dev environment, NestJS app bootstrap, Prisma module + service wiring

### Tasks
- [x] Monorepo scaffold (pnpm workspaces, folder structure per PRD)
- [x] Shared package bootstrap (enums, types, index exports)
- [x] Prisma schema (full data model per PRD section 5)
- [x] Initial Prisma migration (`0001_init`)
- [x] Docker dev environment (Postgres container running locally)
- [x] NestJS app bootstrap (`main.ts`, `app.module.ts`, global exception filter)
- [x] Prisma module + service wired into NestJS
- [ ] Root `package.json` scripts validated (`dev:api`, `dev:web`, `db:migrate`, `db:studio`)

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

---

## Phase 2 — Auth & Multi-Tenancy

**Goal:** Secure, role-based auth working for staff and customers. Org scoping enforced on all requests.
**Status:** Not started
**Completed:** —

### Tasks
- [ ] Staff/admin JWT auth — login endpoint (`POST /auth/login`)
- [ ] Staff/admin JWT auth — refresh endpoint (`POST /auth/refresh`)
- [ ] Staff/admin JWT auth — logout endpoint (`POST /auth/logout`)
- [ ] Customer JWT auth — login endpoint (`POST /auth/customer/login`)
- [ ] JWT strategy — staff claims: `{ userId, organizationId, role }`
- [ ] JWT strategy — customer claims: `{ customerId, organizationId, role: 'customer' }`
- [ ] `JwtAuthGuard` — validates token on protected routes
- [ ] `RolesGuard` — validates role from token claims
- [ ] `OrgGuard` — injects `organizationId` from token, prevents cross-org access
- [ ] `@Roles()` decorator wired to `RolesGuard`
- [ ] `@CurrentUser()` decorator to extract user from request
- [ ] All guards registered globally or per-module as agreed
- [ ] Cross-org access rejection validated (`ORG_MISMATCH` → 403)

### Notes
> Add implementation notes, decisions, or issues here as tasks are completed.

---

## Phase 3 — Core Inventory

**Goal:** All core entities (orgs, locations, carts, customers, users) manageable via API.
**Status:** Not started
**Completed:** —

### Tasks

#### Organizations
- [ ] `GET /organizations` — list all orgs (super_admin only)
- [ ] `POST /organizations` — create org
- [ ] `GET /organizations/:id` — get org
- [ ] `PATCH /organizations/:id` — update org (name, status, settings)

#### Locations
- [ ] `GET /locations` — list locations for org
- [ ] `POST /locations` — create location
- [ ] `GET /locations/:id` — get location
- [ ] `PATCH /locations/:id` — update location

#### Users
- [ ] `GET /users` — list users in org
- [ ] `POST /users` — create user (org_admin only), password hashing
- [ ] `GET /users/:id` — get user
- [ ] `PATCH /users/:id` — update user
- [ ] `DELETE /users/:id` — soft delete (set `isActive = false`)

#### Customers
- [ ] `GET /customers` — list customers in org
- [ ] `POST /customers` — create customer (composite unique enforced)
- [ ] `GET /customers/:id` — get customer
- [ ] `PATCH /customers/:id` — update customer
- [ ] Duplicate email rejection (`CUSTOMER_EMAIL_EXISTS` → 409)

#### Cart Types
- [ ] `GET /cart-types` — list cart types for org
- [ ] `POST /cart-types` — create cart type
- [ ] `GET /cart-types/:id` — get cart type
- [ ] `PATCH /cart-types/:id` — update cart type
- [ ] `DELETE /cart-types/:id` — delete (reject if carts assigned → `CART_TYPE_IN_USE` → 409)

#### Carts
- [ ] `GET /carts` — list carts (filters: `?locationId=&status=`)
- [ ] `POST /carts` — register new cart
- [ ] `GET /carts/:id` — get cart details
- [ ] `PATCH /carts/:id` — update cart
- [ ] Cart status transition validation (invalid transitions rejected → `INVALID_STATUS_TRANSITION` → 422)

### Notes
> Add implementation notes, decisions, or issues here as tasks are completed.

---

## Phase 4 — Rentals

**Goal:** Full rental lifecycle working for both daily and lease rentals. Double-booking prevention enforced.
**Status:** Not started
**Completed:** —

### Tasks

#### Availability
- [ ] `GET /carts/availability` — availability check endpoint
- [ ] Overlap query implemented (per PRD section 6)
- [ ] Query runs inside DB transaction to prevent race conditions

#### Daily Rentals
- [ ] `POST /rentals` — create daily rental
- [ ] Rate snapshot copied from CartType at time of booking
- [ ] Double-booking prevention enforced (overlap check in transaction)
- [ ] Cart status set to `reserved` on create
- [ ] `totalAmount` calculation: `dailyRateSnapshot × days`

#### Lease Rentals
- [ ] `POST /rentals` — create lease rental (type: lease)
- [ ] `contractMonths` validation against `org.minLeaseMonths` (`LEASE_MIN_MONTHS` → 422)
- [ ] `POST /rentals/:id/contract` — create lease contract record
- [ ] `PATCH /rentals/:id/contract` — update contract (signed date, document URL)
- [ ] `GET /rentals/:id/contract` — get contract
- [ ] Rate snapshot copied from CartType at time of booking
- [ ] Cart blocked for full contract period

#### Rental Actions
- [ ] `POST /rentals/:id/checkout` — validate status, set cart to `rented`
- [ ] `POST /rentals/:id/checkin` — set `actualReturnDate`, calculate final `totalAmount`, set cart to `available`
- [ ] `POST /rentals/:id/cancel` — release cart to `available`, set rental to `cancelled`
- [ ] `GET /rentals` — list rentals (filters: `?type=&status=&customerId=&cartId=`)
- [ ] `GET /rentals/:id` — get rental detail
- [ ] `PATCH /rentals/:id` — update rental (dates, notes)

### Notes
> Add implementation notes, decisions, or issues here as tasks are completed.

---

## Phase 5 — Payments

**Goal:** Manual payment recording per rental. No gateway integration.
**Status:** Not started
**Completed:** —

### Tasks
- [ ] `GET /rentals/:id/payments` — list payments for rental
- [ ] `POST /rentals/:id/payments` — record payment (amount, method, status, paid_at)
- [ ] `PATCH /rentals/:id/payments/:pid` — update payment record
- [ ] Payment status tracking (`unpaid`, `partial`, `paid`, `refunded`)
- [ ] `recordedById` set from JWT (staff user)

### Notes
> Add implementation notes, decisions, or issues here as tasks are completed.

---

## Phase 6 — Frontend

**Goal:** Fully functional web app for staff/admin operations and customer read-only portal.
**Status:** Not started
**Completed:** —

### Tasks

#### Foundation
- [ ] Vite + React + TypeScript app scaffold
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
| Phase 1 — Foundation | In progress | 7 / 8 |
| Phase 2 — Auth & Multi-Tenancy | Not started | 0 / 13 |
| Phase 3 — Core Inventory | Not started | 0 / 24 |
| Phase 4 — Rentals | Not started | 0 / 18 |
| Phase 5 — Payments | Not started | 0 / 5 |
| Phase 6 — Frontend | Not started | 0 / 37 |
| Phase 7 — Production Deployment | Not started | 0 / 7 |
| **Total** | | **7 / 112** |

---

*Tracker initialized from PRD v1.0 — 2026-04-09*
