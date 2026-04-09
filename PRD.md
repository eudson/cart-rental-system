# Golf Cart Rental Management System — Product Requirements Document

**Version:** 1.0 — MVP
**Status:** Ready for Implementation
**Prepared by:** Senior PM / Solutions Architect

---

# Table of Contents

1. Project Overview
2. Goals & Constraints
3. User Roles & Permissions
4. Monorepo Structure & Stack
5. Data Model (Prisma Schema)
6. Business Rules
7. API Design
8. Module Breakdown
9. Frontend Structure
10. Docker & Deployment
11. Build Order & Milestones

---

# 1. Project Overview

A **multi-tenant SaaS Golf Cart Rental Management System** serving golf clubs and rental operators. The system manages cart inventory, daily rentals, long-term leases, customer records, and payment tracking across multiple organizations and locations.

**Two rental models:**
- **Daily rental** — 24h blocks, short-term
- **Monthly lease** — minimum 6 months (configurable per org), long-term exclusive assignment

**Customer portal** — read-only access for customers to view their own rentals and contracts.

**Maintenance module** — deferred to Phase 2.

---

# 2. Goals & Constraints

## Goals
- Deliver a working MVP fast
- Simple enough for non-technical staff to operate daily
- Built as SaaS from day one (multi-tenant, multi-location)
- Clean foundation that scales without rewriting

## Constraints
- Small team, limited budget
- No over-engineering — monolith first
- No payment gateway in MVP (manual payment recording only)
- No customer self-booking in MVP (staff-operated)
- No maintenance module in MVP
- No cross-org customer accounts in MVP

## Out of Scope (Phase 2+)
- Maintenance module
- Payment gateway integration
- Customer self-booking
- Email / SMS notifications
- Reporting and analytics
- Cross-org account merging
- Mobile app

---

# 3. User Roles & Permissions

| Role | Scope | Description |
|------|-------|-------------|
| `super_admin` | Platform | Manages organizations. Internal use only |
| `org_admin` | Organization | Full access within their org |
| `staff` | Organization | Daily operations — rentals, customers, carts |
| `customer` | Organization | Read-only portal — own rentals only |

## Permission Matrix

| Resource | super_admin | org_admin | staff | customer |
|----------|-------------|-----------|-------|----------|
| Organizations | CRUD | Read own | — | — |
| Locations | CRUD | CRUD | Read | — |
| Users | CRUD | CRUD own org | Read | — |
| Customers | CRUD | CRUD | CRUD | Read own |
| Cart Types | CRUD | CRUD | Read | — |
| Carts | CRUD | CRUD | Read + status update | — |
| Rentals | CRUD | CRUD | CRUD | Read own |
| Lease Contracts | CRUD | CRUD | Read + create | Read own |
| Payments | CRUD | CRUD | CRUD | Read own |

---

# 4. Monorepo Structure & Stack

## Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces |
| Frontend | Vite + React + TypeScript |
| Backend | NestJS + Prisma + PostgreSQL |
| Shared | TypeScript types, enums, DTOs |
| Dev environment | Docker (Postgres container only) |
| Prod environment | Docker (frontend + backend + Postgres) |

## Folder Structure

```
/
├── apps/
│   ├── web/                        # Vite + React
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── carts/
│   │   │   │   ├── customers/
│   │   │   │   ├── rentals/
│   │   │   │   ├── payments/
│   │   │   │   └── portal/         # Customer-facing views
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/           # API client calls
│   │   │   └── store/              # Global state (Zustand recommended)
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── api/                        # NestJS
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── prisma/             # Prisma service + module
│       │   ├── auth/               # JWT auth, guards, strategies
│       │   ├── common/             # Interceptors, decorators, filters
│       │   │   ├── guards/
│       │   │   │   ├── jwt.guard.ts
│       │   │   │   ├── roles.guard.ts
│       │   │   │   └── org.guard.ts    # Enforces org scoping
│       │   │   ├── decorators/
│       │   │   │   ├── roles.decorator.ts
│       │   │   │   └── current-user.decorator.ts
│       │   │   └── filters/
│       │   ├── organizations/
│       │   ├── locations/
│       │   ├── users/
│       │   ├── customers/
│       │   ├── cart-types/
│       │   ├── carts/
│       │   ├── rentals/
│       │   ├── payments/
│       │   └── portal/             # Customer portal endpoints
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
│
├── packages/
│   └── shared/                     # Shared across apps
│       ├── src/
│       │   ├── enums/
│       │   │   ├── roles.enum.ts
│       │   │   ├── cart-status.enum.ts
│       │   │   ├── rental-status.enum.ts
│       │   │   ├── rental-type.enum.ts
│       │   │   └── payment-status.enum.ts
│       │   ├── types/
│       │   │   ├── user.types.ts
│       │   │   ├── cart.types.ts
│       │   │   ├── rental.types.ts
│       │   │   └── payment.types.ts
│       │   └── index.ts
│       └── package.json
│
├── docker/
│   ├── docker-compose.dev.yml
│   └── docker-compose.prod.yml
│
├── package.json                    # Root workspace
└── pnpm-workspace.yaml
```

## pnpm-workspace.yaml
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

## Root package.json
```json
{
  "name": "golf-cart-rental",
  "private": true,
  "scripts": {
    "dev:api": "pnpm --filter api dev",
    "dev:web": "pnpm --filter web dev",
    "build:api": "pnpm --filter api build",
    "build:web": "pnpm --filter web build",
    "db:migrate": "pnpm --filter api prisma:migrate",
    "db:studio": "pnpm --filter api prisma:studio"
  }
}
```

---

# 5. Data Model (Prisma Schema)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ───────────────────────────────────────────

enum UserRole {
  super_admin
  org_admin
  staff
}

enum OrgStatus {
  active
  suspended
  inactive
}

enum LocationStatus {
  active
  inactive
}

enum CartStatus {
  available
  rented
  reserved
  retired
}

enum RentalType {
  daily
  lease
}

enum RentalStatus {
  pending
  active
  completed
  cancelled
}

enum PaymentStatus {
  unpaid
  partial
  paid
  refunded
}

enum PaymentMethod {
  cash
  card
  bank_transfer
  other
}

// ─── PLATFORM ────────────────────────────────────────

model Organization {
  id                String      @id @default(uuid())
  name              String
  slug              String      @unique
  status            OrgStatus   @default(active)
  minLeaseMonths    Int         @default(6)
  defaultDailyRate  Decimal?    @db.Decimal(10, 2)
  defaultMonthlyRate Decimal?   @db.Decimal(10, 2)
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  locations         Location[]
  users             User[]
  customers         Customer[]
  cartTypes         CartType[]
  carts             Cart[]
  rentals           Rental[]

  @@map("organizations")
}

model Location {
  id              String         @id @default(uuid())
  organizationId  String
  name            String
  address         String?
  timezone        String         @default("UTC")
  status          LocationStatus @default(active)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  organization    Organization   @relation(fields: [organizationId], references: [id])
  users           User[]
  carts           Cart[]
  rentals         Rental[]

  @@map("locations")
}

// ─── USERS ───────────────────────────────────────────

model User {
  id              String    @id @default(uuid())
  organizationId  String
  locationId      String?
  name            String
  email           String
  passwordHash    String
  role            UserRole
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  organization    Organization  @relation(fields: [organizationId], references: [id])
  location        Location?     @relation(fields: [locationId], references: [id])
  rentalsCreated  Rental[]      @relation("RentalCreatedBy")
  paymentsRecorded Payment[]    @relation("PaymentRecordedBy")

  @@unique([organizationId, email])
  @@map("users")
}

model Customer {
  id              String    @id @default(uuid())
  organizationId  String
  name            String
  email           String
  phone           String?
  idNumber        String?
  passwordHash    String
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  organization    Organization  @relation(fields: [organizationId], references: [id])
  rentals         Rental[]

  @@unique([organizationId, email])
  @@map("customers")
}

// ─── INVENTORY ───────────────────────────────────────

model CartType {
  id              String    @id @default(uuid())
  organizationId  String
  name            String
  description     String?
  dailyRate       Decimal   @db.Decimal(10, 2)
  monthlyRate     Decimal   @db.Decimal(10, 2)
  seatingCapacity Int       @default(2)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  organization    Organization  @relation(fields: [organizationId], references: [id])
  carts           Cart[]

  @@map("cart_types")
}

model Cart {
  id              String      @id @default(uuid())
  organizationId  String
  locationId      String
  cartTypeId      String
  label           String
  year            Int?
  color           String?
  notes           String?
  status          CartStatus  @default(available)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  organization    Organization  @relation(fields: [organizationId], references: [id])
  location        Location      @relation(fields: [locationId], references: [id])
  cartType        CartType      @relation(fields: [cartTypeId], references: [id])
  rentals         Rental[]

  @@map("carts")
}

// ─── RENTALS ─────────────────────────────────────────

model Rental {
  id                  String        @id @default(uuid())
  organizationId      String
  locationId          String
  customerId          String
  cartId              String
  createdById         String
  type                RentalType
  status              RentalStatus  @default(pending)
  startDate           DateTime
  endDate             DateTime
  actualReturnDate    DateTime?
  dailyRateSnapshot   Decimal?      @db.Decimal(10, 2)
  monthlyRateSnapshot Decimal?      @db.Decimal(10, 2)
  totalAmount         Decimal?      @db.Decimal(10, 2)
  notes               String?
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  organization        Organization  @relation(fields: [organizationId], references: [id])
  location            Location      @relation(fields: [locationId], references: [id])
  customer            Customer      @relation(fields: [customerId], references: [id])
  cart                Cart          @relation(fields: [cartId], references: [id])
  createdBy           User          @relation("RentalCreatedBy", fields: [createdById], references: [id])
  leaseContract       LeaseContract?
  payments            Payment[]

  @@map("rentals")
}

model LeaseContract {
  id                    String    @id @default(uuid())
  rentalId              String    @unique
  contractMonths        Int
  earlyTerminationFee   Decimal?  @db.Decimal(10, 2)
  signedAt              DateTime?
  documentUrl           String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  rental                Rental    @relation(fields: [rentalId], references: [id])

  @@map("lease_contracts")
}

// ─── PAYMENTS ────────────────────────────────────────

model Payment {
  id              String          @id @default(uuid())
  rentalId        String
  organizationId  String
  recordedById    String
  amount          Decimal         @db.Decimal(10, 2)
  method          PaymentMethod
  status          PaymentStatus   @default(unpaid)
  paidAt          DateTime?
  notes           String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  rental          Rental          @relation(fields: [rentalId], references: [id])
  recordedBy      User            @relation("PaymentRecordedBy", fields: [recordedById], references: [id])

  @@map("payments")
}
```

---

# 6. Business Rules

## Cart Status Transitions

```
available → reserved    (reservation created)
reserved  → available   (reservation cancelled)
reserved  → rented      (check-out confirmed)
rented    → available   (check-in completed, no issues)
rented    → retired     (admin decision)
available → retired     (admin decision)
```

> Any transition not listed above is **invalid and must be rejected by the API.**

## Availability Rules

- A cart is bookable only if `status = available`
- No two active rentals (`pending` or `active`) can overlap for the same cart
- Availability check endpoint must be used before confirming any rental
- For leases, the full contract period blocks the cart

## Rental Rules

| Rule | Daily | Lease |
|------|-------|-------|
| Minimum duration | 1 day | `org.minLeaseMonths` (default 6) |
| Pricing unit | `dailyRate × days` | `monthlyRate × months` |
| Rate used | Snapshot at time of booking | Snapshot at time of booking |
| Cart status on create | `reserved` | `reserved` |
| Cart status on check-out | `rented` | `rented` |
| Cart status on check-in | `available` | `available` |
| Early return | Charged full booked amount | Early termination fee applies |

## Multi-Tenancy Rules

- Every API request from a staff/admin user must include a valid JWT with `organizationId`
- Every DB query **must** include `WHERE organization_id = ?` — enforced at the service layer via a base pattern, not left to individual developers
- Customers are scoped to one org — unique key `(organizationId, email)`
- A customer JWT is separate from a staff JWT — different auth flow, different claims

## Double-Booking Prevention

- Before creating any rental, query for overlapping rentals on the same cart:
```sql
SELECT id FROM rentals
WHERE cart_id = $cartId
  AND status IN ('pending', 'active')
  AND start_date < $endDate
  AND end_date > $startDate
```
- If any result exists → reject with `409 Conflict`
- This check must happen inside a **database transaction** to prevent race conditions

---

# 7. API Design

## Conventions

- REST + JSON
- Base URL: `https://api.domain.com/v1`
- Auth: JWT Bearer token on all protected routes
- `organizationId` always comes from JWT claims — never from request body or URL
- All responses follow a consistent envelope:

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

- Errors:
```json
{
  "data": null,
  "error": {
    "code": "CART_NOT_AVAILABLE",
    "message": "Cart is currently rented",
    "statusCode": 409
  }
}
```

---

## Endpoints

### Auth
```
POST   /auth/login                  Staff/Admin login → returns JWT
POST   /auth/refresh                Refresh access token
POST   /auth/logout                 Invalidate refresh token
POST   /auth/customer/login         Customer portal login → returns JWT
```

### Organizations (super_admin only)
```
GET    /organizations               List all orgs
POST   /organizations               Create org
GET    /organizations/:id           Get org
PATCH  /organizations/:id           Update org (name, status, settings)
```

### Locations
```
GET    /locations                   List locations for org (from JWT)
POST   /locations                   Create location
GET    /locations/:id               Get location
PATCH  /locations/:id               Update location
```

### Users
```
GET    /users                       List users in org
POST   /users                       Create user (org_admin only)
GET    /users/:id                   Get user
PATCH  /users/:id                   Update user
DELETE /users/:id                   Deactivate user (soft delete)
```

### Customers
```
GET    /customers                   List customers in org
POST   /customers                   Create customer
GET    /customers/:id               Get customer
PATCH  /customers/:id               Update customer
```

### Cart Types
```
GET    /cart-types                  List cart types for org
POST   /cart-types                  Create cart type
GET    /cart-types/:id              Get cart type
PATCH  /cart-types/:id              Update cart type
DELETE /cart-types/:id              Delete (only if no carts assigned)
```

### Carts
```
GET    /carts                       List carts (?locationId=&status=)
POST   /carts                       Register new cart
GET    /carts/:id                   Get cart details
PATCH  /carts/:id                   Update cart
GET    /carts/availability          Check availability
                                    ?startDate=&endDate=&locationId=&type=daily|lease
```

### Rentals
```
GET    /rentals                     List rentals (?type=&status=&customerId=&cartId=)
POST   /rentals                     Create rental (daily or lease)
GET    /rentals/:id                 Get rental details
PATCH  /rentals/:id                 Update rental (dates, notes)
POST   /rentals/:id/checkout        Confirm check-out → cart status: rented
POST   /rentals/:id/checkin         Confirm check-in → cart status: available
POST   /rentals/:id/cancel          Cancel rental → cart status: available
```

### Lease Contracts
```
GET    /rentals/:id/contract        Get lease contract
POST   /rentals/:id/contract        Create/attach contract details
PATCH  /rentals/:id/contract        Update contract (signed date, document URL)
```

### Payments
```
GET    /rentals/:id/payments        List payments for rental
POST   /rentals/:id/payments        Record a payment
PATCH  /rentals/:id/payments/:pid   Update payment record
```

### Customer Portal (customer JWT only)
```
GET    /portal/me                   Get own profile
GET    /portal/rentals              List own rentals
GET    /portal/rentals/:id          Get rental detail
GET    /portal/rentals/:id/contract Get lease contract (if applicable)
GET    /portal/rentals/:id/payments Get payment records for rental
```

---

# 8. Module Breakdown (NestJS)

Each module follows NestJS conventions: `module`, `controller`, `service`, `dto`.

## Auth Module
- Staff/admin login with email + password
- Customer login with email + password (separate endpoint, separate JWT claims)
- JWT strategy: `{ userId, organizationId, role }` for staff
- JWT strategy: `{ customerId, organizationId, role: 'customer' }` for customers
- Refresh token support
- `JwtAuthGuard` — validates token
- `RolesGuard` — validates role from token claims
- `OrgGuard` — injects `organizationId` from token into every request, prevents cross-org access

## Organizations Module
- CRUD for organizations
- Restricted to `super_admin`
- Manages org-level settings (`minLeaseMonths`, default rates)

## Locations Module
- CRUD for locations within an org
- `org_admin` manages, `staff` reads

## Users Module
- CRUD for staff/admin users
- Soft delete (set `isActive = false`)
- Password hashing on create/update

## Customers Module
- CRUD for customers (org-scoped)
- Password set on create (customer portal access)
- Composite unique: `(organizationId, email)`

## Cart Types Module
- CRUD for cart types
- Holds pricing: `dailyRate`, `monthlyRate`
- Cannot delete if carts are assigned

## Carts Module
- Register and manage carts
- Status management with transition validation
- Availability check: returns available carts for a given window

## Rentals Module
- Create daily or lease rental
- Availability check + double-booking prevention (inside transaction)
- Rate snapshot on create (copy from CartType at time of booking)
- `checkout` action → validates status, updates cart to `rented`
- `checkin` action → sets `actualReturnDate`, calculates `totalAmount`, updates cart to `available`
- `cancel` action → releases cart back to `available`

## Lease Contracts Module
- Nested under Rentals
- Validates `contractMonths >= org.minLeaseMonths`
- Stores document URL (uploaded separately to S3/R2)

## Payments Module
- Nested under Rentals
- Manual payment recording
- Tracks method, amount, status, paid date
- No gateway in MVP

## Portal Module
- Customer-facing endpoints
- All routes protected by customer JWT
- Returns only data belonging to the authenticated customer within their org

---

# 9. Frontend Structure

## Routing (Role-Based)

```
/login                          Public — staff/admin login
/portal/login                   Public — customer login
/portal/*                       Customer routes (customer JWT)

/dashboard                      Staff + Admin
/carts                          Staff + Admin
/carts/:id                      Staff + Admin
/customers                      Staff + Admin
/customers/:id                  Staff + Admin
/rentals                        Staff + Admin
/rentals/new                    Staff + Admin
/rentals/:id                    Staff + Admin
/rentals/:id/checkout           Staff + Admin
/rentals/:id/checkin            Staff + Admin
/payments                       Staff + Admin
/settings/locations             org_admin only
/settings/cart-types            org_admin only
/settings/users                 org_admin only
/settings/organization          org_admin only
```

## Key Pages

**Dashboard**
- Today's active rentals
- Carts by status (available / rented / reserved / retired)
- Upcoming check-ins today
- Upcoming check-outs today

**Carts**
- List with status badges and filters
- Register new cart form
- Cart detail: current rental, history

**Customers**
- List with search
- Customer detail: profile + rental history

**Rentals**
- List with filters (type, status, date range)
- New rental form (select customer → availability check → select cart → confirm)
- Rental detail: status, contract (if lease), payment records
- Check-out confirmation screen
- Check-in confirmation screen (shows calculated total)

**Customer Portal**
- `/portal/rentals` — list of own rentals
- `/portal/rentals/:id` — rental detail + contract + payments

## State Management
- **Zustand** for global state (auth, current user/org)
- **React Query (TanStack Query)** for server state, caching, and API calls

---

# 10. Docker & Deployment

## Dev (docker-compose.dev.yml)
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: gcr
      POSTGRES_PASSWORD: gcr_password
      POSTGRES_DB: gcr_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data

volumes:
  postgres_dev_data:
```

## Prod (docker-compose.prod.yml)
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    restart: unless-stopped

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      NODE_ENV: production
    depends_on:
      - postgres
    ports:
      - "3000:3000"
    restart: unless-stopped

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    environment:
      VITE_API_URL: ${API_URL}
    ports:
      - "80:80"
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_prod_data:
```

## API Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
CMD ["node", "dist/main.js"]
```

## Web Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

# 11. Build Order & Milestones

## Phase 1 — Foundation
- [ ] Monorepo scaffold (pnpm workspaces, shared package, folder structure)
- [ ] Prisma schema (full data model, initial migration)
- [ ] Docker dev environment (Postgres running locally)
- [ ] NestJS bootstrap (app module, Prisma module, global exception filter)
- [ ] Shared enums and types package

## Phase 2 — Auth & Multi-Tenancy
- [ ] Staff/admin JWT auth (login, refresh, logout)
- [ ] Customer JWT auth (separate flow)
- [ ] `JwtAuthGuard`, `RolesGuard`, `OrgGuard`
- [ ] `organizationId` injected from token into all requests
- [ ] Role-based route protection

## Phase 3 — Core Inventory
- [ ] Organizations CRUD (super_admin)
- [ ] Locations CRUD
- [ ] Cart Types CRUD
- [ ] Carts CRUD + status transition validation
- [ ] Users CRUD + soft delete
- [ ] Customers CRUD

## Phase 4 — Rentals
- [ ] Availability check endpoint (with overlap query)
- [ ] Daily rental creation (with double-booking prevention in transaction)
- [ ] Lease rental creation + LeaseContract
- [ ] Checkout action
- [ ] Checkin action (calculate total, update cart status)
- [ ] Cancel action

## Phase 5 — Payments
- [ ] Payment recording (per rental)
- [ ] Payment update
- [ ] Payment status tracking

## Phase 6 — Frontend
- [ ] Auth pages (staff login, customer portal login)
- [ ] Dashboard
- [ ] Carts list + detail
- [ ] Customers list + detail
- [ ] Rentals list + new rental flow
- [ ] Rental detail + checkout + checkin screens
- [ ] Payments section
- [ ] Customer portal (read-only views)
- [ ] Settings pages (org_admin)

## Phase 7 — Prod Deployment
- [ ] Prod Docker setup
- [ ] Environment variables and secrets
- [ ] Prisma migrations in prod
- [ ] API and web Dockerfiles validated

---

# Appendix — Key Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `CART_NOT_AVAILABLE` | 409 | Cart is not in available status |
| `RENTAL_OVERLAP` | 409 | Dates overlap with existing rental |
| `LEASE_MIN_MONTHS` | 422 | Contract months below org minimum |
| `INVALID_STATUS_TRANSITION` | 422 | Cart status change not allowed |
| `ORG_MISMATCH` | 403 | Resource does not belong to user's org |
| `CUSTOMER_EMAIL_EXISTS` | 409 | Email already registered in this org |
| `CART_TYPE_IN_USE` | 409 | Cannot delete cart type with active carts |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but insufficient role |

---

*End of PRD v1.0 — MVP*