# Test Studio — Progress & Roadmap

> **Companion to `TEST-STUDIO-PLAN.md`.** Plan = architecture/decisions. This file = "what's done, what's left, in what order."
>
> **Last updated:** 2026-05-11 (Phase C complete ✅; Phase D & E partial; UI redesigned with horizontal nav + mobile responsive; Firebase Hosting live)

---

## 1. Executive Status

| Item | Value |
|---|---|
| Overall state | **Phases 1–4 + Edit + Headed + Multi-provider AI + Tailwind UI + Phase A (Postgres + Multi-project) + Phase B (MinIO/Storage) + Phase C (Chat Attachments) complete. Phase D log-bundle replay done (test-detail page pending). Phase E server container + Firebase Hosting live (full docker-compose pending).** |
| Live deployment | **UI:** https://test-studio-fc339.web.app (Firebase Hosting) · **Server:** production backend container |
| Last verified working | Responsive UI revamp (horizontal nav + hamburger + mobile cards for history table), Phase C chat-image attachments end-to-end, log-bundle replay from `run_logs` / archived bundles, Firebase Hosting deploy |
| Blocker right now | None |
| Estimated to MVP | **~0.5 session** (Phase D test-detail page) |
| Estimated to production-ready | ~4 sessions total |
| Estimated to portable kit | ~7 sessions total |

---

## 2. Done ✅

### Phase 1 — Cypress + BDD Foundation
- Cypress 14.5.4 + cucumber preprocessor + esbuild
- TypeScript 5.6.3 (downgraded — TS6 breaks Cypress's ts-node)
- Page Object Model (`BasePage`, `HomePage`, `LoginPage`)
- Reusable steps (auth / navigation / form / verification)
- `cy.loginAs(role)` driven by `config/auth.adapter.ts`
- `cypress.config.ts` with conditional baseUrl (env var toggle)
- 2 working `.feature` files (smoke + home)

### Phase 2 — Backend AI Service (`studio-server/`)
- Express 5 + TypeScript + tsx watch (hot reload)
- CORS configured for studio-ui origin
- Endpoints: `/health`, `/library`, `/library/:id/content`, `/conversations`, `/conversations/:id`, `/conversations/:id/messages`, `/tests/save`, `/tests/:id` (PUT — edit), `/tests/:id/refine-conversation`, `/runs` (POST + list), `/runs/:id`, `/runs/:id/stream` (SSE), `/runs/:id/video`, `/runs/:id/screenshots`, `/runs/:id/screenshots/:filename`, **`/models`**
- **Multi-provider AI** (`src/services/ai-providers/`):
  - `provider.interface.ts` (common contract + tool schema)
  - `anthropic.provider.ts` — Claude SDK with `cache_control` ephemeral caching
  - `openai.provider.ts` — OpenAI SDK with auto prompt caching (>1024 tokens)
  - `models.catalog.ts` — exposed model list (Claude Sonnet/Opus + GPT-4o/4o-mini)
  - Routes by model-name prefix (`claude-*` → Anthropic, `gpt-*` / `o*` → OpenAI)
  - Each provider reports `available` based on whether its API key is set
- `ai.service.ts` is now a thin facade that delegates to the right provider per request
- Tool-forced structured output (`generateTest` tool — same JSON Schema for both providers)
- Project context loader (routes, selectors, available step patterns)
- Gherkin validator (syntax + warning checks)
- File-system writer with safe path boundaries + `overwriteFilePath` option (used by refine flow)
- Conversation store tracks `originatingTestId` so `/tests/save` can overwrite an existing file when a chat was seeded from "Refine with AI"
- Graceful AI-offline fallback when both keys missing
- In-memory conversation + run stores (will move to SQLite Phase 5)

### Phase 3 — Studio UI (`studio-ui/`) — **redesigned to Tailwind**
- Angular 19 standalone app on port 4300
- **Tailwind CSS 4** + **lucide-angular** icons (replaced Angular Material entirely)
- Zinc + Indigo light theme · Inter font · JetBrains Mono for code
- Lazy-loaded routes, signals-based state
- Custom `ToastService` + `ToastHostComponent` (CDK-overlay style stack, replaces MatSnackBar)
- `@angular/cdk/dialog` for the Preview dialog (replaces MatDialog)
- All page templates inlined into their `.ts` (no `.html`/`.scss` per page)
- Pages: **Library** (card grid), **Case Chat** (model picker + refine badge), **Edit** (line-numbered editor), **Runner** (live log + scenario panel + recording)
- Components: **Preview Dialog**
- Bundle: ~1.56 MB initial dev (was ~2 MB+ with Material), styles ~37 kB

### Phase 4 — Run Integration
- Cypress runner spawns child process with `child_process.spawn`
- Smart baseUrl detection (only sets `CY_USE_BASE_URL=1` if spec uses relative paths)
- Live stdout parsing for passing scenarios
- After-finish accurate parsing from `.test-studio/last-run.json` (cucumber JSON report)
- SSE live log stream to UI
- Video served via streaming with Range support (proper seeking + duration probe)
- Screenshots listed + served with absolute URLs
- `dotfiles: 'allow'` workaround for Express 5 dotfile blocking

### Edit Feature (added beyond original Phase 4)
- `/edit/:testId` page — editable code area with line numbers
- Live Gherkin validation chips (syntax / scenarios / tags / warnings)
- Tab key inserts 2 spaces; dirty-state tracking with orange dot indicator
- **Save** — overwrites file via `PUT /tests/:id` with validation
- **Save & Run** — split button (headless / headed)
- **Reset** — reverts unsaved changes to original
- **Refine with AI** — backend creates an AI conversation seeded with current `.feature` as context, frontend navigates to chat with `?conversationId=…&refineTestId=…`
  - Chat page detects refine mode → shows orange "refining existing" badge + "Back to Edit" button (instead of "Start over" which would clear the seeded chat)
  - Save in refine mode **overwrites the original file** (does not create a `-2.feature` copy) — backend tracks `originatingTestId` on the conversation and uses `testWriter.overwriteFilePath` to write back to the same path
  - Snackbar shows **"Updated"** vs **"Saved"** depending on whether it was a refine

### Multi-provider AI (added beyond original plan)
- **OpenAI + Anthropic** behind one `AIProvider` interface — see Phase 2 above
- New `GET /api/test-studio/models` returns catalog with `{ id, label, provider, description, available }`
- Chat page header has a model picker (`<select>`) — choices grouped by provider, key-missing models disabled
- Selection persists in `localStorage` (`studio.selectedModel`)
- AI bubble shows model used (e.g. `gpt-4o-mini`, `claude-sonnet-4-6`) and provider label (GPT / Claude)
- Per-message: chat sends `{ content, model }` so the user can switch models mid-conversation

### Headed mode (added)
- Backend accepts `headed: boolean` on `POST /runs`, passes `--headed` flag to Cypress
- UI: split button (Run + dropdown) on Library cards, Edit page Save & Run, Runner Re-run
- Choices: "Run headless (fast)" / "Run with browser (live)"
- URL persists `?headed=0|1` so Re-run uses same mode by default

### Documentation
- `TEST-STUDIO-PLAN.md` — architecture, decisions, schemas
- `TEST-STUDIO-PROGRESS.md` — this file
- `ARCHITECTURE.md` — runtime overview + signal flow
- `README.md` (root) — quickstart

---

### Phase A (from POSTGRES-MIGRATION-PLAN.md) — Postgres + Multi-project ✅ COMPLETE
**Completed:** 2026-05-10

- ✅ Sequelize + Postgres 17 (remote) — connection, schema sync (`alter: { drop: false }`)
- ✅ All DB models: `Project`, `ProjectConfig`, `Test`, `TestVersion`, `Run`, `RunLog`, `Conversation`, `Message`, `ChatAttachment`
- ✅ All 6 repositories: `projects.repo`, `tests.repo`, `runs.repo`, `run-logs.repo`, `conversations.repo`, `attachments.repo`
- ✅ `ConversationStore` — thin DB-backed wrapper (no more in-memory Map)
- ✅ `RunnerService` — persists runs to DB; `RunLogsRepo` batch-inserts stdout per run
- ✅ New project routes (`GET/POST/PUT/DELETE /api/projects`, `PUT /api/projects/:id/config`)
- ✅ All existing routes project-scoped + **Zod validation on every route**
- ✅ Workspace materializer (`src/services/workspace-materializer.service.ts`) — lazy, per-project, atomic rename
- ✅ `cypress.config.ts` specPattern updated to match `.workspace/**/cypress/e2e/**/*.feature`
- ✅ Import script (`npm run import-tests`) — seeds existing `.feature` files into DB (idempotent)
- ✅ CORS: both `localhost:4200` and `localhost:4300` allowed; Express 5 preflight fixed
- ✅ UI: Projects page, create dialog, project switcher in toolbar
- ✅ UI: Library, Chat, Runner all use `activeProjectId` from signal + localStorage
- ✅ Smoke tested: create project → AI chat → save test → run test → DB-backed ✅

**Bugs fixed during Phase A:**
- `SequelizeUnknownConstraintError` on `alter:true` → fixed with `alter: { drop: false }`
- `toISOString()` on null (`Message.createdAt`) → `@CreatedAt` doesn't work with `timestamps:false`; fixed with `defaultValue: DataType.NOW` + null-safe fallback
- Cypress `Can't find spec` → `specPattern` only had `cypress/e2e/**`; added `.workspace/**/cypress/e2e/**` glob
- `z.record(z.unknown())` Zod v4 requires 2 args → fixed to `z.record(z.string(), z.unknown())`

---

### Phase B (from POSTGRES-MIGRATION-PLAN.md) — MinIO / Object Storage ✅ COMPLETE
**Completed:** 2026-05-10
**Plan doc:** `docs/PHASE-B-MINIO-PLAN.md`

- ✅ `Storage` interface in `studio-server/src/services/storage/`
- ✅ `MinioStorage` (S3-compatible, uses `minio` v8 npm SDK) — `putObject`, `getPresignedUrl`, `objectExists`, `deleteObject`, `getObjectStream`, `ensureBucket`
- ✅ `LocalFsStorage` dev fallback — writes to `.test-studio/storage/`, presign URLs go through `/api/test-studio/storage/*` proxy with Range support for video
- ✅ Singleton selection via `STORAGE_DRIVER=minio|local` env (default `minio`)
- ✅ Boot hook: `storage.ensureBucket()` after sequelize init; warning-only on failure (run still works)
- ✅ `cypress-runner.service.ts.uploadArtifacts()` — kicks off via `setImmediate` after `finish` event so SSE close is not delayed
- ✅ Uploads: `video.mp4` (kind=video), `screenshots/*.png|jpg` (kind=screenshot, scenario name parsed from filename), `cucumber-report.json` (kind=report)
- ✅ Per-file `RunsRepo.attachArtifact()` row written; local files deleted after upload (toggle: `KEEP_LOCAL_ARTIFACTS=true`)
- ✅ Legacy `GET /runs/:id/video`, `/runs/:id/screenshots`, `/runs/:id/screenshots/:filename` → DB-first lookup → 302 to presigned URL; falls back to in-memory local stream for active runs whose upload hasn't completed
- ✅ New `GET /runs/:id/artifacts` — typed list with presigned URLs (kind-specific TTL: 60min video, 15min screenshots/report)
- ✅ `.env.example` updated with `STORAGE_DRIVER`, `MINIO_*`, `KEEP_LOCAL_ARTIFACTS`, `SERVER_BASE_URL` — points at externally deployed MinIO (no local Docker stack)
- ✅ Smoke tested end-to-end: trigger run → artifact rows + storage files → `/artifacts` returns URLs → `/video` 302 → file plays back; restart server → past run still streams

**Bugs fixed during Phase B:**
- `RunArtifact.createdAt` always `null` → same `@CreatedAt` + `timestamps:false` issue as Phase A's `Message`; fixed with `defaultValue: DataType.NOW`

**Notes:**
- UI did not require any change — 302 redirect makes the cutover transparent. Future Phase D detail page will use the typed `/artifacts` endpoint.
- LocalFsStorage proxy is dev-only. Production must use MinIO/S3 — no signature validation on the proxy URL by design (documented in plan §11).
- Best-effort upload: MinIO down → run completes successfully, warning logged, no artifact rows. UI falls back to local stream until next run.

---

### Phase C — Chat Image Attachments ✅ COMPLETE
**Completed:** 2026-05-10
**Commit:** `50b48c2 feat(phase-c): chat image attachments for AI vision`

- ✅ `ChatAttachment` Sequelize model (`studio-server/src/db/models/chat-attachment.model.ts`) — kind enum (image|file), minioKey, contentType, sizeBytes, width/height
- ✅ `POST /api/conversations/:id/attachments` (multipart via multer) → MinIO upload → `chat_attachments` row
- ✅ `attachments.repo.ts` — create, link-to-message, list-by-conversation/message
- ✅ Provider-specific image content blocks:
  - Anthropic: `{ type: 'image', source: { ... } }` in `anthropic.provider.ts`
  - OpenAI: `{ type: 'image_url', image_url: { url } }` in `openai.provider.ts`
- ✅ UI composer (`case-chat.page.ts`): paperclip icon, hidden file input, `pendingAttachments` + `uploadingFiles` signals, thumbnail chips with × to remove, paste-from-clipboard support
- ✅ Sent message bubbles render image thumbnails (`m.attachments` loop)

---

### Phase D — Test Detail / Run History ⚠️ PARTIAL
**Partial completion:** 2026-05-10
**Commit:** `a68052e feat(phase-d): log-bundle compaction + replay UI`

**Done:**
- ✅ `GET /api/runs/:id/logs` — DB-backed paginated reader with fallback to `log-bundle` archive when run_logs are pruned
- ✅ `RunsRepo` returns `source: 'log-bundle' | 'run_logs'` so UI can label live vs archived
- ✅ History page (`pages/history/history.page.ts`) — expandable rows show archived video/screenshots/report + colored stdout/stderr/event logs
- ✅ Compound DB indexes — `(project_id, started_at)`, `(test_id, started_at)`, `(run_id, sequence)` verified in `studio-server/src/db/sequelize.ts`

**Pending:**
- ❌ `GET /api/tests/:id` — dedicated test-detail endpoint (code + run history per test + tags + version timeline)
- ❌ `DELETE /api/tests/:id` — archive endpoint
- ❌ UI route `/test/:id` and detail page component (currently only `/edit/:testId`, `/run/:testId`, `/history` exist)

---

### Phase E — Containerization + Deploy ⚠️ PARTIAL
**Partial completion:** 2026-05-11
**Commit:** `4c9470b feat(phase-e): containerize backend + Firebase config + env-based API URL`
**Live UI:** https://test-studio-fc339.web.app

**Done:**
- ✅ `studio-server/Dockerfile` — node:20-bullseye-slim, Cypress system deps, tini PID reaper, pre-fetched browser bundle, entrypoint wraps server
- ✅ Root `docker-compose.yml` exists (studio-server service only)
- ✅ Auto-migrate on boot via `sequelize.sync({ alter: { drop: false } })` + idempotent constraint/index migrations in `initDB()`
- ✅ Firebase Hosting for UI — `studio-ui/firebase.json` with SPA rewrite + immutable asset caching + index.html no-store
- ✅ Production CORS configured via `STUDIO_UI_ORIGIN` env (commit `3259727`)
- ✅ Env-based `apiBaseUrl` in `environments/environment.prod.ts` (commit `16d25b2`)

**Pending:**
- ❌ `studio-ui/Dockerfile` (multi-stage build → nginx serve) — currently using Firebase Hosting instead, but for self-hosted compose this is required
- ❌ Full `docker-compose.yml` services: `postgres`, `minio`, `minio-init`, `studio-ui`, nginx reverse proxy
- ❌ `nginx.conf` for self-hosted: SPA fallback + `/api/*` proxy to studio-server
- ❌ `.env.example` documenting all required compose env vars

---

### Phase D-rest + Phase E-rest — Remaining critical path 🔴

**Effort to close MVP:** ~1 session (test-detail page + finish docker-compose for portable self-host).

---

## 4. Pending — Production Polish 🟡

| Phase | What | Effort |
|---|---|---|
| F | **File Upload + Parser** — CSV/Excel → AI batch test generation | 1.5 |
| G | **Studio Authentication (Keycloak)** — JWT middleware, auth guard, `created_by` from token | 1 |
| H | **AI Debug Loop** — failed run → "Debug with AI" → chat with run logs as context | 1 |
| I | **Inline AI panel in Edit page** — side drawer (keeps editor visible) | 0.5 |
| J | **Versioning UI** — timeline, diff viewer, rollback to previous version | 1 |
| K | **Library filters / search / tags** — multi-select, bulk run, archive, search | 0.5 |

---

## 5. Future Scope 🔵

| Phase | What |
|---|---|
| L | Extract as `@yourname/test-studio-kit` npm package |
| M | `create-test-studio-app` CLI for new projects |
| N | Multi-user collaboration (live presence + concurrent edits) |
| O | CI/CD hooks (GitHub Actions / Bitbucket Pipelines) |

---

## 6. Known Issues / Quirks

| Issue | Workaround |
|---|---|
| TypeScript 6 breaks Cypress ts-node | Pinned `typescript@5.6.3` |
| Node 23 engine warning | Non-blocking, upgrade to 24 LTS later |
| `tsx watch` does NOT restart on `.env` change | Manually kill + restart backend after editing `.env` |
| Anthropic credits at $0 | Switch model picker to a `gpt-*` choice — OpenAI key works independently |
| Lucide icons render at default 24px ignoring Tailwind `h-/w-` classes on parent | Global CSS in `styles.css` makes inner SVG fill the parent box |
| Active run SSE stream dies on server restart | Runs still persist in DB; SSE replay available via `GET /runs/:id/logs` |

---

## 7. Effort Summary

| Goal | Sessions remaining |
|---|---|
| **MVP usable by 1 tester** | ~0.5 session (Phase D test-detail page) |
| **Self-host via Docker Compose** | +0.5 session (Phase E completion: ui Dockerfile + postgres/minio/nginx services) |
| **Production-ready for QA team** | +4.5 sessions (Phases F–K) |
| **Portable kit + ecosystem** | +3 sessions (Phases L–O) |
| **Total to "complete"** | **~8.5 sessions** from here |

---

## 8. Quickstart — How to resume

```bash
# all-in-one
cd /Users/arungounder/Documents/GitHub/test-studio
npm run studio                 # runs server + ui concurrently

# individual
cd studio-server && npm run dev    # backend on :3001
cd studio-ui    && npm start       # ui on :4300

# direct cypress (no UI)
npm run cy:open
npm run cy:run
```

URLs:
- Studio UI → http://localhost:4300
- Backend health → http://localhost:3001/api/test-studio/health
- Library API → http://localhost:3001/api/test-studio/library

---

## 9. Open Questions before next phase

| Topic | Question |
|---|---|
| SQLite migration | Drop existing in-memory data on first run, or attempt to recover from manifest.json? |
| Run history retention | Keep all runs forever vs prune older than 30 days? |
| Studio Keycloak realm | Same realm as target app (different client) or separate Studio realm? |
| Upload file types | CSV + Excel only, or also DOCX/Markdown? |
| Detail page navigation | Click on test name (not action button) opens detail — confirm UX? |

Resolve at start of each phase.

---

## 10. Decision Log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-08 | Sibling folder `test-studio/` (originally `novamark-automation/`, renamed 2026-05-09 to reflect that the kit is project-agnostic), not a subdirectory of novamark-fe | Application untouched, portable to future projects |
| 2026-05-08 | Studio's auth is INDEPENDENT of target app's auth | Kit must work with any auth (Firebase / JWT / etc.) |
| 2026-05-08 | BDD/Gherkin + Cucumber preprocessor (not raw Cypress code) | AI reliability ↑↑, reusable steps, tester-readable |
| 2026-05-08 | Local FS storage now, MinIO swap-in via Storage interface for Phase 16+ | Avoid premature infra |
| 2026-05-08 | npm (not bun) for new folders | Cypress + bun has known compat issues |
| 2026-05-08 | TypeScript 5.6.3 pinned | Cypress's ts-node breaks on TS 6 |
| 2026-05-08 | All 6 flow improvements committed | Tester UX must be smooth |
| 2026-05-08 | In-memory stores for Phase 1, SQLite for Phase 5 | Faster initial iteration |
| 2026-05-08 | Sonnet 4.6 default, Opus 4.7 for hard cases | Cost vs. capability balance |
| 2026-05-09 | Smart baseUrl detection (only set when spec uses `/...`) | Cypress pre-verifies baseUrl on startup; absolute-URL specs shouldn't be blocked |
| 2026-05-09 | Edit page uses styled textarea, not Monaco | Lighter; Monaco can be added later if line-by-line autocomplete needed |
| 2026-05-09 | "Refine with AI" navigates to chat (not in-edit drawer) | Reuses existing chat UI for first iteration; drawer later in Phase 10 |
| 2026-05-09 | Headed mode is per-run (URL flag), not a global setting | Tester can choose mode each time |
| 2026-05-09 | Video served via manual ReadStream + Range header | Express 5 `sendFile` blocks dotfile paths; gives proper seeking |
| 2026-05-09 | **Multi-provider AI** — Anthropic + OpenAI behind a `AIProvider` interface, routed by model-name prefix (`claude-*` → Anthropic, `gpt-*` / `o*` → OpenAI). Per-message model picker in chat UI, persisted to `localStorage`. New `GET /models` endpoint reports availability based on which API keys are set. Default model now `gpt-4o-mini`. | Anthropic credits at $0; user has only OpenAI key. Provider abstraction keeps Claude code intact — switch back is a `.env` change. |
| 2026-05-09 | **Refine→Save overwrites the original .feature file** instead of creating a new uniqued path. ConversationStore tracks `originatingTestId` (set by `/refine-conversation` route); `/tests/save` reads it and passes `overwriteFilePath` to `testWriter`. Response includes `updatedExisting: true`. UI shows "Confirm & Update" + "Updated → path" toast in refine mode. | Previous behaviour created `xxx-2.feature` for every refine save — confusing and wasteful. Refine flow is meant to mutate the existing test, not fork it. |
| 2026-05-09 | In refine mode, **"Start over" button replaced with "Back to Edit"** (navigates to `/edit/:id`). | "Start over" cleared the seeded chat with the existing feature content — destructive in a refine context. Back-to-edit is the natural exit. |
| 2026-05-09 | **Removed Angular Material entirely; switched UI to Tailwind CSS 4 + lucide-angular icons** with a zinc + indigo light theme. New `ToastService`/`ToastHostComponent` replaces `MatSnackBar`. `@angular/cdk/dialog` replaces `MatDialog`. All page templates and stylesheets inlined into their `.ts` files (no `.html` / `.scss` per page). Inter font, JetBrains Mono for code. | Wanted a modern minimal aesthetic; Material's defaults felt heavy and styling against them was painful. Tailwind utilities + small CDK primitives = much lower visual surface area to maintain. Bundle dropped from ~2 MB to ~1.56 MB initial. |
| 2026-05-10 | **Phase B — MinIO/Object Storage:** `Storage` interface with `MinioStorage` (S3-compatible) + `LocalFsStorage` (dev fallback) impls; selected by `STORAGE_DRIVER`. Run artifacts (video, screenshots, cucumber report) auto-upload after `child.on('close')` via `setImmediate` so SSE `finish` is not delayed. DB row per artifact in `run_artifacts`; local copies deleted (toggleable). Legacy `/runs/:id/video` and `/screenshots/*` 302-redirect to presigned URLs (zero UI churn); new typed `/runs/:id/artifacts` endpoint for future Phase D detail page. Single bucket `test-studio` with prefixes (matches plan §6). | Multi-instance + restart-safe playback; UI stays unchanged via redirects. Local fallback lets contributors run without Docker. Best-effort upload (don't fail run on storage error) chosen over strict consistency for MVP. |
