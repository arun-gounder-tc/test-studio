# Test Studio — Postgres + MinIO + Multi-Project Migration Plan

> **Companion to `TEST-STUDIO-PLAN.md` and `TEST-STUDIO-PROGRESS.md`.**
> Yeh doc rearchitecture cover karta hai: **local-first → deployable**, **flat → multi-project**, **in-memory + FS → Postgres + MinIO**.
>
> Plan.md me ek SQLite Phase 5 reference hai — **woh is doc se supersede hota hai.** Postgres chosen for multi-instance deployability.
>
> **Created:** 2026-05-09

---

## 1. Goal

Current Test Studio is **local-only, single-tenant, flat**. After this migration, it must be:

- **Deployable** — `docker compose up` se full stack chalu, ya cloud me push karne par bina kisi local dependency ke chale.
- **Multi-project** — ek user multiple projects manage kar sake (e.g. `novamark-fe`, `internal-admin`, `customer-portal`); har project ke apne tests, runs, configs, conversations.
- **Persistent** — sab data Postgres me; container restart ya redeploy par kuch kho na jaye.
- **Cloud media** — videos, screenshots, chat-attached images MinIO bucket me; UI signed URLs se fetch kare.
- **Multimodal chat** — tester LLM ke saath image attach karke baat kar sake (e.g. UI screenshot bhej ke "is page ke liye test likho").

---

## 2. Locked decisions (this migration)

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | Database engine | **Postgres 16** | SQLite single-writer; deployable goal me multi-instance server chahiye. JSON, arrays, GIN indexes native. |
| 2 | `.feature` storage | **DB source-of-truth, disk is cache** | `feature_content` Postgres me; server runs se pehle workspace dir me materialize karta hai. Container restart safe, multi-instance safe. |
| 3 | Cypress runner | **Same container as Server** (Phase E) | Express + Cypress ek container; `xvfb` for headed mode. MVP simplest; queue-based decoupling Phase F. |
| 4 | Authentication | **Skip Phases A–F** | `users` table + `created_by` reserve rakhenge taaki schema break na ho. Keycloak/JWT Phase G. |
| 5 | Object storage | **MinIO (S3-compatible)** behind `Storage` interface (PLAN.md §11) | Self-hosted in Compose; production me S3/R2/GCS swap-in trivial. |
| 6 | Migration tool | **node-pg-migrate** | Repeatable, version-controlled; supports up/down. |
| 7 | DB driver | **`pg` + `pg-pool`** (raw SQL via tagged templates, no ORM) | Already JS-only stack; ORM overhead unnecessary at this scale; clear queries. |
| 8 | Multimodal SDKs | **Anthropic `image` content blocks + OpenAI `image_url` blocks** | Both SDKs already in package.json; just need content-block builders per provider. |
| 9 | File path migration | **One-time import script** seed existing 3 `.feature` files into a "Default" project | Existing work preserved; backward-compatible until Phase A complete. |
| 10 | Per-project config | **Stored in `project_configs` row** as JSON columns | `routes.json`, `selectors.json`, `auth.adapter.ts` ka content per-project; no more shared `config/` files at runtime. |

---

## 3. Architecture — before vs after

### Before (today)
```
┌────────────┐   ┌──────────────┐   ┌──────────────────┐
│ UI 4300    │──▶│ Server 3001  │──▶│ Cypress (spawn)  │
│ Angular    │   │ Express      │   └──────────────────┘
└────────────┘   │ in-memory    │            │
                 │ Maps         │            ▼
                 └──────┬───────┘   ┌──────────────────┐
                        │           │ Local FS         │
                        ▼           │ cypress/e2e/...  │
                 ┌──────────────┐   │ .test-studio/    │
                 │ AI providers │   └──────────────────┘
                 │ Anthropic /  │
                 │ OpenAI       │
                 └──────────────┘
```
- `cypress/e2e/features/*.feature` — disk = source of truth
- conversations + runs — in-memory `Map`s
- screenshots/videos — `.test-studio/runs/...` on local disk
- `config/*.json` — single shared project config

### After (target)
```
┌─────────────────┐     ┌────────────────────────────┐
│ UI (static)     │     │ Postgres 16                │
│ served by nginx │     │ projects · tests · runs    │
│ /CDN            │     │ test_versions · run_logs   │
└────────┬────────┘     │ run_artifacts · convos     │
         │              │ messages · chat_attachments│
         ▼              └──────────┬─────────────────┘
┌─────────────────┐                │
│ Server          │◀───── pg ──────┤
│ Express         │                │
│ stateless +     │     ┌──────────▼─────────────────┐
│ SSE for live    │────▶│ MinIO                      │
│ runs            │     │ - run-artifacts/ (mp4/png) │
│                 │     │ - chat-uploads/ (images)   │
│                 │     │ - feature-backups/ (.zip)  │
│                 │     └────────────────────────────┘
│  ┌────────────┐ │
│  │ Cypress    │ │     ┌────────────────────────────┐
│  │ runner +   │ │────▶│ AI providers               │
│  │ xvfb       │ │     │ Anthropic SDK + OpenAI SDK │
│  └────────────┘ │     │ (multimodal: image blocks) │
└─────────────────┘     └────────────────────────────┘
```

- Postgres = single source of truth for all metadata + content
- MinIO = single store for all binary artifacts
- Server stateless except for active SSE streams (those die on restart, runs continue)
- `.feature` files materialized to ephemeral workspace dir on demand

---

## 4. The 6 user-requested features — mapped to phases

| # | User wants | Where it lands |
|---|---|---|
| 1 | **Project CRUD** (name + details) | Phase A — `projects` table, `/api/projects` REST, Project list page + create dialog |
| 2 | **Project's tests / features / scripts** | Phase A — `tests.project_id` FK, library scoped to active project, project switcher in toolbar |
| 3 | **Per-project per-test logs** (pass/fail history) | Phase A + D — `runs` table indexed by `(project_id, test_id, started_at DESC)`, run-history page |
| 4 | **Run logs with image/video URLs in DB** | Phase B + D — `run_artifacts` rows store MinIO keys; `run_logs` rows store full stdout |
| 5 | **MinIO for media storage** | Phase B — Storage interface + MinIO impl; uploader after each run |
| 6 | **Image attach in chat with LLM** | Phase C — `chat_attachments` table, `/api/conversations/:id/attachments` endpoint, multimodal content blocks to provider |

---

## 5. Postgres schema (full DDL)

> Migrations live in `studio-server/db/migrations/`. Naming: `0001_init.sql`, `0002_chat_attachments.sql`, …

```sql
-- ─────────────────────────────────────────────
-- 0001_init.sql
-- ─────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()

-- Projects
CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,           -- 'novamark-fe' (URL-safe)
  name         TEXT NOT NULL,                  -- 'Novamark Frontend'
  description  TEXT,
  base_url     TEXT,                           -- 'http://localhost:4200'
  created_by   UUID,                           -- FK to users (Phase G); nullable now
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at  TIMESTAMPTZ
);
CREATE INDEX idx_projects_archived ON projects(archived_at) WHERE archived_at IS NULL;

-- Per-project config (replaces the shared config/ folder at runtime)
CREATE TABLE project_configs (
  project_id      UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  routes          JSONB NOT NULL DEFAULT '{}'::jsonb,
  selectors       JSONB NOT NULL DEFAULT '{}'::jsonb,
  auth_adapter    JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { type: 'keycloak'|'jwt'|'none', config: {...} }
  default_model   TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tests (was: cypress/e2e/features/*.feature on disk)
CREATE TABLE tests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug             TEXT NOT NULL,                -- 'login-flow' (unique within project)
  name             TEXT NOT NULL,                -- 'Login Flow'
  description      TEXT,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  source           TEXT NOT NULL CHECK (source IN ('manual','ai-generated','uploaded','imported')),
  status           TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('draft','saved','archived')),
  current_version  INT  NOT NULL DEFAULT 1,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);
CREATE INDEX idx_tests_project_status ON tests(project_id, status);
CREATE INDEX idx_tests_tags_gin       ON tests USING GIN (tags);

-- Test versions (every save = new version)
CREATE TABLE test_versions (
  id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  test_id           UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  version           INT NOT NULL,
  feature_content   TEXT NOT NULL,               -- THE .feature file content
  step_definitions  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ pattern, implementation, file }]
  fixtures          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ path, content }]
  change_summary    TEXT,
  saved_by          UUID,
  saved_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (test_id, version)
);
CREATE INDEX idx_test_versions_test ON test_versions(test_id, version DESC);

-- Runs
CREATE TABLE runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  test_id           UUID REFERENCES tests(id) ON DELETE SET NULL,
  test_version      INT,
  status            TEXT NOT NULL CHECK (status IN ('queued','running','passed','failed','errored','cancelled')),
  headed            BOOLEAN NOT NULL DEFAULT false,
  exit_code         INT,
  scenarios_total   INT,
  scenarios_passed  INT,
  scenarios_failed  INT,
  duration_ms       INT,
  triggered_by      UUID,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ
);
CREATE INDEX idx_runs_project_started ON runs(project_id, started_at DESC);
CREATE INDEX idx_runs_test_started    ON runs(test_id, started_at DESC);
CREATE INDEX idx_runs_status          ON runs(status);

-- Run logs (full stdout for replay; batched insert, ~10–50 rows per run)
CREATE TABLE run_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id      UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  sequence    INT  NOT NULL,         -- ordering within a run (0,1,2,…)
  stream      TEXT NOT NULL CHECK (stream IN ('stdout','stderr','event')),
  line        TEXT NOT NULL,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_run_logs_run_seq ON run_logs(run_id, sequence);

-- Run artifacts (MinIO-backed)
CREATE TABLE run_artifacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('video','screenshot','report','log-bundle')),
  minio_key     TEXT NOT NULL,        -- 'run-artifacts/<run_id>/video.mp4'
  content_type  TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  scenario_name TEXT,                 -- for failure screenshots, link to scenario
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_artifacts_run_kind ON run_artifacts(run_id, kind);

-- Conversations
CREATE TABLE conversations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  originating_test_id   UUID REFERENCES tests(id) ON DELETE SET NULL,  -- set when chat seeded by "Refine with AI"
  default_model         TEXT,
  created_by            UUID,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at              TIMESTAMPTZ
);
CREATE INDEX idx_conversations_project ON conversations(project_id, started_at DESC);

-- Messages
CREATE TABLE messages (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT,                          -- text body (nullable when message is image-only)
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { generation, validation, modelUsed, providerUsed, ... }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at);

-- Chat attachments (images for now; files later)
CREATE TABLE chat_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('image','file')),
  minio_key     TEXT NOT NULL,           -- 'chat-uploads/<conversation_id>/<uuid>.png'
  content_type  TEXT NOT NULL,           -- 'image/png'
  size_bytes    BIGINT NOT NULL,
  width         INT,                     -- images only
  height        INT,                     -- images only
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_message ON chat_attachments(message_id);

-- Users (reserved for Phase G; nullable FKs above point here)
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role        TEXT NOT NULL DEFAULT 'tester' CHECK (role IN ('tester','lead','admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Schema rules of thumb
- Hard cascades from project → tests → versions/runs/conversations: deleting project nukes its world.
- Soft-delete on **projects** + **tests** via `archived_at` / `status='archived'` (not hard delete).
- `runs` ki cascade `SET NULL` on `test_id` taaki test delete hone par bhi run history bachi rahe (audit).
- `run_logs.line` is plain TEXT — no length cap; large outputs OK in Postgres.

---

## 6. MinIO bucket layout

Single bucket: **`test-studio`** (configurable via env).

```
test-studio/
├── run-artifacts/
│   └── <run_id>/
│       ├── video.mp4
│       ├── screenshots/
│       │   ├── login__failure.png
│       │   └── checkout__failure.png
│       └── cucumber-report.json
├── chat-uploads/
│   └── <conversation_id>/
│       ├── <attachment_id>.png
│       └── <attachment_id>.jpg
└── feature-backups/
    └── <project_id>/
        └── <YYYY-MM-DD>/
            └── <test_slug>__v<N>.feature
```

**Access pattern:** UI never gets MinIO credentials. Server generates **time-bound presigned URLs** (default TTL 15 min) that UI uses for `<video>`, `<img>`, download links.

---

## 7. Repository layer (replacing in-memory stores)

New folder: `studio-server/src/db/`.

```
studio-server/src/db/
├── pool.ts                  -- pg.Pool singleton, reads DATABASE_URL
├── migrate.ts               -- runs node-pg-migrate on startup if MIGRATE_ON_BOOT=true
└── repositories/
    ├── projects.repo.ts     -- listProjects, getProject, createProject, updateProject, archiveProject
    ├── tests.repo.ts        -- listByProject, get, create (writes test + v1), updateContent (creates new version), archive
    ├── runs.repo.ts         -- create, updateStatus, recordCounts, attachArtifact, listByTest, listByProject
    ├── run-logs.repo.ts     -- batchInsert (called every N lines or 500ms by runner)
    ├── conversations.repo.ts-- create, get, appendMessage, attachUploadedImage, setOriginatingTest
    └── attachments.repo.ts  -- create, listByMessage, getMinioKey
```

### Replacing existing services
| Old service | New behavior |
|---|---|
| `conversation.store.ts` (in-memory `Map`) | thin wrapper over `conversations.repo.ts` + `messages.repo.ts` |
| `runnerService.runs` (in-memory `Map`) | `runs.repo.ts` — every state change is an UPDATE |
| `runnerService` event emitter | stays as-is for live SSE; logs ALSO batched-insert to `run_logs` |
| `filesystem.service.ts` (lists `.feature` from disk) | replaced by `tests.repo.ts.listByProject()`; disk listing only used for sanity check |
| `test-writer.service.ts` (writes `.feature` to disk) | now writes to **DB first** (new test_version row), THEN materializes to workspace |

---

## 8. File system as cache — workspace materialization

Cypress fundamentally needs `.feature` files on disk. Strategy:

```
.workspace/
└── <project_slug>/
    ├── cypress/
    │   ├── e2e/features/<test_slug>.feature   ← materialized from DB on demand
    │   ├── support/step_definitions/...        ← materialized from version.step_definitions
    │   └── fixtures/...                         ← materialized from version.fixtures
    ├── cypress.config.ts                        ← generated from project_configs row
    └── config/                                  ← routes/selectors/auth materialized from project_configs
```

### Materialization rules
- **Lazy:** workspace dir created/refreshed on first `POST /runs` for that project after server start.
- **Atomic:** write to `.workspace/<slug>.tmp/` then `rename` to `.workspace/<slug>/`.
- **Cache invalidation:** any `tests.update` or `project_configs.update` deletes that project's workspace dir; next run recreates it.
- **Cleanup:** on container shutdown, `.workspace/` left as-is (next start re-materializes per request).
- **Concurrent-safe:** per-project lock during materialization; runs queue inside that lock.

### Why not always-fresh-per-run?
Could materialize per-run, but that re-writes 10s of files for every run. Per-project cached-until-edit is the sweet spot.

---

## 9. Multimodal chat — image attachments

### Flow
```
User pastes/drops an image in chat composer
   │
   ▼
POST /api/conversations/:id/attachments  (multipart/form-data)
   │
   ├─ Server validates: image/png|jpg|webp, ≤10 MB
   ├─ Uploads to MinIO at chat-uploads/<convId>/<uuid>.<ext>
   ├─ Returns { attachmentId, presignedUrl, width, height }
   ▼
UI renders thumbnail in composer
   │
User adds caption + sends
   │
POST /api/conversations/:id/messages   { content, model, attachmentIds: [...] }
   │
   ▼
Server:
   1. Insert messages row (user)
   2. Link chat_attachments to that message_id
   3. Build provider-specific content blocks:
      - Anthropic:   { type: 'image', source: { type: 'base64', media_type, data } }
                     (download from MinIO → base64 inline; or use 'url' source if reachable)
      - OpenAI:      { type: 'image_url', image_url: { url: presignedUrl } }
   4. provider.generate({ ..., content: [text, ...imageBlocks] })
   5. Same generateTest tool flow as today
```

### Provider differences cheat sheet
| Concern | Anthropic | OpenAI |
|---|---|---|
| Image content block | `{ type: 'image', source: { type: 'base64'/'url', ... } }` | `{ type: 'image_url', image_url: { url } }` |
| URL fetching | Both supported (URL must be reachable from provider) | URL only — provider fetches |
| Max image size | 5 MB / 8000×8000 | 20 MB / various |
| Vision-capable models | Sonnet 4.6, Opus 4.7 | gpt-4o, gpt-4o-mini |

Server normalizes via a new `buildImageBlock(provider, attachment)` helper.

### Cost guard
LLM image inputs are expensive — cache image-bearing system prompts only when same image is reused.

---

## 10. Docker compose blueprint

```yaml
# docker-compose.yml (root)
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: studio
      POSTGRES_USER: studio
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports: ['5432:5432']

  minio:
    image: minio/minio:latest
    command: server /data --console-address ':9001'
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - miniodata:/data
    ports:
      - '9000:9000'   # API
      - '9001:9001'   # Console UI

  minio-init:
    image: minio/mc:latest
    depends_on: [minio]
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 $$MINIO_ROOT_USER $$MINIO_ROOT_PASSWORD;
      mc mb -p local/test-studio || true;
      mc anonymous set none local/test-studio;
      "

  studio-server:
    build: ./studio-server      # Dockerfile bundles Express + Cypress + xvfb
    depends_on: [postgres, minio]
    environment:
      DATABASE_URL: postgres://studio:${POSTGRES_PASSWORD}@postgres:5432/studio
      MINIO_ENDPOINT: http://minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      MINIO_BUCKET: test-studio
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      MIGRATE_ON_BOOT: 'true'
    ports: ['3001:3001']
    volumes:
      - workspace:/app/.workspace   # ephemeral cache; can be a tmpfs in production

  studio-ui:
    build: ./studio-ui            # multi-stage: build + nginx serve
    depends_on: [studio-server]
    ports: ['4300:80']

volumes:
  pgdata:
  miniodata:
  workspace:
```

### Server Dockerfile sketch
```dockerfile
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y \
    xvfb libgtk-3-0 libnss3 libxss1 libasound2 libgbm1 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc -p tsconfig.json
EXPOSE 3001
CMD ["sh", "-c", "xvfb-run -a node dist/server.js"]
```

---

## 11. API surface — additions & modifications

### New endpoints
| Method | Path | Purpose |
|---|---|---|
| `GET`    | `/api/projects` | List projects (filter by `?archived=0`) |
| `POST`   | `/api/projects` | Create `{ slug, name, description, baseUrl }` |
| `GET`    | `/api/projects/:id` | Project detail + config |
| `PUT`    | `/api/projects/:id` | Update name/description/baseUrl |
| `PUT`    | `/api/projects/:id/config` | Update routes/selectors/auth_adapter |
| `DELETE` | `/api/projects/:id` | Archive |
| `GET`    | `/api/projects/:id/runs` | All runs for a project (across tests) |
| `POST`   | `/api/conversations/:id/attachments` | Upload image (multipart) → MinIO |
| `GET`    | `/api/runs/:id/logs` | Replay full log from DB (paginated) |
| `GET`    | `/api/runs/:id/artifacts` | Lists `{ kind, presignedUrl, contentType }[]` |

### Modified endpoints
| Endpoint | Change |
|---|---|
| `GET /api/library` | Now requires `?projectId=…` query param; returns tests scoped to that project |
| `POST /api/conversations` | Accept `{ projectId, refineTestId? }` — conversation now belongs to a project |
| `POST /api/conversations/:id/messages` | Accept optional `attachmentIds[]` |
| `POST /api/runs` | Now resolves `projectId` from `testId`; spawns Cypress in that project's materialized workspace |
| `GET /api/runs/:id/video` & `screenshots/*` | Return **redirect** to MinIO presigned URL (no streaming through server) |

### Removed/legacy
- Direct disk-list endpoint replaced; old code path removed in Phase A

---

## 12. UI changes

### New pages
- **`/projects`** — landing page after login (when added). Card grid: name, description, last-run summary, count badges (X tests, Y passing today). "+ New Project" dialog.
- **`/projects/:projectId`** — project home; shows tests library scoped to this project. Replaces today's flat `/library`.
- **`/projects/:projectId/settings`** — edit name, baseUrl, JSON editors for routes/selectors/auth_adapter, default model.
- **`/projects/:projectId/runs`** — historical run timeline across all tests in this project.
- **`/runs/:runId/replay`** — replays past run from DB (logs from `run_logs`, video/screenshots from MinIO presigned URLs).

### Modified pages
- **Toolbar** — add **project switcher** (dropdown, persisted in `localStorage` as `studio.activeProjectId`).
- **Library** (`/library`) — auto-redirects to `/projects/:activeProjectId`.
- **Case Chat** — composer gets a paperclip icon → file picker → image preview chip with × to remove. Active project shown in header.
- **Edit page** — top breadcrumb adds project name.

### URL convention
All test/run/conversation URLs nested: `/projects/:projectId/tests/:testId`, `/projects/:projectId/runs/:runId`, etc. Old flat URLs redirect.

---

## 13. Migration of existing data

One-time script: `studio-server/scripts/import-existing-tests.ts`.

```
Steps:
1. Run migrations → schema exists, all tables empty.
2. Read studio.config.json (current config/) → create row in projects:
     { slug: 'default', name: 'Default Project', base_url: <existing> }
3. Read config/{routes,selectors}.json + auth.adapter.ts → project_configs row.
4. For each *.feature in cypress/e2e/features/:
     - read content
     - parse Feature: line for name, @tags
     - INSERT INTO tests (project_id='default', slug, name, source='imported', ...)
     - INSERT INTO test_versions (test_id, version=1, feature_content, ...)
5. Print summary: "Imported N tests under project 'default'."
6. Original files left in place (workspace will materialize from DB on next run).
```

This script is idempotent (skips slugs that already exist).

---

## 14. Phased rollout — detailed

### Phase A — Postgres + project model (2 sessions)
**Deliverable:** Multi-project working end-to-end on dev machine; existing tests imported under "Default" project.

Tasks:
- [ ] `studio-server/db/migrations/0001_init.sql` — full schema from §5
- [ ] `pg.Pool` + `migrate.ts` boot hook
- [ ] All 6 `repositories/*.repo.ts` files
- [ ] Replace `conversation.store.ts` and runner in-memory map with repo-backed implementations
- [ ] New project routes (`/api/projects/*`)
- [ ] Update existing routes to be project-scoped
- [ ] Workspace materializer service
- [ ] Import script + run once
- [ ] UI: project switcher + project list page + project create dialog
- [ ] Existing pages updated to use `activeProjectId`
- [ ] Smoke run all existing tests in "Default" project

**Done when:** can create new project, switch to it, write a test in chat, run it, see it in library — fully DB-backed.

---

### Phase B — MinIO integration (1.5 sessions)
**Deliverable:** All run artifacts in MinIO; UI playback via signed URLs.

Tasks:
- [ ] `services/storage/storage.interface.ts` (already in plan §11)
- [ ] `services/storage/minio.storage.ts` using `minio` npm SDK
- [ ] `services/storage/local-fs.storage.ts` for dev fallback (env switch)
- [ ] After-run hook: walk `.test-studio/runs/<runId>/` → upload each → write `run_artifacts` rows → delete local copy
- [ ] `GET /runs/:id/video` and `/screenshots/*` return 302 to presigned URL
- [ ] `GET /runs/:id/artifacts` lists with presigned URLs
- [ ] UI: video tag + screenshot grid use signed URLs (already mostly URL-driven)
- [ ] MinIO + bucket-init service in compose

**Done when:** run a test, see video/screenshots load from MinIO; restart server, artifacts still visible.

---

### Phase C — Chat image attachments (1.5 sessions)
**Deliverable:** Tester drops/pastes UI screenshot into chat; LLM sees it and writes the test.

Tasks:
- [ ] `chat_attachments` table migration (0002)
- [ ] `POST /conversations/:id/attachments` multer endpoint → MinIO
- [ ] `attachments.repo.ts` + tie into messages flow
- [ ] `buildImageBlock(provider, attachment)` helper (Anthropic vs OpenAI shape)
- [ ] AI providers: extend `generate()` to accept `images[]` per message, produce correct content blocks
- [ ] System prompt update: tell AI it may receive UI screenshots and should describe the visible flow
- [ ] UI composer: paperclip icon, drag-drop zone, paste-from-clipboard, preview chips
- [ ] User message bubble renders attached image thumbnails
- [ ] Image-bearing models filter: disable non-vision models in picker when attachments present

**Done when:** tester pastes a Novamark dashboard screenshot, asks "is page ka E2E test likho", AI returns relevant Gherkin referencing visible elements.

---

### Phase D — Run logs persistence + replay (1 session)
**Deliverable:** Past runs are fully replayable from DB.

Tasks:
- [ ] Cypress runner: batched insert to `run_logs` (every 50 lines or 500 ms)
- [ ] `GET /runs/:id/logs?after=<sequence>&limit=500` paginated reader
- [ ] `/runs/:id/replay` page: auto-paged log fetch with same `<pre>` styling as live runner
- [ ] Project run timeline page (`/projects/:id/runs`) with sortable table
- [ ] Index sanity check: `EXPLAIN` on common queries

**Done when:** restart server mid-run; revisit runs list; click an old run; see full log + video play back.

---

### Phase E — Containerization + deploy (1.5 sessions)
**Deliverable:** Single `docker compose up` brings up the whole stack.

Tasks:
- [ ] `studio-server/Dockerfile` (Express + Cypress + xvfb)
- [ ] `studio-ui/Dockerfile` (multi-stage build → nginx with API proxy)
- [ ] Root `docker-compose.yml` (§10 blueprint)
- [ ] `.env.example` documenting all required env vars
- [ ] `nginx.conf` for UI: SPA fallback + `/api/*` proxy to `studio-server:3001`
- [ ] README quickstart updated
- [ ] Healthchecks on each service in compose
- [ ] Production hardening checklist (no anonymous MinIO, strong passwords, HTTPS termination via reverse proxy)

**Done when:** clean machine, `docker compose up`, all features work.

---

### Phase F — Cypress runner decoupling (2 sessions, optional for MVP)
**Deliverable:** Runs are queued and executed by a dedicated runner pool; horizontally scalable.

Tasks:
- [ ] `studio-runner/` new service container
- [ ] Lightweight queue: Postgres `LISTEN/NOTIFY` on `runs` (status=`queued`) — no Redis dependency
- [ ] Server-side: `POST /runs` inserts row with `status='queued'`, returns immediately
- [ ] Runner: subscribes; claims rows via `UPDATE … WHERE status='queued' RETURNING …`; runs Cypress
- [ ] SSE: server tails `run_logs` table with `LISTEN` on `run_log_inserted` channel and forwards to clients
- [ ] Compose: `studio-runner` with `replicas: 2` example
- [ ] Concurrency cap per project (avoid one project hogging runners)

**Done when:** scale runners up/down with `docker compose up --scale studio-runner=3`; runs distribute.

---

## 15. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Workspace materialization race when 2 runs start concurrently | per-project mutex in materializer |
| Postgres connection exhaustion on SSE-heavy load | use a separate read pool; SSE handlers don't hold pg clients |
| MinIO presigned URL TTL expires mid-video-playback | TTL 60 min for video; UI re-fetches on load error |
| Existing in-memory conversations lost during cutover | Phase A starts with empty conversations — testers told to start fresh; old `cypress/e2e/features/*.feature` imported, but chats not preserved |
| Image upload abuse (huge files, malicious payloads) | size cap 10 MB, MIME whitelist, optional virus scan in Phase G |
| Schema drift between dev/prod | migrations always forward-only; CI runs all migrations on a clean DB before merge |
| Cypress in container performance vs native | benchmark in Phase E; `xvfb` adds ~5–10% overhead, acceptable |
| Free-tier providers' image input limits | per-provider size/dimension validation before upload completes |

---

## 16. Open questions

| # | Question | Resolution needed before |
|---|---|---|
| 1 | When user deletes a project, should runs older than 30 days be permanently removed or kept under a `deleted_projects_archive` table? | Phase A, deletion endpoint |
| 2 | Multiple environments per project (dev/staging/prod baseUrls)? Or one project per env? | Phase A schema review — currently single `base_url`, easy to extend |
| 3 | Should chat image attachments be reused-by-reference (dedup by hash) or copied per upload? | Phase C |
| 4 | Run log retention — prune after N days or keep forever? | Phase D |
| 5 | When two testers edit the same test simultaneously, do we lock or last-write-wins with version diff? | Phase A or later |

---

## 17. Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-09 | Postgres replaces planned SQLite (PLAN.md §5) | Multi-instance deployable goal; SQLite single-writer doesn't scale |
| 2026-05-09 | DB is source of truth, disk is workspace cache | Container-restart safe; multi-instance safe; versions live in DB anyway |
| 2026-05-09 | Cypress + Express same container in Phase E; queue-based decoupling deferred to Phase F | MVP simplicity; queue infra adds 2+ sessions |
| 2026-05-09 | Auth (Keycloak/JWT) deferred to Phase G; `users` table reserved with nullable FKs | Don't block Phase A–F on auth complexity |
| 2026-05-09 | Per-project config stored as JSONB columns (replaces shared `config/` dir) | Each project deserves its own routes/selectors/auth without filesystem juggling |
| 2026-05-09 | Single MinIO bucket with prefix-based segregation (not bucket-per-project) | Easier policies, signed URLs work the same; can shard later |
| 2026-05-09 | Multimodal chat via provider-specific content blocks normalized in `buildImageBlock()` helper | Anthropic and OpenAI shapes differ; one helper isolates that |
| 2026-05-09 | Use `pg` driver directly (no ORM) | Stack already JS; queries are simple; ORM adds opaque layer for marginal benefit |

---

## 18. Where this doc fits

- **`TEST-STUDIO-PLAN.md`** — original architecture & decisions (some superseded; e.g. SQLite → Postgres, flat → multi-project)
- **`TEST-STUDIO-PROGRESS.md`** — what's done so far (Phases 1–4 complete in old plan)
- **`POSTGRES-MIGRATION-PLAN.md`** (this doc) — the rearchitecture covering the next ~10 sessions
- **`ARCHITECTURE.md`** — quick runtime reference; will be updated after Phase A and again after Phase E

When you start Phase A, update `PROGRESS.md` to reference this doc and mark old "Phase 5 (SQLite)" as superseded.

---

**Doc version:** 1.0
**Status:** Awaiting approval before Phase A starts
