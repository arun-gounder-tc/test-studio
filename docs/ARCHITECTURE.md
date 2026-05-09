# Test Studio — Runtime Architecture (Quick Reference)

> One-page mental model. **Plan.md = blueprint. Progress.md = roadmap. This file = how the running system actually works.**

---

## 1. Three processes, three ports

```
┌─────────────────────────────┐    ┌─────────────────────────────┐    ┌─────────────────────────────┐
│   STUDIO UI   (Angular)     │    │   STUDIO SERVER  (Express)  │    │   CYPRESS  (child process)   │
│   port 4300                 │◀──▶│   port 3001                 │◀──▶│   spawned per run           │
│   Tailwind 4 + lucide       │    │   tsx watch                 │    │   npx cypress run [--headed]│
└─────────────────────────────┘    └─────────────────────────────┘    └─────────────────────────────┘
        │                                  │                                  │
        │                                  │                                  ▼
        │                                  │                         writes ↓ reads ↑
        │                                  │                         ┌─────────────────────┐
        │                                  └────── reads ────────────│   FILE SYSTEM       │
        │                                          writes            │  cypress/e2e/...    │
        └──────── HTTP / SSE ──────── (cross-origin, CORS allowed)   │  .test-studio/...   │
                                                                     └─────────────────────┘
                                          │
                                          ▼
                              ┌──────────────────────────┐
                              │  AI providers (HTTPS)    │
                              │  • Anthropic SDK (Claude)│
                              │  • OpenAI SDK (GPT)      │
                              │  picked per-request by   │
                              │  model name prefix       │
                              └──────────────────────────┘
```

Start everything with **`npm run studio`** at the repo root (orchestrates both via `concurrently`).

---

## 2. Communication channels

| From → To | Channel | Purpose |
|---|---|---|
| UI → Server | `fetch` / Angular `HttpClient` | All commands & data |
| UI ← Server | JSON responses | Lists, content, save results, model catalog |
| UI ← Server | **Server-Sent Events** (`/runs/:id/stream`) | Live Cypress logs + scenario events |
| Server → AI provider | HTTPS — Anthropic SDK **or** OpenAI SDK | Generate test from chat (provider picked per-request by model name) |
| Server → Cypress | `child_process.spawn` (stdin/stdout) | Run tests |
| Server ↔ FS | `fs.readFile`, `fs.writeFile`, `fs.createReadStream` | `.feature` files, screenshots, video, `.test-studio/last-run.json` |
| Cypress → FS | Cypress writes to disk | `.feature` reads, screenshots/videos to `.test-studio/runs/` |
| Cypress → Server | stdout pipe | Live progress lines parsed by runner |

There is **no direct UI ↔ Cypress** path. Server is the broker.

---

## 3. Service catalogue (1-line each)

### `studio-server/src/services/`
- **`ai.service.ts`** — Thin facade. Reads `model` from request (or `DEFAULT_MODEL` env), routes to the right `AIProvider`, returns `{ featureContent, newSteps, fixtures, explanation, modelUsed, providerUsed }`.
- **`ai-providers/`** — Multi-provider abstraction:
  - `provider.interface.ts` — `AIProvider` contract + shared `generateTest` tool schema.
  - `anthropic.provider.ts` — Claude SDK with `cache_control: ephemeral` on system + project context.
  - `openai.provider.ts` — OpenAI SDK with native function calling; relies on OpenAI's automatic prompt caching (no manual cache_control).
  - `models.catalog.ts` — list of supported models + `providerForModel(name)` helper.
  - `index.ts` — singleton providers + `getProviderForModel()`, `listModels()`, `anyProviderConfigured()`.
- **`project-context.service.ts`** — Reads `config/routes.json`, `selectors.json`, scans existing step patterns. Feeds AI as context.
- **`conversation.store.ts`** — In-memory `Map` of `{ id → messages[] }`. Now also tracks `originatingTestId` so refine-saves overwrite the original file. (Phase 5 → SQLite.)
- **`gherkin-validator.service.ts`** — Regex-based syntax + structure check. Returns `{ ok, errors, warnings, scenarioCount }`.
- **`test-writer.service.ts`** — Slugifies name, finds unique path, writes `.feature` + step defs + fixtures with safe-path checks. `overwriteFilePath` option skips slug+unique logic and writes back to an existing file (used by refine flow).
- **`filesystem.service.ts`** — Lists `.feature` files in `cypress/e2e/features/`, parses each (Feature: / Scenario: / @tags) → metadata.
- **`cypress-runner.service.ts`** — `EventEmitter`-based. Spawns Cypress, parses stdout for live `✓` events, reads `.test-studio/last-run.json` after exit for accurate scenario list. Emits to subscribers (SSE clients).

### `studio-ui/src/app/services/`
- **`library.service.ts`** — Library list, content fetch, edit (`PUT`), refine-conversation start.
- **`chat.service.ts`** — Start conversation, send message (with optional `model` override), fetch existing conversation, save test (response includes `updatedExisting` boolean for the refine flow).
- **`models.service.ts`** — Fetch `/models` catalog, persist user's selection in `localStorage` (`studio.selectedModel`).
- **`runs.service.ts`** — Start run, fetch run record, **subscribe to SSE stream**, build screenshot/video URLs.

### `studio-ui/src/app/shared/`
- **`toast/toast.service.ts`** — Signal-backed stack of toasts; `open()` returns a `ToastRef` with `dismiss()` and `onAction()` (RxJS `Subject`). Replaces `MatSnackBar`.
- **`toast/toast-host.component.ts`** — Renders the toast stack at root (mounted once from `app.component`). Tailwind-styled, lucide icons.

---

## 4. Data flow — the 5 user actions

### A. Open Library
```
User clicks /library
  → LibraryPage.ngOnInit
  → libraryService.list()                → GET  /api/test-studio/library
                                           Server: filesystemService.listFeatureFiles()
                                                   (scans cypress/e2e/features/)
  ← JSON { tests: [ {id, name, scenarios, tags, ...} ] }
  → tests signal updated → grid renders cards
```

### B. Preview a test
```
User clicks "Preview"
  → MatDialog opens PreviewDialogComponent
  → libraryService.content(id)            → GET  /api/test-studio/library/:id/content
                                            Server: fs.readFileSync(.feature)
  ← { content }
  → highlighted() pipe colorizes Gherkin keywords/tags/strings
```

### C. Run a test (with live logs)
```
User clicks "Run" (split: headless or headed)
  → router.navigate('/run/:testId', queryParams { headed: 0|1 })
  → RunnerPage.ngOnInit reads testId + headed flag
  → runsService.start(testId, { headed }) → POST /api/test-studio/runs   { testId, headed }
                                            Server: runnerService.start({...})
                                                    - resolves spec path
                                                    - smart baseUrl detection (regex on .feature)
                                                    - spawn('npx', ['cypress', 'run', '--spec', ..., '--headed'?])
                                                    - returns runId immediately
  ← { runId, startedAt, ... }
  → runsService.stream(runId, handlers)   → GET  /api/test-studio/runs/:id/stream  (SSE)
                                            Server: subscribes EventEmitter on `run:<id>`
                                                    flushes existing events, then live ones
  ← event: log    data: {stream, line}     → logs signal updated → live <pre> scrolls
  ← event: scenario data: {name, status}   → scenarios signal updated → side panel
  ← event: finish data: {exitCode, ...}    → status signal updated, video/screenshots fetched
  ← event: end                              → EventSource closed
  
  Meanwhile in cypress-runner.service.ts:
    - stdout.on('data') → split by \n → processLine()
      → ✓ pattern → record.scenarios.push({ status: 'pass' }) + emit 'scenario'
    - on('close') → read .test-studio/last-run.json (cucumber JSON report)
                    → REPLACE record.scenarios with accurate data (handles failures correctly)
                    → check for video/screenshot files → emit 'finish'
```

### D. Chat with Claude (new test)
```
User opens /new
  → CaseChatPage.ngOnInit
  → chatService.startConversation()       → POST /api/test-studio/conversations
                                            Server: conversationStore.create() → returns { id }
  ← { id, aiConfigured }
  
User types message + sends (with selected model from picker)
  → chatService.sendMessage(id, text, model)
                                          → POST /api/test-studio/conversations/:id/messages
                                            body: { content, model }
                                            Server:
                                              1. conversationStore.appendUser
                                              2. aiService.generate(history, text, model):
                                                 - getProviderForModel(model) → Anthropic | OpenAI
                                                 - load project context
                                                 - provider.generate({ ... }) — tool-forced output
                                                 - parse generateTest payload (object for Anthropic,
                                                   JSON string for OpenAI)
                                              3. gherkinValidator.validate(featureContent)
                                              4. conversationStore.appendAssistant(explanation, generation)
  ← { userMessage, assistantMessage, generation, validation }
       generation includes modelUsed + providerUsed
  → messages signal append both
  → latestGeneration signal set → preview panel renders code + chips
  
User clicks "Confirm & Save"  (label is "Confirm & Update" if refining)
  → chatService.saveTest(conversationId)  → POST /api/test-studio/tests/save
                                            Server:
                                              1. fetch conversation.latestGeneration
                                              2. read conv.originatingTestId — if set, look up
                                                 the existing test and pass overwriteFilePath
                                              3. validate Gherkin again
                                              4. testWriter.save({...}) → writes .feature, step defs,
                                                 fixtures (overwrites in refine flow, slugs+uniques otherwise)
  ← { success, testId, featurePath, updatedExisting }
  → toast service shows "Updated → path" or "Saved → path"
  → tester goes to /library to see card (same id when updated)
```

### E. Edit existing test (with optional AI refine)
```
User clicks "Edit" on Library card
  → router.navigate('/edit/:testId')
  → EditPage.ngOnInit
  → libraryService.content(id) → fills `originalContent` and `content` signals
  
Tester edits in textarea
  → ngModelChange → content signal updated
  → dirty computed → orange dot + "Save & Run" label
  → validation computed → chips re-render live
  
Click Save
  → libraryService.update(id, content)    → PUT  /api/test-studio/tests/:id
                                            Server:
                                              1. validate Gherkin
                                              2. fs.writeFileSync(test.filePath, content)
  ← { success }
  → originalContent set to current → dirty becomes false → toast
  
Click "Refine with AI"
  → libraryService.startRefineConversation(id) → POST /api/test-studio/tests/:id/refine-conversation
                                                  Server:
                                                    1. read .feature content
                                                    2. conversationStore.create()
                                                    3. conversationStore.setOriginatingTestId(conv.id, test.id)
                                                       ← so /tests/save knows to OVERWRITE later
                                                    4. seed user message: "Here is the current test: ..."
                                                    5. seed assistant ack
  ← { conversationId, testId, testName, currentContent }
  → router.navigate('/new', queryParams { conversationId, refineTestId })
  → CaseChatPage detects ?conversationId + ?refineTestId
       - shows orange "refining existing" badge
       - replaces "Start over" with "Back to Edit" (avoids destroying seeded chat)
       - save button label: "Confirm & Update" (icon: refresh-ccw)
       - calls fetchConversation, displays seeded history
  → Tester chats refinements, AI returns updated .feature
  → Save → POST /tests/save → backend reads originatingTestId → overwrites the original file
```

---

## 5. State / signals — where things live

### Backend (in-memory, per-process)
- `conversationStore` — `Map<id, ConversationRecord>`. Each record now also carries `originatingTestId?` (set by the refine route, read by `/tests/save`). Lost on restart. (→ SQLite Phase 5)
- `runnerService.runs` — `Map<id, RunRecord>`. Lost on restart.
- `runnerService.processes` — `Map<id, ChildProcess>`. Active spawned cypress procs.
- `runnerService` extends `EventEmitter` — uses `'run:<id>'` channels for SSE pub-sub.
- AI providers — both `AnthropicProvider` and `OpenAIProvider` are constructed once at module load; each holds its own SDK client (or `null` if its env key is missing).

### Frontend (Angular signals, per-page)
Each component holds its own state via `signal()` — no global store. Examples:

```typescript
// LibraryPage
loading = signal(true)
tests   = signal<TestSummary[]>([])
total   = signal(0)
error   = signal<string | null>(null)

// CaseChatPage
conversationId   = signal<string | null>(null)
refineTestId     = signal<string | null>(null)   // set when ?refineTestId=… present
isRefining       = computed(() => !!refineTestId())
messages         = signal<DisplayMessage[]>([])
latestGeneration = signal<Generation | null>(null)
models           = signal<ModelEntry[]>([])      // from /models
selectedModel    = signal<string>('')             // persisted to localStorage
canSave = computed(() => !!latestGeneration() && validation()?.ok)

// EditPage
originalContent = signal('')
content         = signal('')
dirty           = computed(() => content() !== originalContent())
validation      = computed(() => validateGherkin(content()))

// RunnerPage
status     = signal<RunStatus>('running')
logs       = signal<LogLine[]>([])
scenarios  = signal<ScenarioOutcome[]>([])
headed     = signal(false)
```

Signals → automatic UI updates via Angular's reactivity. Lazy chunks reload on hot module replacement.

### File system (persistent across restarts)
- `cypress/e2e/features/*.feature` — source of truth for tests
- `cypress/support/step_definitions/*.ts` — reusable step library
- `config/*.json|ts` — per-project config (routes, selectors, auth adapter)
- `.test-studio/last-run.json` — Cucumber JSON report (read by runner after each cypress exit)
- `.test-studio/runs/videos/*.mp4` — Cypress-recorded videos
- `.test-studio/runs/screenshots/<spec>/*.png` — Cypress screenshots on failure
- `.test-studio/studio.db` — (Phase 5) SQLite database file

---

## 6. The 5-minute mental model

> 1. **UI talks to Server.** Server talks to Cypress and the chosen AI provider (OpenAI or Anthropic). UI never talks to either directly.
>
> 2. **Cypress writes files.** Server reads them. Server-side state is in-memory.
>
> 3. **For chat:** UI → conversation message + `model` → Server picks provider by model-name prefix → returns generated `.feature` → UI shows preview → user confirms → Server writes file. If the conversation was seeded by "Refine with AI", the save **overwrites the original** instead of creating a new file.
>
> 4. **For run:** UI → POST `/runs` → Server `spawn(cypress)` → stdout parsed → events emitted → SSE delivers them to UI. After exit, server reads `last-run.json` for accuracy.
>
> 5. **For edit:** UI fetches `.feature` content → user edits in textarea → PUT writes back. "Refine with AI" creates a chat conversation seeded with current code, then redirects to chat page (with `refineTestId` query param so the chat knows it's a refine).

---

## 7. Where to look when something breaks

| Symptom | First place to check |
|---|---|
| Library shows nothing | `studio-server` logs — is FS scan finding `cypress/e2e/features/`? |
| Chat returns "AI offline" | At least ONE of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` must be set in `.env`. Did you restart the server after editing `.env`? |
| Chat returns 502 | Provider credit balance, rate limit, or network. Hit `/health` and `/models` to see which providers report `available: true`. |
| Model dropdown shows "key missing" | The corresponding env var is empty. Add it to `studio-server/.env` and restart. |
| Refine save creates a `xxx-2.feature` (regression) | Conversation lost its `originatingTestId` (e.g. backend was restarted between refine-start and save). Re-open Edit → Refine. Long-term fix is SQLite (Phase 5). |
| Run fails on baseUrl | Does spec use relative paths? Is target app running on baseUrl? |
| Run shows no scenarios | Cucumber JSON report missing? Check `.test-studio/last-run.json` exists |
| Video shows "0:00" | Check `Range` header support; check file is valid MP4 (`file *.mp4`) |
| Screenshot 404 | Check absolute URL in response; dotfile path issue |
| HMR not picking changes | UI: hard refresh. Backend: kill+restart (tsx doesn't watch `.env`) |

---

## 8. File map for "where do I add X"

| I want to… | Edit |
|---|---|
| Add a new API endpoint | `studio-server/src/routes/<x>.routes.ts` + register in `server.ts` |
| Add a new business rule | `studio-server/src/services/` |
| Add a new UI page | `studio-ui/src/app/pages/<x>/<x>.page.ts` (inline template) + route in `app.routes.ts` |
| Change AI prompt | `studio-server/src/prompts/system.prompt.ts` |
| Add a new AI provider (e.g. Gemini) | New `<vendor>.provider.ts` in `studio-server/src/services/ai-providers/`, register in `index.ts`, extend `providerForModel()` heuristic in `models.catalog.ts` |
| Add / remove a model from the picker | `studio-server/src/services/ai-providers/models.catalog.ts` (`MODEL_CATALOG`) |
| Tweak project context fed to AI | `studio-server/src/services/project-context.service.ts` |
| Show a toast | Inject `ToastService` from `studio-ui/src/app/shared/toast/` and call `success/error/info/open(...)` |
| Open a dialog | Inject `Dialog` from `@angular/cdk/dialog` and pass `panelClass: 'studio-dialog-panel'` |
| Use an icon | Import from `lucide-angular` and use `<i-lucide [img]="MyIcon" class="h-4 w-4">` |
| Tweak global theme tokens | `studio-ui/src/styles.css` (`@theme` block) |
| Add new BDD step | `cypress/support/step_definitions/<group>.steps.ts` |
| Change selector hints for AI | `config/selectors.json` |
| Change target app URL | `config/studio.config.json` |
| Change auth strategy for tests | `config/auth.adapter.ts` (target-app auth, not Studio) |