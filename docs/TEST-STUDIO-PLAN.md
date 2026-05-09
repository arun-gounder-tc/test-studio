# Cypress AI Test Studio — Implementation Plan

> **Goal:** Build a reusable Cypress + AI testing kit that ships with novamark-fe and can be dropped into any future project. Testers (without coding skills) can chat with Claude in natural Hindi/English to author E2E tests; developers can write tests alongside features. Every test is real code persisted in the project, runnable from a UI dashboard.

---

## 1. Locked Decisions

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | Save destination | **Direct file system** | Simple, instant run, no PR wait |
| 2 | Test syntax | **BDD / Gherkin** (cucumber-preprocessor) | AI reliability, reusable steps, tester-readable |
| 3 | Phase 1 starter | **Cypress + BDD foundation first** | Prove structure works before adding AI |
| 4 | Author tracking | **Test Studio logged-in user (Keycloak)** | No Git complexity in Phase 1 |
| 5 | Flow improvements | **All 6 included** (validation gate, inline edit, run-now, debug loop, versioning, batch save) | Robust tester UX |
| 6 | Database | **SQLite (local file)** | Zero infra, fast queries, file-portable |
| 7 | Backend | **Node.js + Express** | Same JS ecosystem as Angular/Cypress |
| 8 | LLM | **Multi-provider** — Claude (Anthropic SDK) and GPT (OpenAI SDK) behind one `AIProvider` interface; routed by model-name prefix. Both with prompt caching (Anthropic ephemeral cache_control, OpenAI auto for >1024 tokens). | One key may be missing/exhausted; the other still works. UI lets the tester pick per-message. |
| 9 | AI API keys | `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` in `studio-server/.env` (gitignored). At least one must be set. | — |
| 10 | Cypress mode (dev) | **Headed** (`cypress open`) — visible browser during dev; CI uses headless | Visual debugging during dev |
| 11 | Test Studio access | **Studio has its OWN Keycloak login** — independent of the app being tested. Any user with valid Studio Keycloak credentials can access. | Tester only logs into Studio, never into the app. Studio works regardless of what auth the app uses. |
| 12 | Storage backend | **Local FS via Storage abstraction interface** for Phase 1; MinIO/S3 swap-in for Phase 5+ | Avoid premature infra; pluggable for future scale |
| 13 | Project structure | **Fully separate sibling folder** (`test-studio/` — originally `novamark-automation/`, renamed since the kit is project-agnostic) — zero changes inside `novamark-fe`. Studio UI is its own Angular app. | Clean app codebase, portable to future projects, independent deployment |

---

## 2. Architecture Overview — 5 Modules

```
┌────────────────────────────────────────────────────────────────────┐
│                       NOVAMARK-FE (Angular 19)                     │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  MODULE 2: Test Studio UI    (Angular module — extractable)  │ │
│  │  /test-studio/upload    /test-studio/case/:id                │ │
│  │  /test-studio/library   /test-studio/runner/:runId           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                ↕ HTTP / SSE                        │
└────────────────────────────────────────────────────────────────────┘
                                ↕
┌────────────────────────────────────────────────────────────────────┐
│              MODULE 3: Backend Service (Node + Express)            │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Routes   /upload  /parse  /chat  /save  /library  /run      │ │
│  │  Services AI · FileSystem · CypressRunner · GherkinValidator │ │
│  │           SelectorChecker · Parser · Auth                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│         ↕                     ↕                      ↕            │
│  ┌──────────────┐    ┌──────────────────┐   ┌────────────────┐   │
│  │ MODULE 5:    │    │ MODULE 1:        │   │ Anthropic API  │   │
│  │ SQLite DB    │    │ Cypress + BDD    │   │ (Claude)       │   │
│  │ + run logs   │    │ + POM + steps    │   │                │   │
│  └──────────────┘    └──────────────────┘   └────────────────┘   │
└────────────────────────────────────────────────────────────────────┘

MODULE 4: Project Config (.test-studio/config.json + adapters)
   - auth adapter, routes map, selector hints — per project
```

---

## 3. Tech Stack

| Layer | Tech | Version | Why |
|---|---|---|---|
| E2E framework | Cypress | ^13.x | Industry standard, great DX |
| BDD layer | @badeball/cypress-cucumber-preprocessor | ^20.x | Maintained Cucumber for Cypress |
| Frontend | Angular | 19 (standalone components) | — |
| Styling | **Tailwind CSS** | **4.x (CSS-first config)** | Modern minimal aesthetic; replaces Angular Material entirely |
| Icons | **lucide-angular** | 1.x | Stroke-based modern icon set; Tailwind-friendly sizing |
| A11y primitives | @angular/cdk | 19.x | `Dialog`, `Overlay` (used for our custom toast/dialog) |
| Toasts | Custom `ToastService` | — | Signal-based stack rendered once at root by `ToastHostComponent` |
| Backend runtime | Node.js | ≥20 LTS | Modern JS features |
| Backend framework | Express | 5.x | — |
| Database | better-sqlite3 | ^12.x | Synchronous SQLite — fast, simple (Phase 5) |
| AI SDKs | @anthropic-ai/sdk + openai | latest | Both wired behind `AIProvider` interface |
| File parsing | papaparse + xlsx | (existing) | CSV + Excel — already in package.json |
| File upload | multer | ^1.x | Multipart handling |
| Live streaming | Server-Sent Events (native) | — | One-way log streaming, no WS overhead |
| Cypress runner | child_process.spawn | (built-in) | Native Node, full control over output |

---

## 4. Folder Structure (Phase 1 end-state)

**Top-level:** Two SEPARATE folders side-by-side. Application untouched.

```
GitHub/
│
├── novamark-fe/                                ← APPLICATION (zero changes)
│   ├── src/                                    (existing app)
│   ├── docs/
│   │   └── TEST-STUDIO-PLAN.md                 ← this file
│   └── ...
│
└── test-studio/                                ← AUTOMATION SUITE (everything new)
    │
    ├── cypress/                                ← MODULE 1: E2E framework
    │   ├── e2e/
    │   │   └── features/                       (.feature files — Gherkin)
    │   │       ├── login.feature
    │   │       └── admin-dashboard.feature
    │   ├── support/
    │   │   ├── step_definitions/               (reusable steps — auth/nav/form/verify)
    │   │   ├── pages/                          (Page Object Model classes)
    │   │   ├── commands.ts                     (cy.loginAs, cy.apiMock)
    │   │   └── e2e.ts
    │   ├── fixtures/                           (test data — uploaded + generated)
    │   └── cypress.config.ts
    │
    ├── studio-server/                          ← MODULE 3: Backend (Node + Express)
    │   ├── src/
    │   │   ├── server.ts
    │   │   ├── routes/
    │   │   ├── services/
    │   │   │   ├── ai.service.ts
    │   │   │   ├── filesystem.service.ts
    │   │   │   ├── cypress-runner.service.ts
    │   │   │   ├── gherkin-validator.service.ts
    │   │   │   ├── selector-checker.service.ts
    │   │   │   └── storage/
    │   │   │       ├── storage.interface.ts
    │   │   │       ├── local-fs.storage.ts
    │   │   │       └── minio.storage.ts        (Phase 5+)
    │   │   ├── db/
    │   │   │   ├── schema.sql
    │   │   │   └── migrations/
    │   │   ├── prompts/
    │   │   └── types/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── .env                                (gitignored — ANTHROPIC_API_KEY etc.)
    │
    ├── studio-ui/                              ← MODULE 2: Standalone Angular app
    │   ├── src/app/
    │   │   ├── pages/
    │   │   │   ├── upload/
    │   │   │   ├── case-chat/
    │   │   │   ├── library/
    │   │   │   └── runner/
    │   │   ├── components/
    │   │   │   ├── chat-panel/
    │   │   │   ├── code-preview/
    │   │   │   ├── validation-chip/
    │   │   │   ├── confirm-save/
    │   │   │   └── live-log-stream/
    │   │   ├── services/
    │   │   │   ├── studio-api.service.ts
    │   │   │   ├── studio-state.service.ts
    │   │   │   └── auth.service.ts             (Keycloak SSO)
    │   │   └── app.module.ts
    │   ├── angular.json
    │   └── package.json
    │
    ├── config/                                 ← MODULE 4: per-project config
    │   ├── studio.config.json                  (target app baseUrl, API endpoints, ports)
    │   ├── routes.json                         (page route map for AI context)
    │   ├── selectors.json                      (key selectors hint for AI)
    │   └── auth.adapter.ts                     (HOW Cypress logs into the target app:
    │                                            type=keycloak/firebase/jwt/custom +
    │                                            test user credentials.
    │                                            NOT related to Studio's own login.)
    │
    ├── .test-studio/                           ← MODULE 5: runtime data (gitignored)
    │   ├── studio.db                           (SQLite database)
    │   ├── runs/                               (per-run videos, screenshots, logs)
    │   └── uploads/                            (raw CSV/Excel originals)
    │
    ├── package.json                            ← root: orchestration scripts
    │   {
    │     "scripts": {
    │       "dev": "concurrently \"npm:dev:server\" \"npm:dev:ui\"",
    │       "dev:server": "cd studio-server && npm run dev",
    │       "dev:ui": "cd studio-ui && ng serve --port 4300",
    │       "cy:open": "cypress open",
    │       "cy:run": "cypress run"
    │     }
    │   }
    ├── README.md
    └── .gitignore                              (ignores .test-studio/runs, uploads, .env, *.db)
```

### Dev environment — 3 processes running

```
Port 4200  →  novamark-fe         (existing — the app being tested)
Port 3001  →  studio-server       (new — Express backend)
Port 4300  →  studio-ui           (new — Test Studio interface)
```

### Authentication model — TWO INDEPENDENT auth systems

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   1. STUDIO AUTH (always Keycloak)                              │
│      - Tester logs into studio-ui (port 4300) via Keycloak     │
│      - This is the ONLY login the tester performs              │
│      - Same Keycloak setup for every project that uses the kit │
│                                                                 │
│   2. APP AUTH (whatever the app uses)                           │
│      - novamark-fe → Keycloak                                   │
│      - Future Project A → Firebase                              │
│      - Future Project B → JWT / custom / no-auth               │
│      - Tester NEVER logs into the app directly                  │
│      - Cypress handles app login via cy.loginAs() + adapter    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Tester opens **only Test Studio** (port 4300) — the app being tested is launched/controlled by Cypress when a run starts. The kit's portability comes from this separation: Studio doesn't care what auth the target app uses.

### Repository options

Both work — pick based on team workflow:
- **Option 1: Two separate Git repos** (`novamark-fe`, `test-studio`) — cleanest history, independent deployments
- **Option 2: Monorepo** (single `novamark/` with both as subfolders + npm workspaces) — unified versioning, single CI

Phase 1 me Option 1 simpler hai.

---

## 5. Database Structure (SQLite)

Single local file: `test-studio-server/src/db/studio.db`. **Gitignored** (run history is per-environment).

### Schema

```sql
-- ─────────────────────────────────────────────
-- TESTS: catalog of all saved tests
-- ─────────────────────────────────────────────
CREATE TABLE tests (
  id              TEXT PRIMARY KEY,           -- e.g. 'tst_01HXY...'
  file_path       TEXT NOT NULL UNIQUE,       -- 'cypress/e2e/features/login.feature'
  name            TEXT NOT NULL,              -- 'Login flow'
  description     TEXT,
  tags            TEXT,                       -- JSON: ["auth", "smoke"]
  source          TEXT NOT NULL,              -- 'ai-generated' | 'manual' | 'uploaded'
  status          TEXT NOT NULL,              -- 'draft' | 'saved' | 'archived'
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by      TEXT,                       -- Keycloak user id/email
  current_version INTEGER DEFAULT 1
);

-- ─────────────────────────────────────────────
-- TEST_VERSIONS: every save = new version (improvement #5)
-- ─────────────────────────────────────────────
CREATE TABLE test_versions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id            TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  version            INTEGER NOT NULL,
  feature_content    TEXT NOT NULL,           -- raw .feature file content
  step_definitions   TEXT,                    -- JSON of step defs added
  fixtures           TEXT,                    -- JSON of fixtures added
  saved_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  saved_by           TEXT,
  change_summary     TEXT,
  UNIQUE(test_id, version)
);

-- ─────────────────────────────────────────────
-- RUNS: execution history
-- ─────────────────────────────────────────────
CREATE TABLE runs (
  id                 TEXT PRIMARY KEY,         -- e.g. 'run_01HXY...'
  test_id            TEXT REFERENCES tests(id),
  version            INTEGER,
  status             TEXT NOT NULL,            -- 'running' | 'passed' | 'failed' | 'errored'
  started_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at        DATETIME,
  duration_ms        INTEGER,
  scenarios_total    INTEGER,
  scenarios_passed   INTEGER,
  scenarios_failed   INTEGER,
  logs_path          TEXT,                     -- '.test-studio/runs/run_xxx/stdout.log'
  video_path         TEXT,
  screenshots_dir    TEXT,
  triggered_by       TEXT,
  exit_code          INTEGER
);

-- ─────────────────────────────────────────────
-- CONVERSATIONS: chat history per test
-- ─────────────────────────────────────────────
CREATE TABLE conversations (
  id          TEXT PRIMARY KEY,
  test_id     TEXT REFERENCES tests(id),
  upload_id   TEXT REFERENCES uploads(id),    -- if started from upload
  started_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at    DATETIME,
  user_id     TEXT
);

CREATE TABLE messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,              -- 'user' | 'assistant' | 'system'
  content         TEXT NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata        TEXT                        -- JSON: tool calls, attachments, validation result
);

-- ─────────────────────────────────────────────
-- UPLOADS: raw uploaded files (CSV/Excel)
-- ─────────────────────────────────────────────
CREATE TABLE uploads (
  id              TEXT PRIMARY KEY,
  filename        TEXT NOT NULL,
  mime_type       TEXT,
  uploaded_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  uploaded_by     TEXT,
  storage_path    TEXT,                       -- '.test-studio/uploads/xxx.csv'
  parsed_count    INTEGER DEFAULT 0
);

CREATE TABLE upload_test_cases (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id     TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  case_number   TEXT,                         -- 'TC-001'
  raw_content   TEXT,                         -- original row content
  status        TEXT NOT NULL,                -- 'pending' | 'processing' | 'saved' | 'rejected'
  test_id       TEXT REFERENCES tests(id)     -- once saved, link to test
);

-- ─────────────────────────────────────────────
-- INDEXES for common queries
-- ─────────────────────────────────────────────
CREATE INDEX idx_tests_status     ON tests(status);
CREATE INDEX idx_tests_created_at ON tests(created_at DESC);
CREATE INDEX idx_runs_test_id     ON runs(test_id, started_at DESC);
CREATE INDEX idx_messages_convo   ON messages(conversation_id, created_at);
```

### Why SQLite (not Postgres / not JSON files)

| | JSON files | SQLite ✅ | Postgres |
|---|---|---|---|
| Setup | Zero | Zero (single file) | Server install needed |
| Queries (filter, sort, search 100+ tests) | Slow, full read | Indexed, fast | Fast |
| Concurrent writes | Race conditions | ACID | ACID |
| Phase 1 fit | OK at <30 tests | Perfect | Overkill |
| Future migration | Pain | `pg_loader` available | — |

SQLite Phase 1 me perfect — file-based, version controllable schema, easy backup. Phase 4+ pe Postgres migrate karna ho to schema almost identical hoga.

### What lives in DB vs file system

| Data | Where | Why |
|---|---|---|
| `.feature` files | File system (`cypress/e2e/features/`) | Cypress chalane ke liye chahiye, version controlled in Git |
| Step definitions | File system (`cypress/support/step_definitions/`) | Same as above |
| Fixtures | File system (`cypress/fixtures/`) | Same as above |
| Test catalog metadata | SQLite (`tests` table) | Queryable, sortable |
| Version history | SQLite (`test_versions`) | Compact diff storage, rollback |
| Run history | SQLite (`runs`) | Trends, dashboards |
| Run artifacts (screenshots, videos, logs) | File system (`.test-studio/runs/`) | Big files, gitignored |
| Chat conversations | SQLite (`conversations`, `messages`) | Resumable, audit-able |
| Uploaded files | File system (`.test-studio/uploads/`) | Original copy preserved |

---

## 6. Backend Architecture (How It Runs)

### Process model

```
┌─────────────────────────────────────────────────────────┐
│ Developer machine / dev environment                      │
│                                                          │
│  ┌─────────────────────┐    ┌─────────────────────┐    │
│  │ Angular dev server  │    │ Test Studio backend │    │
│  │ ng serve            │    │ node test-studio... │    │
│  │ port 4200           │◀──▶│ port 3001           │    │
│  └─────────────────────┘    └─────────────────────┘    │
│           │                            │                 │
│           │                            ├──▶ SQLite file  │
│           │                            ├──▶ Anthropic API│
│           │                            └──▶ spawn cypress│
│           │                                              │
│  package.json scripts:                                   │
│    "studio:dev": "concurrently \"ng serve\"              │
│                    \"node test-studio-server\""          │
└─────────────────────────────────────────────────────────┘
```

Two processes via `concurrently`:
- Angular (4200) — already running
- Test Studio backend (3001) — new

Angular `proxy.conf.json` me `/api/test-studio/*` → `http://localhost:3001` ka proxy add karenge.

### API endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/test-studio/uploads` | Upload CSV/Excel; returns parsed cases list |
| `GET`  | `/api/test-studio/uploads/:id/cases` | List parsed cases from an upload |
| `POST` | `/api/test-studio/conversations` | Start a chat (new test or for an upload case) |
| `POST` | `/api/test-studio/conversations/:id/messages` | Send user message; returns Claude reply + preview + validation |
| `POST` | `/api/test-studio/tests/save` | Confirm & save — writes files, creates DB row |
| `GET`  | `/api/test-studio/library` | List all saved tests with metadata + last run |
| `GET`  | `/api/test-studio/tests/:id` | Test details — versions, code, run history |
| `PUT`  | `/api/test-studio/tests/:id` | Update test (creates new version) |
| `DELETE` | `/api/test-studio/tests/:id` | Archive (soft delete) |
| `POST` | `/api/test-studio/runs` | Start a run (single test, multiple, or by tag); returns runId |
| `GET`  | `/api/test-studio/runs/:id/stream` | **SSE** — live stdout, scenario events, finish |
| `GET`  | `/api/test-studio/runs/:id` | Run details + artifacts paths |
| `GET`  | `/api/test-studio/runs/:id/screenshots/:name` | Serve screenshot |

### Service layer

```typescript
// AI Service (services/ai.service.ts)
class AIService {
  async generate(opts: {
    conversationId: string;
    userMessage: string;
    projectContext: ProjectContext; // routes, selectors, available steps
  }): Promise<{ featureContent: string; newSteps: StepDef[]; explanation: string;
                modelUsed: string; providerUsed: 'anthropic' | 'openai' }> {
    // 1. Build system prompt with project context
    //    Anthropic: cache_control: ephemeral on system + projectContext blocks
    //    OpenAI:    just one combined system message — caching is automatic
    // 2. Append conversation history
    // 3. Append user message
    // 4. getProviderForModel(opts.model).generate({...}) with tool-forced output
    // 5. Parse response (Anthropic: tool_use.input is object;
    //                    OpenAI: tool_calls[0].function.arguments is JSON string)
    // 6. Return normalized GenerationResult
  }
}

// Filesystem Service (services/filesystem.service.ts)
class FilesystemService {
  async writeTest(opts: SaveOpts): Promise<{ filesWritten: string[] }> {
    // Atomic write: feature + steps + fixtures
    // Validates path is inside project boundaries (security)
    // Returns list of written paths
  }
  async listFeatureFiles(): Promise<string[]> { ... }
}

// Cypress Runner (services/cypress-runner.service.ts)
class CypressRunner {
  startRun(testIds: string[], emitter: EventEmitter): runId {
    // spawn('npx', ['cypress', 'run', '--spec', specs.join(',')])
    // pipe stdout → parse Cucumber events → emit
    // on exit: parse results, persist run record
  }
}

// Gherkin Validator (services/gherkin-validator.service.ts)
class GherkinValidator {
  validate(content: string): { ok: boolean; errors: ParseError[] } { ... }
}

// Selector Checker (services/selector-checker.service.ts)
class SelectorChecker {
  check(featureContent: string, projectSelectors: SelectorMap): { found: string[]; missing: string[] } {
    // Extract selector references from feature
    // Cross-check against project's known selectors map
    // (Optionally) launch headless cypress to verify selectors at the page level
  }
}
```

### Key sequence diagrams

**Sequence 1: Upload → Parse → List**
```
Tester    Frontend          Backend           FS              SQLite
  │          │                 │                │                │
  ├─upload─▶│                 │                │                │
  │          ├─POST /uploads─▶│                │                │
  │          │                 ├─save raw file─▶│                │
  │          │                 ├─parse CSV──────                 │
  │          │                 ├─INSERT upload + cases ─────────▶│
  │          │◀─{cases:[..]}──│                │                │
  │◀─list───│                 │                │                │
```

**Sequence 2: Chat → Generate → Validate → Preview**
```
Tester    Frontend          Backend         Anthropic    Validators
  │          │                 │                │              │
  ├─message▶│                 │                │              │
  │          ├─POST /messages▶│                │              │
  │          │                 ├─load conv hist                │
  │          │                 ├─load proj ctx (cached)        │
  │          │                 ├─claude.create()─▶│             │
  │          │                 │◀─feature code──│              │
  │          │                 ├─validate gherkin─────────────▶│
  │          │                 ├─check selectors──────────────▶│
  │          │                 │◀─validation report────────────│
  │          │◀─{preview, val}─│                │              │
  │◀─preview │                 │                │              │
```

**Sequence 3: Confirm & Save**
```
Tester    Frontend          Backend           FS              SQLite
  │          │                 │                │                │
  ├─confirm▶│                 │                │                │
  │          ├─POST /save────▶│                │                │
  │          │                 ├─re-validate                    │
  │          │                 ├─write .feature─▶│               │
  │          │                 ├─write steps────▶│               │
  │          │                 ├─write fixtures─▶│               │
  │          │                 ├─INSERT test+version────────────▶│
  │          │◀─{success,id}──│                │                │
  │◀─toast──│                 │                │                │
```

**Sequence 4: Run with live logs (SSE)**
```
Tester    Frontend          Backend         Cypress         SQLite
  │          │                 │                │              │
  ├─run────▶│                 │                │              │
  │          ├─POST /runs────▶│                │              │
  │          │◀─{runId}───────│                │              │
  │          ├─GET /stream═══▶│  (SSE open)    │              │
  │          │                 ├─spawn cypress─▶│              │
  │          │                 │◀═stdout═══════│              │
  │          │◀═event═════════│                │              │
  │          │                 │◀─exit─────────│              │
  │          │                 ├─INSERT run──────────────────▶│
  │          │◀═finished═════│                │              │
```

---

## 7. Tester Workflow (UX)

### Step-by-step

```
1. Login to novamark-fe (Keycloak)
2. Navigate to /test-studio
3. Click "+ New Test" or "📤 Upload File"
4. (If upload) parsed cases list dikhta hai
5. Click on a case → chat panel opens
6. Tester chats in Hindi/English/Hinglish
7. Claude returns:
   - .feature preview
   - Validation chips (syntax, selectors, new-step count)
   - Required fixtures (if any)
8. Tester options:
   ✅ Confirm & Save  ✏ Edit inline  🔄 Regenerate  💬 Refine
9. On Save:
   - Files written to cypress/
   - DB row created
   - Toast: "✅ Saved" with [👁 Preview] [▶ Run Now] [➕ Next]
10. Library shows test with NEW badge
11. Run → live log stream → pass/fail
12. (If fail) [💬 Debug with AI] → chat reopens with run logs
```

### 6 flow improvements (locked in)

| # | Improvement | Where it shows up |
|---|---|---|
| 1 | **Pre-save validation gate** | Chat panel — chip strip before Confirm button |
| 2 | **Inline edit before save** | Preview card — monaco editor toggle |
| 3 | **"Run now" right after save** | Save toast — 3 buttons |
| 4 | **AI debug loop on failure** | Library + runner — "💬 Debug" button |
| 5 | **Versioning per save** | Test details page — version timeline |
| 6 | **Batch save mode** | Upload list — multi-select + "Save Selected" |

---

## 8. AI / Claude Integration Detail

### Prompt structure (with caching)

```
┌─────────────────────────────────────────────────────────────┐
│ SYSTEM PROMPT (cached — cache_control: ephemeral)           │
│ - Role: senior QA engineer                                  │
│ - Rules: only Gherkin output, only English, reuse steps     │
│ - Output schema (tool definition): generateTest(...)        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ PROJECT CONTEXT (cached)                                    │
│ - routes.json (page paths)                                  │
│ - selectors.json (known data-cy selectors)                  │
│ - existing step definitions list (so AI reuses)             │
│ - auth model (e.g. Keycloak realms, available roles)        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ CONVERSATION HISTORY (not cached — varies per chat)         │
│ - prior user messages                                       │
│ - prior assistant responses                                 │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ CURRENT USER MESSAGE                                        │
└─────────────────────────────────────────────────────────────┘
```

System + Project Context = 5-min ephemeral cache. Saves ~80% input tokens after first call in a 5-min window.

### Tool definition (forces structured output)

```typescript
{
  name: "generateTest",
  description: "Produce a Gherkin feature + any new step definitions",
  input_schema: {
    type: "object",
    properties: {
      featureContent: { type: "string", description: "Full .feature file content" },
      newStepDefinitions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            pattern: { type: "string" },        // e.g. 'I should see {int} cards'
            implementation: { type: "string" }, // TypeScript code
            file: { type: "string" }            // 'verification.steps.ts'
          }
        }
      },
      fixturesNeeded: {
        type: "array",
        items: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } } }
      },
      explanation: { type: "string", description: "One-paragraph plain-English summary for the tester" }
    },
    required: ["featureContent", "explanation"]
  }
}
```

Force tool use → AI **must** return parseable structured output. No regex hell.

### Model choice

- **Default:** `gpt-4o-mini` (fast, cheap, good at structured output) — picked because user only had OpenAI credits initially.
- **Available in picker:** `gpt-4o-mini`, `gpt-4o`, `claude-sonnet-4-6`, `claude-opus-4-7`. List lives in `studio-server/src/services/ai-providers/models.catalog.ts`.
- **Provider routing:** model-name prefix (`claude-*` → Anthropic, `gpt-*` / `o*` → OpenAI). Models whose API key is missing show as disabled in the UI dropdown.
- **Future debug-with-AI:** prefer `claude-opus-4-7` or `gpt-4o` (stronger reasoning) for failure analysis flows.

---

## 9. Phased Implementation Roadmap

### **Phase 1 — Cypress + BDD Foundation** (no AI yet)
**Deliverable:** Manually written .feature files run via Cypress, BDD pipeline working.

- [ ] Install Cypress + cucumber preprocessor + types
- [ ] `cypress.config.ts` configured for Gherkin
- [ ] `tsconfig.cypress.json` for spec paths
- [ ] Folder skeleton: `cypress/e2e/features`, `cypress/support/{step_definitions,pages}`
- [ ] Page Object Model base class + LoginPage + DashboardPage
- [ ] 8–10 baseline step definitions (auth/nav/form/verify)
- [ ] 2 manual `.feature` files (login, dashboard)
- [ ] `cy.loginAs(role)` custom command via Keycloak
- [ ] `npm run cy:open` and `npm run cy:run` working
- [ ] CI hook in `bitbucket-pipelines.yml` (smoke run)

**Success:** Tester runs `npm run cy:run` and sees passing scenarios.

### **Phase 2 — Backend AI Service** (standalone, no UI yet)
**Deliverable:** Backend that takes a chat message + project context and returns a valid .feature file.

- [ ] `test-studio-server/` folder, Express scaffold
- [ ] SQLite schema applied via migration script
- [ ] `/conversations` + `/messages` endpoints
- [ ] AIService — multi-provider (Anthropic + OpenAI) behind `AIProvider` interface, prompt caching, tool-forced output
- [ ] Project context loader (`.test-studio/config.json`, routes, selectors)
- [ ] GherkinValidator + SelectorChecker
- [ ] FilesystemService with safe write boundaries
- [ ] `/tests/save` endpoint writes files + creates DB row
- [ ] Postman collection for manual end-to-end test

**Success:** curl chat endpoint with "login test", get back a .feature file, save it, see it on disk.

### **Phase 3 — Test Studio UI**
**Deliverable:** Full tester experience in browser.

- [ ] Angular module + lazy-loaded route `/test-studio`
- [ ] Upload page (multer integration, progress)
- [ ] Case-chat page (chat panel + code preview + validation chips + per-message model picker)
- [ ] Library page (Tailwind card grid, filters, multi-select)
- [ ] Inline edit (line-numbered textarea) + 6 flow improvements wired
- [ ] Confirm-save flow with success toast (3 actions)
- [ ] Auth guard — only QA role users can access

**Success:** Tester logs in, uploads CSV, chats, confirms, sees test in library.

### **Phase 4 — Runner + Live Logs**
**Deliverable:** One-click run with live results.

- [ ] CypressRunner service with child_process.spawn
- [ ] Cucumber JSON reporter integration
- [ ] SSE endpoint streaming scenario events
- [ ] Runner UI page — live log, progress bar per scenario
- [ ] Screenshot/video viewer
- [ ] Failure → "Debug with AI" deeplink with run context

**Success:** Tester clicks Run on a test, sees live logs, video on failure.

### **Phase 5 — Extract as Portable Kit**
**Deliverable:** `npx create-test-studio-app` works in any project.

- [ ] Package modules 1, 3, 5 as `@yourname/test-studio-kit`
- [ ] `create-test-studio-app` CLI generator
- [ ] Adapter interfaces (auth, routes, selectors) clearly documented
- [ ] Example integrations: Angular, React, Vue
- [ ] Kit-level docs and quickstart

**Success:** Empty new project + 1 command → working Test Studio.

### Future scope (not in Phase 1–5)
- Git PR auto-create on save (locked decision says skip for now)
- Multi-user collaboration (real-time chat presence)
- Test recommendations based on coverage gaps
- Visual regression / screenshot diffing
- Cross-browser matrix runs
- Cloud-hosted test runner (parallel sharding)

---

## 10. Security & Safety

| Risk | Mitigation |
|---|---|
| AI writes outside project folder | FilesystemService validates path is `cypress/**`, `.test-studio/**` only |
| Arbitrary code execution via generated step defs | Step defs reviewed/validated; only well-known imports allowed; future: sandbox |
| API key exposure | Anthropic + OpenAI keys live in backend `.env` only — never sent to frontend |
| Tester deletes others' tests | Soft delete (status = archived); only QA Lead role can hard delete |
| Concurrent file writes (race) | SQLite transactions + single-writer FS lock per file |
| Cypress run on prod data | `cypress.config.ts` baseUrl forced to staging/local — no prod URL |
| Uploaded file injection | Multer file-type whitelist (CSV/XLSX/DOCX), size limit |

---

## 11. Storage Architecture (Pluggable)

All file artifacts (uploads, screenshots, videos, logs) go through a **Storage interface** — Phase 1 uses local FS, future phases can swap MinIO / S3 / R2 without touching business logic.

```typescript
// services/storage/storage.interface.ts
interface Storage {
  put(key: string, data: Buffer | Readable): Promise<{ url: string }>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, ttl?: number): Promise<string>;
  list(prefix: string): Promise<string[]>;
}

class LocalFsStorage implements Storage { ... }   // Phase 1 — writes to .test-studio/
class MinIOStorage   implements Storage { ... }   // Phase 5+ — when shared/scaled
class S3Storage      implements Storage { ... }   // Phase 5+ — AWS / R2 / Bunny
```

ENV-controlled:
```env
STORAGE_TYPE=local        # default Phase 1
# STORAGE_TYPE=minio
# MINIO_ENDPOINT=http://minio:9000
# MINIO_BUCKET=test-studio-artifacts
# MINIO_ACCESS_KEY=...
# MINIO_SECRET_KEY=...
```

### When to migrate from local FS to MinIO/S3

| Trigger | Migrate? |
|---|---|
| > 10 GB total artifacts on disk | ✅ |
| 5+ concurrent testers on same backend | ✅ |
| Tests run on ephemeral CI runners | ✅ |
| Need to share run reports with external stakeholders | ✅ |
| Compliance/audit requires immutable artifact store | ✅ |
| Solo dev / small team / single machine | ❌ stay local |

### Cleanup policy (Phase 1, local FS)

Cron job in backend:
- Videos older than 30 days → delete
- Logs older than 90 days → delete
- Screenshots older than 90 days → compress + archive
- Database records persist (small footprint, useful for trends)

---

## 12. Open Questions — RESOLVED ✅

| # | Question | Decision |
|---|---|---|
| 1 | AI API keys | `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` in `studio-server/.env` (gitignored). At least one required. Default model `gpt-4o-mini`. |
| 2 | Cypress mode in dev | Headed — visible browser. CI runs headless. |
| 3 | Test Studio access | Any Keycloak logged-in user (Phase 1). Role gating deferred to Phase 5. |
| 4 | Storage / file artifacts | Local FS in Phase 1, behind Storage interface so MinIO/S3 swap-in is trivial. |

---

## 13. Quick Reference — Sample Files

### Sample `.feature` file
```gherkin
@auth @smoke
Feature: Admin Login
  Background:
    Given the application is open at "/login"

  Scenario: Valid admin login lands on dashboard
    When I enter "admin@thecontrast.in" in "Username"
    And I enter "admin123" in "Password"
    And I click "Sign In"
    Then I should be on the "/dashboard" page
    And I should see 5 metric cards
    And the welcome message should contain "Admin"
```

### Sample step definition
```typescript
// cypress/support/step_definitions/auth.steps.ts
import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';

Given('the application is open at {string}', (path: string) => {
  cy.visit(path);
});

When('I enter {string} in {string}', (value: string, fieldLabel: string) => {
  cy.findByLabelText(fieldLabel).clear().type(value);
});

When('I click {string}', (buttonText: string) => {
  cy.contains('button', buttonText).click();
});

Then('I should be on the {string} page', (path: string) => {
  cy.url().should('include', path);
});
```

### Sample backend env
```env
# studio-server/.env
PORT=3001

# At least one provider key required. Auto-routed by model-name prefix.
ANTHROPIC_API_KEY=sk-ant-...      # for claude-* models
OPENAI_API_KEY=sk-proj-...        # for gpt-* / o* models

SQLITE_PATH=../.test-studio/studio.db
PROJECT_ROOT=..

# Default model when UI doesn't specify one
DEFAULT_MODEL=gpt-4o-mini
DEBUG_MODEL=gpt-4o
```

---

**Document version:** 1.0  
**Last updated:** 2026-05-08
