# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Shinsei-manager (申請マネージャ) is a Node.js/TypeScript REST API backend for a web-based document approval system. It replaces traditional paper-stamping (ハンコ/Hanko) workflows in Japanese organizations. The application stores all data as nodes and relationships in a Neo4J graph database.

## Commands

```bash
# Development (hot-reload via tsx)
npm run dev

# Build TypeScript to dist/
npm run build

# Run tests (requires .env or environment variables)
npm test

# Run tests without S3 (local file storage)
npm run test-local

# Run tests with S3
npm run test-s3

# Coverage report
npm run coverage
```

To run a single test file:
```bash
npx mocha --require tsx/cjs --require dotenv/config src/test/templates.test.ts
```

## Architecture

### Request Flow
```
HTTP → auth middleware (@moreillon/express_identification_middleware)
     → router (src/routes/)
     → Zod validation (src/validators/)
     → controller (src/controllers/)
     → Neo4J Cypher query (src/db.ts driver)
```

### Key Modules

- **`src/index.ts`** — Express app setup; mounts auth middleware globally before all routes; serves `GET /` as health/info endpoint
- **`src/db.ts`** — Neo4J driver initialization; runs on startup to set ID constraints and backfill `_id` fields on existing nodes
- **`src/env.ts`** — Zod-validated environment schema; import `env` from here instead of accessing `process.env` directly
- **`src/routes/index.ts`** — Top-level router; mounts at `/`
- **`src/utils.ts`** — Shared Cypher query fragments (batching, filtering, `return_application_and_related_nodes`) and helpers like `get_current_user_id`
- **`src/utils/validate.ts`** — Wrapper around Zod `.parse()` for request validation
- **`src/validators/`** — Zod schemas for request bodies/params/query strings
- **`src/attachmentsStorage/`** — Two backends: `local.ts` (filesystem at `UPLOADS_PATH`) and `s3.ts` (AWS S3); selected at runtime based on whether `S3_BUCKET` env var is set

### Neo4J Data Model

Nodes: `ApplicationForm`, `ApplicationFormTemplate`, `User`, `Group`

Key relationships:
- `(ApplicationForm)-[:SUBMITTED_BY]->(User)` — authorship
- `(ApplicationForm)-[:SUBMITTED_TO {flow_index}]->(User)` — ordered recipient chain
- `(User)-[:APPROVED {_id, date, comment}]->(ApplicationForm)` — approval stamp
- `(User)-[:REJECTED {_id, date, comment}]->(ApplicationForm)` — rejection
- `(ApplicationForm)-[:VISIBLE_TO]->(Group)` — privacy/visibility

The `flow_index` on `SUBMITTED_TO` determines the sequential approval order. An application is "pending" when approval count < recipient count and no rejection exists; "approved" when all recipients have approved.

### Authentication

All routes (except `GET /`) are protected by `@moreillon/express_identification_middleware`. The authenticated user is available at `res.locals.user` in controllers — use `get_current_user_id(res)` from `src/utils.ts` to extract their `_id`.

### Environment Variables

| Variable | Description |
|---|---|
| `APP_PORT` | HTTP listen port (default: `8000`) |
| `NEO4J_URL` | Neo4J bolt URL (default: `bolt://neo4j:7687`) |
| `NEO4J_USERNAME` / `NEO4J_PASSWORD` | Neo4J credentials |
| `IDENTIFICATION_URL` | Auth service endpoint |
| `UPLOADS_PATH` | Local file storage path (default: `/usr/share/pv`) |
| `S3_BUCKET` | If set, enables S3 storage; otherwise uses local |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_REGION` / `S3_ENDPOINT` | S3 config |
| `LOKI_URL` | Optional Loki logging endpoint |
| `TZ` | Timezone (default: `Asia/Tokyo`) |
