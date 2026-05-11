# NovaMark Automation Suite

Cypress + BDD foundation **plus** an AI Test Studio (Express backend + Angular UI) for authoring, editing, and running tests via natural-language chat.

This folder is **completely separate** from the application repo (`novamark-fe`). The app stays untouched.

---

## What's working

**Cypress + BDD (Phase 1)**
- ✅ Cypress 14 with Cucumber/Gherkin preprocessor + esbuild
- ✅ TypeScript 5.6, Page Object Model, reusable steps
- ✅ `cy.loginAs(role)` custom command driven by `config/auth.adapter.ts`

**Test Studio (Phases 2–4 + Edit + multi-provider AI + Tailwind UI)**
- ✅ Express backend on `:3001` — chat, save, library, edit, refine, run
- ✅ Angular 19 + **Tailwind CSS 4** + lucide icons UI on `:4300`
- ✅ **Multi-provider AI** — picks OpenAI or Anthropic per request based on the model the tester selects in the dropdown (`gpt-*` / `o*` → OpenAI, `claude-*` → Anthropic)
- ✅ Refine flow: "Refine with AI" on Library/Edit → chat seeded with current `.feature` → Save **overwrites the original file** (no `-2.feature` copies)
- ✅ Live Cypress runs with SSE log stream, video, and screenshots
- ✅ Headless or headed runs (per-run choice, persisted in URL)

Phase 5+ (SQLite, file upload, Studio auth, history page) — pending.

---

## Quickstart

```bash
# install (root + studio-server + studio-ui)
npm install
(cd studio-server && npm install)
(cd studio-ui     && npm install)

# add at least one AI key
cp studio-server/.env.example studio-server/.env
# then edit it: set ANTHROPIC_API_KEY and/or OPENAI_API_KEY

# run the full studio (server + UI together)
npm run studio
# UI: http://localhost:4300
# Backend health: http://localhost:3001/api/test-studio/health
# Available models: http://localhost:3001/api/test-studio/models

# OR run just Cypress directly (no UI) — now lives inside studio-server/
cd studio-server && npm run cy:run                     # all feature specs, headless
cd studio-server && npm run cy:open                    # interactive
cd studio-server && CY_USE_BASE_URL=1 npm run cy:run   # with target app on :4200
```

---

## Folder layout

```
test-studio/
├── cypress/
│   ├── e2e/features/          ← .feature files (Gherkin)
│   ├── support/
│   │   ├── step_definitions/  ← reusable BDD steps
│   │   ├── pages/             ← Page Object Model
│   │   ├── commands.ts        ← cy.loginAs, etc.
│   │   └── e2e.ts
│   └── fixtures/              ← test data
├── config/
│   ├── studio.config.json     ← target app URL, ports, paths
│   ├── routes.json            ← page routes (AI context)
│   ├── selectors.json         ← key selectors (AI context)
│   └── auth.adapter.ts        ← HOW Cypress logs into the target app
├── .test-studio/              ← runtime data (gitignored)
│   └── runs/                  ← videos, screenshots, logs
├── cypress.config.ts
├── tsconfig.json
└── package.json
```

---

## Auth model (important)

This kit's authentication has **two independent layers**:

1. **Test Studio** (Phase 2+) — testers log into the Studio UI via Keycloak. This is fixed across all projects.
2. **Target app** (this Phase 1 layer) — Cypress logs into whatever auth the app uses (Keycloak / Firebase / JWT / form / none) via `config/auth.adapter.ts`.

Tester never logs into the target app — Cypress does, using credentials defined in `auth.adapter.ts` and env vars (e.g., `CY_ADMIN_PASSWORD`).

---

## Writing a new test (Phase 1, manual)

### 1. Pick or add a step in `cypress/support/step_definitions/*.ts`
Reuse existing steps when possible.

### 2. Write a `.feature` in `cypress/e2e/features/`

```gherkin
Feature: Admin login
  @auth @smoke
  Scenario: Admin lands on dashboard
    Given I am logged in as "admin"
    When I navigate to "/dashboard"
    Then I should see "Welcome"
    And there should be 5 "[data-cy=metric-card]"
```

### 3. Run it

```bash
cd studio-server && CY_USE_BASE_URL=1 npm run cy:run -- --spec cypress/e2e/features/admin-login.feature
```

---

## Deployment

The repo is two independently-deployable units:

### Backend → Coolify (Docker)

`studio-server/Dockerfile` produces a self-contained image with Node, Cypress,
Chromium dependencies, and `xvfb` baked in. Coolify auto-detects the Dockerfile
when you point it at this repo (with `studio-server/` as the build context).

**Required env vars on Coolify** (paste from your local `studio-server/.env`):

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=postgres://...
MINIO_ENDPOINT=https://minio.undercontrol.in
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=test-studio
STORAGE_DRIVER=minio
STUDIO_UI_ORIGIN=https://<your-firebase-app>.web.app
DEFAULT_MODEL=gpt-4o-mini
NODE_ENV=production
```

`STUDIO_UI_ORIGIN` is the **frontend's public URL** (Firebase hosting URL).
CORS only allows that origin + localhost.

**Verify locally before pushing** (optional):
```bash
docker compose --env-file studio-server/.env up --build
curl http://localhost:3001/api/test-studio/health   # → {"ok":true,...}
```

### Frontend → Firebase Hosting

1. Set the backend URL once Coolify gives you the public domain — edit
   `studio-ui/src/environments/environment.prod.ts` and replace
   `<COOLIFY_BACKEND_URL>` with the actual host (no trailing slash, keep
   the `/api/test-studio` suffix).

2. Set the Firebase project ID — edit `studio-ui/.firebaserc` and replace
   `<YOUR_FIREBASE_PROJECT_ID>`.

3. Build + deploy:
   ```bash
   cd studio-ui
   npm run build                # writes dist/studio-ui/browser/
   npx firebase login           # one-time
   npx firebase deploy --only hosting
   ```

   Firebase prints the live URL. Paste that URL into the backend's
   `STUDIO_UI_ORIGIN` env on Coolify, then redeploy the backend so CORS allows it.

### Post-deploy smoke test

- Open the Firebase URL — UI loads
- Create a test in chat → save → run
- Verify: video + screenshots appear from MinIO, history page replays old runs

---

## Roadmap

| Phase | Status | Deliverable |
|---|---|---|
| 1 | ✅ done | Cypress + BDD foundation |
| 2 | ✅ done | Backend AI service (Express + multi-provider AI) |
| 3 | ✅ done | Test Studio Angular UI (Tailwind + lucide) |
| 4 | ✅ done | Live runner with SSE log streaming + video/screenshots |
| — | ✅ done | Edit page + Refine-with-AI (overwrites original) + per-message model picker |
| 5 | next | SQLite persistence (replace in-memory stores) |
| 6 | next | CSV/Excel upload + batch save |
| 7 | next | Studio auth (Keycloak) |
| 8 | next | Test detail / version history page |
| 14 | future | Extract as portable kit (`@yourname/test-studio-kit`) |

See `docs/TEST-STUDIO-PLAN.md`, `docs/TEST-STUDIO-PROGRESS.md`, and `docs/ARCHITECTURE.md` for the full picture.

---

## Notes

- Node v23 shows an engine warning from Cypress (it wants 20/22/24). Non-blocking. Upgrade to 24 LTS when convenient.
- TypeScript pinned at 5.6.3 — TS 6.x conflicts with Cypress's bundled `ts-node`.
- `tsx watch` does NOT pick up `.env` changes — restart `studio-server` after editing `.env`.
- Switching the chat model in the UI is free (no restart) — picker remembers last choice in `localStorage`.
mujhe is appliction me database add krna hai (postgres)
  ab me batata hu mujhe kya chahiye
  
  agar abhi current app dekho tho isme features hai jo mujhe dikhte hai me unko run kr sakta hu, edit kr sakta hu with using openai ya claude aur mujhe sabh dikhta 
  hi but ye sabh locally ho rha hai mujhe isko ek proper application banakr deploy krna hai
  
  aur ap dekhoge tho kuch structure nahi hai is application me...me batat hu mujhe kuch new features chahiye is app me
  
  1. user multiple projects create kr sakta hai(jese software development me project ka nam hota hai aur kuch detais hote hai - CRUD)
  2. Project ke features (tests) hote hai
  3. logs maintain krna hai konse project ka konsa test ka kya log hai vo gail hua tha, pass hua tha, etc
  4. Test runs ke logs with image / video url artifacts maintain hoe chahiye database me (logs)
  5. minIO bucket use krna hai for media storage
  6. chat jab krta hu me LLM ke sath tab image attach krne ka bhi feature chahiye
  
  
  
  as a user mujhe project dikhta hai me uske undar kithne scripts / features / tests hai dekh sakta hu, unme se kisiko bhi edit/preview/run(headed / headless) kr 
  sakta hu, chat krke with AI bhi edit kr sakta hu - jese abhi currently ho rha hai app me - aur jo bhi logs hai ,project hai uske related sara data database me 
  store ho rha hai parmanently aur me kabhi bhi jakr dekh sakta hu - minIO bucket se mujhe sare image / videos fetch krke dikhenge jo mujhe dekhna hai
  
  esa mujhe functionalities add krne hai current system me 
  
  iske hisab se mujhe plan batao kese kr sakte hai kya ye possible hai mujhe local dependency nikalna hai isko deployable app banana hai 