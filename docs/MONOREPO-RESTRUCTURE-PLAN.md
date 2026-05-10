# Monorepo Restructure — Backend / Frontend Split

> Reorganize the repo so `studio-server/` and `studio-ui/` are **independently deployable units**, with all backend-related files (Cypress, config, runtime caches) consolidated under `studio-server/`. Root becomes minimal — just two deploy targets + a thin dev-orchestration script.
>
> **Created:** 2026-05-10
> **Status:** Awaiting approval before execution
> **Estimated effort:** 30–45 min focused refactor + smoke test cycle

---

## 1. Goal

Today the repo has Cypress files, configs, and runtime caches scattered at root level — they look like orphans and don't logically belong with either deployable unit. After this restructure:

- **`studio-server/`** is a self-contained backend: `cd studio-server && docker build .` produces a working image with Cypress baked in.
- **`studio-ui/`** stays self-contained as today (Angular static build → nginx).
- **Root** has only the two deploy folders + docs + a slim `package.json` for `npm run studio` dev convenience.
- Path imports inside the backend resolve to `studio-server/` itself — no more `process.env.PROJECT_ROOT` hopping out of the package.

---

## 2. Current vs target layout

### Before (today)
```
test-studio/
├── cypress/                         ← orphan — owned by backend really
│   ├── e2e/features/*.feature
│   └── support/{commands.ts, e2e.ts, step_definitions/, pages/}
├── cypress.config.ts                ← orphan
├── config/                          ← orphan
│   ├── auth.adapter.ts
│   ├── routes.json
│   ├── selectors.json
│   └── studio.config.json
├── .workspace/                      ← runtime cache (per-project subdirs)
├── .test-studio/                    ← runtime scratch (videos, screenshots, last-run.json)
├── package.json                     ← has Cypress deps + monorepo scripts (mixed concerns)
├── package-lock.json
├── tsconfig.json                    ← only for cypress/ + config/ at root
├── studio-server/                   ← deployable backend
├── studio-ui/                       ← deployable frontend
├── docs/
├── README.md
└── .gitignore
```

### After (target)
```
test-studio/
├── studio-server/                   ← BACKEND — independently deployable
│   ├── cypress/                        (moved from root)
│   ├── cypress.config.ts               (moved from root)
│   ├── config/                         (moved from root)
│   │   ├── auth.adapter.ts
│   │   ├── routes.json
│   │   ├── selectors.json
│   │   └── studio.config.json
│   ├── .workspace/                     (regenerates here on first run)
│   ├── .test-studio/                   (regenerates here on first run)
│   ├── src/                            (existing)
│   ├── package.json                    (absorbs Cypress deps + cy:* scripts + cucumber-preprocessor config)
│   ├── tsconfig.json                   (existing — covers src/**)
│   ├── tsconfig.cypress.json           (NEW — covers cypress/** + config/** + cypress.config.ts)
│   ├── .env / .env.example             (existing)
│   └── (Phase E) Dockerfile + .dockerignore
│
├── studio-ui/                       ← FRONTEND — already self-contained
│
├── docs/
├── README.md                        (quickstart paths updated)
├── .gitignore                       (paths updated)
└── package.json                     (slim — only `npm run studio` orchestration)
```

---

## 3. Move table (the canonical source of truth)

### Move INTO `studio-server/`

| Source (root) | Destination | Why |
|---|---|---|
| `cypress/` | `studio-server/cypress/` | Backend `cypress-runner.service.ts` spawns Cypress; UI doesn't need it |
| `cypress.config.ts` | `studio-server/cypress.config.ts` | Cypress config follows Cypress |
| `config/auth.adapter.ts` | `studio-server/config/auth.adapter.ts` | Imported by `cypress/support/commands.ts` (relative path stays valid) |
| `config/routes.json` | `studio-server/config/routes.json` | Cypress-side selectors / paths |
| `config/selectors.json` | `studio-server/config/selectors.json` | Cypress-side selectors |
| `config/studio.config.json` | `studio-server/config/studio.config.json` | Imported by `cypress.config.ts` |

### Will regenerate inside `studio-server/`

| Source | Action |
|---|---|
| `.workspace/` | Delete from root; materializer regenerates at `studio-server/.workspace/` on next run |
| `.test-studio/` | Delete from root; runner + Cypress regenerate at `studio-server/.test-studio/` on next run |

### Stays at root

| Item | Reason |
|---|---|
| `studio-server/`, `studio-ui/` | Two deploy targets |
| `docs/` | Project-wide documentation |
| `README.md` | Project-wide |
| `.gitignore` | Project-wide ignore rules |
| `package.json` (slimmed) | Dev orchestration via `npm run studio` (concurrently) |
| `package-lock.json` (slimmed) | Lock for the slim root |

### Deletes from root

| Item | Reason |
|---|---|
| `cypress/`, `cypress.config.ts`, `config/` | Moved (see above) |
| `tsconfig.json` (root) | Was only for `cypress/**` + `config/**`; both gone |
| Root `node_modules/` | After dep migration, nothing uses it except `concurrently`; can rebuild small |
| Cypress + cucumber-preprocessor + esbuild deps from root `package.json` | Moved to `studio-server/package.json` |
| `cy:open` / `cy:run` / `cy:run:headed` scripts from root | Moved to `studio-server/package.json` |
| `cypress-cucumber-preprocessor` config block from root `package.json` | Moved to `studio-server/package.json` |

---

## 4. Code changes — file by file

### 4.1 `studio-server/src/utils/paths.ts`

**Before:**
```typescript
const PROJECT_ROOT = path.resolve(__dirname, '../../', process.env.PROJECT_ROOT || '..');
```
*(Resolves from `dist/utils/paths.js` → `../../` = `studio-server/` → + `..` = repo root.)*

**After:**
```typescript
// dist/utils/paths.js → ../../ = studio-server/
const PROJECT_ROOT = path.resolve(__dirname, '../..');
```

**Impact:** All `paths.projectRoot` references in `cypress-runner.service.ts`, `workspace-materializer.service.ts`, `filesystem.service.ts`, etc. now point at `studio-server/` instead of the repo root. That's exactly what we want — Cypress + workspace + .test-studio all live inside studio-server.

### 4.2 `studio-server/.env`

Remove this line:
```
PROJECT_ROOT=..
```
*(Was used to override the path; no longer needed.)*

### 4.3 `studio-server/.env.example`

Remove the `PROJECT_ROOT` documentation block. Add a comment noting paths are now relative to studio-server itself.

### 4.4 `studio-server/cypress.config.ts` (after move — content unchanged)

Re-verified safe:
- `import studioConfig from './config/studio.config.json';` — relative path identical post-move ✅
- `specPattern: ['cypress/e2e/**/*.feature', '.workspace/**/cypress/e2e/**/*.feature']` — relative to cypress.config.ts location, which is now studio-server/ ✅
- `videosFolder: '.test-studio/runs/videos'` — relative, resolves under studio-server/ when Cypress runs from there ✅

### 4.5 `studio-server/cypress/support/commands.ts` (after move — content unchanged)

Re-verified safe:
- `import { authAdapter, TestUser } from '../../config/auth.adapter';`
- After move: `studio-server/cypress/support/commands.ts` → `../../config/auth.adapter` = `studio-server/config/auth.adapter` ✅

### 4.6 `studio-server/package.json`

**Add to `dependencies` / `devDependencies`** (moved from root):
```json
"@badeball/cypress-cucumber-preprocessor": "^24.0.1",
"@bahmutov/cypress-esbuild-preprocessor": "^2.2.8",
"cypress": "^14.5.4",
"esbuild": "^0.28.0"
```

**Add scripts:**
```json
"cy:open": "cypress open",
"cy:run": "cypress run",
"cy:run:headed": "cypress run --headed --no-exit"
```

**Add cucumber-preprocessor config block:**
```json
"cypress-cucumber-preprocessor": {
  "stepDefinitions": [
    "cypress/support/step_definitions/**/*.{ts,js}"
  ],
  "json": {
    "enabled": true,
    "output": ".test-studio/last-run.json"
  },
  "html": {
    "enabled": false
  }
}
```

**TypeScript version — IMPORTANT:**
- Root currently pins `typescript@5.6.3` (because Cypress's ts-node breaks on TS 6 — see `TEST-STUDIO-PROGRESS.md` decision log 2026-05-08)
- `studio-server` currently has `typescript@^6.0.3`
- After merge, **both Cypress and server share one TypeScript version** in studio-server's package.json
- **Choose:** downgrade studio-server to `typescript@5.6.3` (proven stable for Cypress + tsx + tsc)
- Verify: `npx tsc --noEmit` for src/ still passes; `cy:run` for cypress/ still works

### 4.7 `studio-server/tsconfig.json` (existing — no change)

Stays at:
```json
{
  "compilerOptions": { ... existing ... },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4.8 `studio-server/tsconfig.cypress.json` (NEW — adapted from root tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "types": ["cypress", "node"],
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "strict": true,
    "noImplicitAny": false,
    "skipLibCheck": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "cypress/**/*.ts",
    "config/**/*.ts",
    "cypress.config.ts"
  ],
  "exclude": ["node_modules", "dist"]
}
```

### 4.9 Root `package.json` (slimmed)

**Before:**
```json
{
  "name": "test-studio",
  "scripts": {
    "studio": "concurrently ...",
    "studio:server": "cd studio-server && npm run dev",
    "studio:ui": "cd studio-ui && npm start",
    "cy:open": "cypress open",
    "cy:run": "cypress run",
    "cy:run:headed": "cypress run --headed --no-exit"
  },
  "cypress-cucumber-preprocessor": { ... },
  "devDependencies": {
    "@badeball/cypress-cucumber-preprocessor": "...",
    "@bahmutov/cypress-esbuild-preprocessor": "...",
    "@types/node": "...",
    "concurrently": "^9.2.1",
    "cypress": "...",
    "esbuild": "...",
    "typescript": "5.6.3"
  }
}
```

**After:**
```json
{
  "name": "test-studio-monorepo",
  "version": "0.1.0",
  "description": "Monorepo container for studio-server (backend) + studio-ui (frontend). Each is independently deployable.",
  "private": true,
  "scripts": {
    "studio": "concurrently --names \"server,ui\" --prefix-colors \"cyan,magenta\" \"npm:studio:server\" \"npm:studio:ui\"",
    "studio:server": "cd studio-server && npm run dev",
    "studio:ui": "cd studio-ui && npm start"
  },
  "devDependencies": {
    "concurrently": "^9.2.1"
  }
}
```

### 4.10 Root `tsconfig.json` — DELETE

No more files at root that need TypeScript compilation. Each sub-package owns its tsconfig.

### 4.11 `.gitignore` (root) — update paths

**Before:**
```
cypress/videos/
cypress/screenshots/
cypress/downloads/

.test-studio/runs/
.test-studio/uploads/
.test-studio/*.db
.test-studio/*.db-journal
```

**After:**
```
# Cypress runtime artifacts (now under studio-server/)
**/cypress/videos/
**/cypress/screenshots/
**/cypress/downloads/

# Test Studio runtime data (Phase A+ — under studio-server/)
**/.workspace/
**/.test-studio/runs/
**/.test-studio/uploads/
**/.test-studio/storage/
**/.test-studio/last-run.json
**/.test-studio/*.db
**/.test-studio/*.db-journal
```

The `**/` prefix makes the rules location-agnostic — works whether the dirs are at root or inside `studio-server/`.

### 4.12 `README.md` quickstart — paths refreshed

Update sections that reference root-level Cypress runs. Example:
```bash
# old
npm run cy:open
npm run cy:run

# new
cd studio-server && npm run cy:open
cd studio-server && npm run cy:run

# unchanged (root still orchestrates dev)
npm run studio
```

---

## 5. Migration steps (in order)

```
[ ] 1.  Stop dev servers (server + UI)
[ ] 2.  Snapshot: git status clean; commit current state if dirty (safety net)
[ ] 3.  Create new branch: git checkout -b restructure/monorepo-split
[ ] 4.  Delete .workspace/ and .test-studio/ at root (will regenerate)
[ ] 5.  git mv cypress/ studio-server/cypress/
[ ] 6.  git mv cypress.config.ts studio-server/cypress.config.ts
[ ] 7.  git mv config/ studio-server/config/
[ ] 8.  Delete root tsconfig.json
[ ] 9.  Update studio-server/src/utils/paths.ts (PROJECT_ROOT calc)
[ ] 10. Update studio-server/.env (remove PROJECT_ROOT line)
[ ] 11. Update studio-server/.env.example (drop PROJECT_ROOT block)
[ ] 12. Edit studio-server/package.json:
        - downgrade typescript: ^6.0.3 → 5.6.3
        - add cypress + preprocessor + esbuild deps
        - add cy:open / cy:run / cy:run:headed scripts
        - add cypress-cucumber-preprocessor config block
[ ] 13. Create studio-server/tsconfig.cypress.json
[ ] 14. Edit root package.json (slim to monorepo orchestrator)
[ ] 15. Delete root node_modules + package-lock.json; npm install (clean lock)
[ ] 16. cd studio-server && rm -rf node_modules && npm install
[ ] 17. Update .gitignore (root) with new path globs
[ ] 18. Update README.md quickstart commands
[ ] 19. Smoke test (Section 6)
[ ] 20. git status review; commit in logical chunks (move + code + config)
```

`git mv` preserves history per file — important for blame/log readability.

---

## 6. Smoke test (post-restructure)

```
[ ] Server boots cleanly: cd studio-server && npm run dev
    → Logs: "Postgres connection established", "Schema synced",
            "Storage ready (driver=minio, bucket=test-studio)",
            "studio-server listening on http://localhost:3001"
[ ] UI starts: cd studio-ui && npm start
    → http://localhost:4300 loads
[ ] Combined: npm run studio (root) starts both via concurrently
[ ] Trigger run via UI: pick "BDD pipeline smoke test" → Run headless
[ ] Verify .workspace materialized at studio-server/.workspace/<projectId>/
[ ] Verify .test-studio/runs/ scratch dir lives at studio-server/.test-studio/
[ ] Run completes → /artifacts returns presigned URLs at minio.undercontrol.in
[ ] Old run replay still works (DB rows + MinIO objects unchanged by move)
[ ] cd studio-server && npm run cy:run — headless Cypress works directly
[ ] cd studio-server && npm run cy:open — interactive Cypress works
[ ] git log studio-server/cypress/support/commands.ts — history preserved (git mv worked)
```

---

## 7. Risks & mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | `paths.projectRoot` change breaks runner cwd / video paths / last-run.json read | Section 6 smoke test catches it; revert in worst case via `git reset --hard HEAD~1` |
| 2 | TypeScript 5.6.3 downgrade in studio-server breaks something in src/ | Run `npx tsc --noEmit` after downgrade; TS 5.6.3 is recent enough for all decorators (`sequelize-typescript`) and `Object.hasOwn` etc. |
| 3 | `cy:run` from studio-server fails because cucumber-preprocessor config is read from cwd's package.json — and cwd would be studio-server now (correct) | Verify `cypress-cucumber-preprocessor` block in studio-server/package.json works (test step #6) |
| 4 | Root `package.json` slim version still has `cy:open` users somewhere | grep README + docs/ for `npm run cy:` references; update them |
| 5 | `git mv` on directories reports as "rename" only when 50%+ similarity; large reshapes might lose history | Files within unchanged content → safe. Verify with `git log --follow` on a sample file post-move. |
| 6 | Existing `.workspace/<projectId>/` cached on a developer's machine pre-move; after move they have stale workspace at root | Pre-restructure step 4 deletes both; materializer recreates inside studio-server on first run |
| 7 | Symlink-like behavior expected from import paths in cypress.config.ts that imports `./config/studio.config.json` | Verified explicitly — relative path stays valid because both move together |
| 8 | Cypress fails to find .feature files | specPattern is `cypress/e2e/**/*.feature` (relative to cypress.config.ts) — Cypress runs from studio-server cwd, so resolution is correct |
| 9 | Docker build (Phase E) accidentally copies node_modules from root | Phase E will set `WORKDIR /app` to studio-server with `.dockerignore` excluding `../node_modules` — covered in Phase E plan |
| 10 | `tsx watch` in studio-server doesn't pick up changes in cypress/ — but it shouldn't need to | `tsx watch` is server-only (`src/server.ts`); Cypress changes don't touch the watch tree |

---

## 8. Rollback strategy

If any blocker emerges mid-refactor:

```bash
# Cheap rollback (everything still in WIP branch)
git checkout main
git branch -D restructure/monorepo-split
# Project back to pre-restructure state — no further action needed
```

Because all moves are tracked via `git mv`, a `git reset --hard` from the branch tip also fully reverses everything.

---

## 9. Open questions

| # | Question | Default if unresolved |
|---|---|---|
| 1 | Keep root `package.json` for `npm run studio` orchestration, or drop it entirely so users `cd` manually? | **Keep slim** — convenience matters; concurrently's only ~5 MB |
| 2 | Should `config/auth.adapter.ts` stay TypeScript-source, or move to a JSON-driven config so it can also live in DB (`project_configs.auth_adapter`) like Phase A intended? | **Defer** — out of scope for this restructure; revisit when Phase G (auth) starts |
| 3 | Move `studio-server` and `studio-ui` to `packages/` (proper npm workspace)? | **Defer** — doesn't add value until 3rd package needed; can adopt later |
| 4 | Should we delete `cypress/e2e/features/*.feature` files since DB now has them? | **Defer** — they're a nice checked-in baseline; remove only if specPattern duplication causes issues |
| 5 | Phase E Docker plan affected? | **Phase E benefits** — restructure makes `studio-server/Dockerfile` trivial; full stack compose stays the same shape |

---

## 10. Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-10 | Backend-related files (cypress/, config/, runtime caches) consolidated under `studio-server/` | Backend is a single deployable unit; orphan-at-root layout is confusing and blocks clean Docker builds |
| 2026-05-10 | Root `package.json` slimmed to dev orchestration only (`concurrently`) | Removes mixed concerns; root deps unrelated to either deploy target |
| 2026-05-10 | TypeScript pinned to 5.6.3 in studio-server (downgrade from 6.0.3) | Cypress's ts-node breaks on TS 6; sharing one TS version across cypress + server simpler than two |
| 2026-05-10 | Separate `tsconfig.cypress.json` (DOM lib + cypress types) alongside existing `tsconfig.json` (Node-only) | Cypress browser context vs Node server context; one config can't satisfy both type-check goals |
| 2026-05-10 | `git mv` for all moves to preserve history | Blame/log continuity matters for ongoing work |
| 2026-05-10 | `.workspace/` + `.test-studio/` deleted (not moved) — they regenerate | Auto-regenerated runtime caches; moving stale data wastes effort and risks bringing along bad state |
| 2026-05-10 | Root `tsconfig.json` deleted (not moved) | Was only for cypress/ + config/ at root; both move to studio-server which gets its own cypress tsconfig |

---

## 11. Done when

- `cd studio-server && npm run dev` works end-to-end (run a test, get artifacts in MinIO)
- `cd studio-ui && npm start` works as before
- `npm run studio` from root still concurrently starts both
- `git status` clean on the new branch (no untracked moved files)
- `git log --follow studio-server/cypress/support/commands.ts` shows pre-move history
- README quickstart updated and accurate
- No path imports broken; `npx tsc --noEmit` passes in studio-server (both src and cypress tsconfigs)
- Phase B smoke test (run → MinIO upload → /artifacts list → 302 video) still passes

---

**Doc version:** 1.0
**Status:** Awaiting approval — execution will start only on user's go-ahead.
