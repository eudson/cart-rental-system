# AGENTS.md

> Operational guide for AI coding agents. Read this file in full before executing any task.
> This is not a product document — it is an execution contract.

---

## 1. Project Overview

A **multi-tenant SaaS rental operations platform** for golf cart operators. Organisations (tenants) manage cart inventory, daily rentals (24h blocks), and long-term leases (minimum 6 months, configurable) across one or more physical locations. Staff operate the system on behalf of customers; customers get a read-only portal to view their own rentals.

This is an **operations system**, not a booking app. Correctness of state transitions, data integrity, and tenant isolation are the highest-priority concerns. Speed of delivery is second. Cleverness is never a goal.

**Source of truth:** `PRD.md`
**Build status:** `implementation-tracker.md`

---

## 2. Tech Stack & Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS · Prisma · PostgreSQL |
| Frontend | Vite · React · TypeScript |
| Shared | `packages/shared` — enums, types, constants |
| Auth | JWT access + refresh tokens (two separate flows: staff, customer) |
| Package manager | pnpm workspaces (never npm, never yarn) |
| Dev infra | Docker — Postgres container only |
| Prod infra | Docker Compose — api + web + postgres containers |

### Architecture Style

- **Modular monolith.** One API process. NestJS modules map 1:1 to domain features. Do not introduce inter-service communication, queues, or microservices.
- **API-first.** Backend exposes a versioned REST API (`/v1/`). Frontend consumes it. No server-rendered pages.
- **Schema-first.** Prisma schema is the canonical data model. Never write raw SQL migrations by hand.
- **Shared types as contract.** All enums and shared types live in `packages/shared` and are imported by both `apps/api` and `apps/web`. Duplication between apps is forbidden.

### Key Constraints

- Small team. Every abstraction has a cost. Justify it or skip it.
- MVP scope is locked in `PRD.md`. Do not expand it.
- Infrastructure cost matters. No external services unless specified.

---

## 3. Engineering Standards

### General

- **Readability over brevity.** Code is read far more than it is written.
- **Explicit over implicit.** If something is not obvious from the code, make it obvious — via naming, not comments.
- **Comments explain why, not what.** If you feel compelled to comment what the code does, rewrite the code.
- **No dead code.** Do not leave unused imports, variables, or commented-out blocks.

### SOLID & Modularity

- **Single responsibility.** Each class does one thing. Controllers handle HTTP. Services handle business logic. Repositories (via Prisma service) handle data access.
- **No logic in controllers.** Parse input, call service, return response. That is all a controller does.
- **No Prisma calls outside services.** Never call `this.prisma.*` from a controller, guard, or interceptor.
- **Prefer composition over inheritance.** Use NestJS dependency injection. Do not build class hierarchies.
- **Inject dependencies, do not instantiate them.** Every service dependency comes through the constructor.

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | `kebab-case` | `rental-status.enum.ts` |
| Classes | `PascalCase` | `RentalsService` |
| Methods / variables | `camelCase` | `createRental`, `organizationId` |
| DB columns (Prisma) | `camelCase` in schema, mapped to `snake_case` in DB via `@@map` / `@map` |
| Enums | `PascalCase` name, `snake_case` values | `CartStatus.available` |
| DTOs | Suffix with `Dto` | `CreateRentalDto`, `UpdateCartDto` |
| Response types | Suffix with `Response` | `RentalResponse` |
| Boolean fields | `is` / `has` prefix | `isActive`, `hasContract` |

### Validation

- Use `class-validator` on every request DTO. No raw input reaches a service.
- Validate at the boundary — controllers receive typed, validated objects.
- Reject early. Check preconditions at the top of a service method before doing any work.

```typescript
// correct — fail fast
async checkout(organizationId: string, rentalId: string): Promise<Rental> {
  const rental = await this.findOrThrow(organizationId, rentalId);
  if (rental.status !== RentalStatus.pending) {
    throw new UnprocessableEntityException({ code: 'INVALID_STATUS_TRANSITION', ... });
  }
  // proceed
}
```

### Error Handling

- Use NestJS built-in HTTP exceptions only (`NotFoundException`, `ConflictException`, etc.).
- Always include a `code` string from the PRD error code list. Never throw bare `Error` objects.
- Register a global exception filter in `main.ts`. All errors must return the standard envelope:

```json
{
  "data": null,
  "error": {
    "code": "CART_NOT_AVAILABLE",
    "message": "Cart is not available for the requested period",
    "statusCode": 409
  }
}
```

- All successful responses return the same envelope:

```json
{
  "data": { },
  "meta": { },
  "error": null
}
```

### Logging

- Use NestJS `Logger` scoped to the class. Do not use `console.log`.
- Log at service entry for mutating operations (create, update, status transitions).
- Log errors with context (entity id, organizationId, action attempted).
- Never log passwords, tokens, or PII.

```typescript
private readonly logger = new Logger(RentalsService.name);

async checkout(organizationId: string, rentalId: string) {
  this.logger.log(`Checkout initiated — rentalId=${rentalId} org=${organizationId}`);
}
```

### API Design

- Base path: `/v1/`
- `organizationId` is never in the URL or request body — always extracted from the JWT via `OrgGuard`
- Use plural resource names: `/carts`, `/rentals`, `/customers`
- Actions that are not CRUD use POST with a verb path segment: `POST /rentals/:id/checkout`
- Query filters use camelCase params: `?locationId=&status=&type=`
- HTTP status codes must be semantically correct: `200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`

---

## 4. Multi-Tenancy — Hard Rules

This is the most critical section. A bug here is a security incident.

- `organizationId` originates **only** from the JWT claims. Never from request input.
- `OrgGuard` extracts `organizationId` from the token and attaches it to the request object.
- Every service method that queries data must receive `organizationId` as an explicit parameter.
- Every Prisma query that touches tenant data must include `where: { organizationId }`.
- There are no exceptions to the above two rules.

```typescript
// correct
findAll(organizationId: string) {
  return this.prisma.cart.findMany({ where: { organizationId } });
}

// wrong — never do this
findAll() {
  return this.prisma.cart.findMany();
}
```

- Guards apply in this order on every protected route:
  1. `JwtAuthGuard` — validates and decodes token
  2. `RolesGuard` — checks role against `@Roles()` decorator
  3. `OrgGuard` — injects `organizationId` into request

- Customer JWTs are **separate** from staff JWTs. Different claims, different auth flows, different guards where role is `customer`.

---

## 5. Critical Business Logic Patterns

### Double-Booking Prevention

Availability check and rental insert must always occur inside a single `$transaction`. Never check availability and then create the rental in separate operations.

```typescript
return this.prisma.$transaction(async (tx) => {
  const overlap = await tx.rental.findFirst({
    where: {
      cartId: dto.cartId,
      organizationId,
      status: { in: [RentalStatus.pending, RentalStatus.active] },
      startDate: { lt: dto.endDate },
      endDate:   { gt: dto.startDate },
    },
  });
  if (overlap) throw new ConflictException({ code: 'RENTAL_OVERLAP', ... });

  return tx.rental.create({ data: { ... } });
});
```

### Rate Snapshots

Always snapshot the rate from `CartType` at the moment of rental creation. Never compute the rental amount from current rates — only from the snapshot stored on the `Rental` record.

### Cart Status Machine

Only these transitions are valid. Encode them as a constant map and validate before every status mutation. Reject invalid transitions with `INVALID_STATUS_TRANSITION`.

```typescript
export const VALID_CART_TRANSITIONS: Record<CartStatus, CartStatus[]> = {
  [CartStatus.available]: [CartStatus.reserved, CartStatus.retired],
  [CartStatus.reserved]:  [CartStatus.available, CartStatus.rented],
  [CartStatus.rented]:    [CartStatus.available, CartStatus.retired],
  [CartStatus.retired]:   [],
};
```

---

## 6. Agent Operating Rules

These rules govern how you execute tasks. Follow them without exception.

1. **Read before writing.** Before implementing anything, scan the relevant existing files. Understand what already exists. Do not assume the codebase is empty.
2. **Never duplicate logic.** If something already exists, use it. If it is close but not right, extend it. Do not write a second version of the same thing.
3. **Prefer extension over modification.** When adding behaviour, prefer adding to a module rather than modifying existing tested logic, unless the PRD requires a change.
4. **No speculative abstractions.** Do not create base classes, generic utilities, or shared helpers unless they are used in at least two places right now. YAGNI is a rule, not a suggestion.
5. **Smallest valid implementation.** Write the minimum code that correctly satisfies the requirement. Optimise only when there is a demonstrated reason.
6. **State assumptions explicitly.** If context is ambiguous, state your assumption as a code comment at the decision point and continue. Do not invent requirements.
7. **One task at a time.** Complete and validate a task before starting the next. Never leave a task half-done.
8. **Do not break existing behaviour.** Before modifying a file, understand what it does and what depends on it. Run affected tests if they exist.

---

## 7. Task Execution Protocol

Follow this sequence for every task, without skipping steps.

```
1. READ
   - Read the relevant section of PRD.md for the task
   - Read implementation-tracker.md to confirm task status and dependencies
   - Scan existing code in the relevant module(s)

2. PLAN
   - Identify files to create or modify
   - Identify dependencies (services, guards, shared types)
   - State any assumptions if context is incomplete

3. IMPLEMENT
   - Write the implementation in small, logical steps
   - Follow all standards in section 3
   - Apply multi-tenancy rules from section 4
   - Apply business logic patterns from section 5

4. VALIDATE
   - Confirm the implementation satisfies the PRD requirement exactly
   - Confirm no existing functionality is broken
   - Confirm all error cases are handled
   - Confirm organisationId scoping is correct on every query

5. UPDATE TRACKER
   - Open implementation-tracker.md
   - Mark the completed task(s) as [x]
   - Update the summary progress table
   - Add a note under the phase if anything notable occurred
   - Log any deviation from the PRD in the Deviations table

6. SUMMARISE
   - Output a short summary: what was implemented, what files were changed,
     any assumptions made, any follow-on tasks unblocked
```

Do not consider a task complete until step 5 is done. A task with no tracker update did not happen.

---

## 8. Strict Boundaries

These are absolute. They cannot be overridden by task instructions.

| Rule | Detail |
|------|--------|
| **Do not modify PRD.md** | It is owned by the PM. Read it, never write to it |
| **Do not invent requirements** | If a requirement is not in the PRD or explicitly stated in the task, do not implement it |
| **Do not expand MVP scope** | Phase 2+ items are listed in the PRD. Do not build them early, even if it seems helpful |
| **Do not introduce new dependencies** | No new packages without explicit instruction. Every dependency has a maintenance cost |
| **Do not over-engineer** | No microservices, no queues, no caching layers, no event buses unless the PRD specifies them |
| **Do not ignore multi-tenancy** | Any query missing `organizationId` scoping is a bug, not a shortcut |
| **Do not leave partial implementations** | Incomplete code that is committed breaks other agents. Finish the task or do not start it |

---

*This file is the execution contract for all agents on this project.*
*When in doubt: simpler is better, the PRD is the authority, and the tracker must always reflect reality.*
