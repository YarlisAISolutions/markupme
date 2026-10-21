# ADR 0008: SDODS end-to-end validation in markupme-qa, vitest for units

- Status: Accepted
- Date: 2026-10-20

## Context

Unit tests prove the functions. They do not prove that the CLI's server, the playground, rendered pages and (later) the studio work for a user in a browser. The org runs end-to-end tests with SDODS (BDD feature files for UI, API and hybrid flows) and keeps them in separate `*-qa` repositories, so tests are reviewed and versioned apart from the product and can run against any environment.

## Decision

Two layers:

1. **Unit tests with vitest** in each package's `test/` folder, run by `bun run test` (turbo). On `main` (2026-10-21): core 40 tests, highlight 4, diagrams 7, themes 3, cli 18. The CLI tests run the CLI in-process (`run()` never calls `process.exit`) and start the server on port 0.
2. **End-to-end tests with SDODS** in `YarlisAISolutions/markupme-qa` (project slug `markupme`), against `markupme serve examples --port 4321`:
   - `@api` scenarios for `GET /api/health`, `POST /api/render`, `POST /api/validate`, `POST /api/stats`, including negative cases (400, 405, 413, 501).
   - `@ui` scenarios for the playground at `/__markupme/playground` and rendered pages such as `/kitchen-sink.md`; later the studio.
   - Every scenario has exactly one layer tag (`@ui`, `@api`) and one suite tag (`@smoke`, `@regression`, `@sanity`).
   - Pull requests run `@smoke` (gate: 100% pass); releases run `@smoke or @regression` with no flaky tests allowed (`sdods.project.yaml` processes).

The serve server exposes stable hooks for UI tests: `data-testid` on the playground (`markdown-input`, `render-button`, `status`, `preview`, `diagnostics`) and on the page diagnostics banner (`render-diagnostics`).

## Alternatives

| Option | Why not |
| ------ | ------- |
| Playwright tests inside this repo | Breaks the org convention and mixes product and QA review. |
| Unit tests only | Misses browser behaviour: Mermaid runtime, theme toggle, live reload, the playground. |
| Snapshot tests of whole HTML pages | Brittle; they fail on harmless changes. We assert specific fragments instead. |

## Consequences

- A change to the serve API or to a `data-testid` needs a matching change in markupme-qa.
- markupme-qa (PRs #1 and #2 merged) has five features: `Preview server health`, `Render API`, `Validate and stats API` (17 api scenarios) and `Playground`, `Rendered pages` (10 ui scenarios). All pass locally and in GitHub Actions; `sdods lint --strict` is clean. Project-specific steps live in `pages/PreviewPage.ts`.
- This repository's `ci.yml` job `e2e` runs both suites against the build of each pull request, and `scripts/qa-gate.mjs` fails a run with fewer than 15 api or 10 ui scenarios (a run that matches nothing would otherwise pass). markupme-qa's own `e2e.yml` also runs them nightly.
- Studio scenarios come with PR#2; VS Code and React are covered by their own tests in PR#3.
- Agents propose SDODS scenarios; a person accepts them (`sdods proposals accept <id>`).
