# NovaMark Automation Suite

Cypress + BDD foundation for novamark-fe (Phase 1). The AI Test Studio (Phases 2–4) will be added on top of this foundation.

This folder is **completely separate** from the application repo (`novamark-fe`). The app stays untouched.

---

## Phase 1 — what's working

- ✅ Cypress 14 with Cucumber/Gherkin (BDD) preprocessor + esbuild
- ✅ TypeScript 5.6
- ✅ Page Object Model scaffolding (`cypress/support/pages/`)
- ✅ Reusable step definitions (auth, navigation, form, verification)
- ✅ `cy.loginAs(role)` custom command driven by `config/auth.adapter.ts`
- ✅ Smoke spec passing (`cypress/e2e/features/smoke.feature`)

Phase 2+ (AI Test Studio backend, UI, runner) — not yet built.

---

## Quickstart

```bash
# install
npm install

# run all .feature specs (headless)
npm run cy:run

# open Cypress UI (interactive, headed)
npm run cy:open

# run with target app baseUrl (requires novamark-fe running on :4200)
CY_USE_BASE_URL=1 npm run cy:run
```

---

## Folder layout

```
novamark-automation/
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
CY_USE_BASE_URL=1 npm run cy:run -- --spec cypress/e2e/features/admin-login.feature
```

---

## Roadmap

| Phase | Status | Deliverable |
|---|---|---|
| 1 | ✅ done | Cypress + BDD foundation |
| 2 | next | Backend AI service (Express + Anthropic + SQLite) |
| 3 | next | Test Studio Angular UI (chat + library + runner) |
| 4 | next | Live runner with SSE log streaming |
| 5 | future | Extract as portable kit (`@yourname/test-studio-kit`) |

See `../novamark-fe/docs/TEST-STUDIO-PLAN.md` for the full plan.

---

## Notes

- Node v23 shows an engine warning from Cypress (it wants 20/22/24). Non-blocking. Upgrade to 24 LTS when convenient.
- TypeScript pinned at 5.6.3 — TS 6.x conflicts with Cypress's bundled `ts-node`.
