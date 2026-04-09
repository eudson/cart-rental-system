# Golf Cart Rental Management System

Multi-tenant SaaS rental operations platform for golf cart operators. This repository is a pnpm workspace with a NestJS API, a shared TypeScript package, and a placeholder web app workspace that will be fully scaffolded later.

## Current Status

- API foundation is runnable locally
- Postgres local development runs through Docker Compose
- Prisma schema and initial migration are in place
- Root developer commands are available from the repository root
- `apps/web` is not fully scaffolded yet; `pnpm dev:web` is currently a placeholder for workspace validation only

## Tech Stack

- Backend: NestJS, Prisma, PostgreSQL
- Frontend: Vite, React, TypeScript
- Shared package: `packages/shared`
- Package manager: `pnpm`
- Local infrastructure: Docker Compose for Postgres

## Prerequisites

- Node.js 20 or newer
- pnpm
- Docker Desktop or Docker Engine with Compose support

## Getting Started

1. Clone the repository and move into it.
2. Install dependencies:

```bash
pnpm install
```

3. Create your local environment file:

```bash
cp .env.example .env
```

4. Start the local Postgres container:

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

5. Apply the Prisma migration:

```bash
pnpm db:migrate
```

6. Start the API:

```bash
pnpm dev:api
```

The API listens on `http://localhost:3000` and uses the `/v1` base path.

## Developer Commands

Run these commands from the repository root:

- `pnpm dev:api` — starts the NestJS API
- `pnpm dev:web` — placeholder command until the Phase 6 Vite scaffold exists
- `pnpm db:migrate` — runs Prisma migrations against the local development database
- `pnpm db:studio` — opens Prisma Studio for the local development database

The API and Prisma commands load `DATABASE_URL` from the root `.env` file. Copy `.env.example` to `.env` before running them.

## Local Database

The default local database configuration is:

- Host: `127.0.0.1`
- Port: `5440`
- Database: `gcr_dev`
- User: `gcr`
- Password: `gcr_password`

## Repository Layout

```text
apps/api       NestJS API
apps/web       Frontend workspace placeholder
packages/shared Shared enums and types
docker         Docker Compose files
```

## Troubleshooting

### `DATABASE_URL` not found

Copy `.env.example` to `.env`, or export `DATABASE_URL` manually before running Prisma or API commands.

### Port `5440` is already in use

Stop the conflicting Postgres process or update your local environment value and Docker mapping together.

### `pnpm dev:web` does not start a real frontend

That is expected right now. The web workspace has not reached the Phase 6 scaffold task yet.
