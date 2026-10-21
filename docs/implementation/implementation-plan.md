# Implementation plan

- Date: 2026-10-21
- Related: [PRD](../product/PRD.md) · [FRD](../product/FRD.md) · [Traceability](requirements-traceability.md) · [ADRs](../architecture/architecture-decision-records/README.md)

Work is tracked in YCadence, not in GitHub issues. Each pull request goes from a feature branch to `main`, is squash-merged, and must pass `bun run lint:check && bun run build && bun run type-check && bun run test`.

## Phase 1

### PR#1: core, CLI, serve API, SDODS suites (merged)

Merged to `main` (markupme PR #1, branch `feat/core-cli`). End-to-end suites merged in markupme-qa PRs #1 and #2.

| Deliverable | Path | State on 2026-10-21 |
| ----------- | ---- | ------------------- |
| Engine and document model | `packages/core` | Merged; 40 vitest tests |
| Syntax highlighting | `packages/highlight` | Merged; 4 tests |
| Diagram providers and SVG sanitizer | `packages/diagrams` | Merged; 7 tests |
| CSS, runtime, page wrapper | `packages/themes` | Merged; 3 tests |
| CLI: 12 commands, config, exit codes, serve API (with `lint` option), playground | `packages/cli` | Merged; 18 tests |
| Kitchen-sink example | `examples/kitchen-sink.md` | Merged |
| CI: `ci.yml` (jobs `test`, `e2e`, `gitleaks`), `security.yml`, `release.yml` | `.github/workflows/` | Merged |
| SDODS api suite (health, render, validate/stats: 17 scenarios) and ui suite (playground, rendered pages: 10 scenarios) | `YarlisAISolutions/markupme-qa` `projects/markupme/features/` | Merged; api 17/17 and ui 10/10 pass locally and in GitHub Actions; `sdods lint --strict` clean |
| Documentation set | `docs/`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `CLAUDE.md` | This change |

Follow-ups in flight (not yet on `main`):

1. `CAPABILITIES` marks the studio, the VS Code extension and React elements as `planned` with the note `in progress, Phase 1` until their pull requests merge.
2. The plugin `rehype` hook is called before sanitizing (FR-C15), with the test `runs plugin rehype hooks before sanitizing`.
3. The `TocOptions.title` doc comment says it is the TOC's `aria-label` (default "Table of contents").

### CI

| Workflow | What it does |
| -------- | ------------ |
| `ci.yml` job `test` | `bun run lint:check` (Biome CI), `build`, `type-check`, `test`; `validate examples --strict --check-diagrams`; determinism check (renders `examples` standalone, the kitchen-sink AST and a `build` twice, then `diff -r`); `npm pack --dry-run` for each package. Node 22, Bun 1.4.0. |
| `ci.yml` job `e2e` | Builds markupme, starts `markupme serve examples --port 4321`, checks out markupme-qa (`vars.QA_REF` or `main`), runs `sdods lint -p markupme --strict`, the api suite and the ui suite (Chromium), each followed by `scripts/qa-gate.mjs` with at least 15 api / 10 ui scenarios. Uploads the SDODS evidence. |
| `ci.yml` job `gitleaks` | Secret scan of the full history. |
| `security.yml` | The org security suite from YarlisAISolutions/bastion; also weekly (Mondays 06:41 UTC). |
| `release.yml` | When package versions bump, builds and tests, then publishes the `@markupme/*` packages in dependency order with npm provenance and tags them. Needs the `NPM_TOKEN` secret (SDO-48). |
| markupme-qa `e2e.yml` | The same SDODS suites from the QA repository, on its pull requests and nightly. |

### YCadence

| Key | Item |
| --- | ---- |
| SDO-50 | Epic: MarkupMe Phase 1 |
| SDO-48 | Rotate the npm token before the first publish (needed by `release.yml`) |
| SDO-49 | Create a MarkupMe project in YCadence (until then MarkupMe items live in the SDO project) |

### PR#2: web studio and SDODS UI suite

| Deliverable | Path |
| ----------- | ---- |
| Studio app: Vite + CodeMirror 6; source, split, preview modes; outline; command palette; autosave; export HTML and Markdown | `apps/studio` (branch `feat/studio`) |
| SDODS `Studio` feature (the playground and rendered-pages features already exist) | `markupme-qa` `projects/markupme/features/` |

Design: [ADR 0007](../architecture/architecture-decision-records/0007-codemirror-studio-editor.md). The studio renders with `@markupme/core` in the browser, so this PR is also the first real browser check of the core (NFR-052).

Exit criteria: AC-090 to AC-094 met; the `e2e` CI job passes with the new Studio scenarios; `CAPABILITIES` moves the studio to `built`.

### PR#3: VS Code extension and React component

| Deliverable | Path |
| ----------- | ---- |
| VS Code extension: preview webview, export HTML, insert TOC, format, diagnostics | `packages/vscode` (branch `feat/vscode`) |
| React component | `packages/react` (`@markupme/react`) |

Exit criteria: AC-095 to AC-097 met; the extension packages as a `.vsix` and installs locally. Marketplace publishing is Phase 2.

### First release (after PR#3)

1. Make sure `capabilities` matches the real state.
2. Rotate the npm token and store it as `NPM_TOKEN` (SDO-48).
3. Set every `VERSION` and `package.json` to the release version and merge to `main`; `release.yml` publishes the `@markupme/*` packages in dependency order with provenance and tags them.
4. Announce through Yarlis Relay (`release.published` is sent automatically by the org webhook).

## Phase 2

| Item | Notes | Gate |
| ---- | ----- | ---- |
| PDF output | Print the standalone page in headless Chromium (Playwright), or call Pandoc as an external program. Pandoc is GPL: call, never bundle. | `render -f pdf` stops exiting 64 only when a test renders the kitchen sink to a PDF with text, headings and diagrams. |
| DOCX output | Likely Pandoc or a DOCX writer from mdast; decide by spike. | Kitchen sink converts with headings, lists, tables, code and images; output opens in Word and LibreOffice. |
| MDX output | Compile only; never run MDX for untrusted documents. | A trust flag is required; the security tests cover MDX. |
| Rich-text editing | Milkdown or Tiptap, chosen by the RT-1 to RT-9 criteria in ADR 0007. | All criteria pass. |
| VS Code Marketplace listing | Publisher account, icon, README, licence. | Extension tests pass; manual check on Windows, macOS, Linux. |
| PNG diagram export | Through headless Chromium. | Test exports PNG for each provider. |
| Streaming parse, source maps | FR-A14, FR-B13. | Design ADR first. |

## Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| - | ---- | ---------- | ------ | ---------- |
| R1 | A sanitizer bypass ships (new HTML trick, schema change, trusted handler that forgets to escape). | Medium | High | Security tests for every schema change; SVG sanitizer for all diagram output; handler escaping in review; private vulnerability reporting ([SECURITY.md](../../SECURITY.md)); keep `hast-util-sanitize` and `rehype-sanitize` current. |
| R2 | Capability claims run ahead of code (it happened once: three in-progress items were listed as built). | Medium | Medium | Now `planned (in progress)`; the SDODS scenario `Capabilities list built and planned features honestly` checks the table; add a unit test that every `built` capability maps to an existing package or command. |
| R3 | unified/remark major upgrades break plugins or types. | Medium | Medium | Exact version pins; the four-times-a-year dependency refresh with the full test run; the `as never` casts in `render/html.ts` are reviewed on every bump because the type-checker cannot see through them. |
| R4 | Mermaid bundle size or API changes. | Medium | Low | Mermaid runs only in the page; it is loaded only when needed; the provider output is just `<pre class="mermaid">`. |
| R5 | `@bpview/core` (Yarlis Blueprint) changes its API. | Medium | Medium | Same org; pinned version; the deterministic-SVG test catches breaks. |
| R6 | Graphviz WASM fails to load in some runtime (browser bundlers, edge runtimes). | Medium | Medium | Lazy import; failure becomes an `MM040` diagnostic, not a crash; document runtime limits in the SDK guide. |
| R7 | Kroki leaks private diagram source. | Low | High | Off by default; flag help text says it sends source; docs recommend self-hosting. |
| R8 | Round trips normalize author formatting and annoy users. | High | Low | `format` is explicit; `roundTrip` reports it; `toc --write` only rewrites through the serializer, which is documented. |
| R9 | Performance is too slow for live preview on large documents. | Medium | Medium | Targets in NFR-020 to NFR-024; add benchmarks; debounce in the playground (250 ms) and studio; caching for diagrams and highlighters. |
| R10 | Rich-text editor cannot keep MarkupMe syntax. | Medium | Medium | Defer behind measurable criteria (ADR 0007); source mode stays the reference. |
| R11 | The `@markupme` npm scope or the name is unavailable. | Low | High | Check scope and trademark before the first tag (PRD open question 1). |
| R12 | SDODS suite lags behind the API. | Medium | Medium | The `e2e` job runs markupme-qa on every markupme pull request (paired branches via `vars.QA_REF`); `qa-gate.mjs` fails a run with too few scenarios. |
| R13 | Browser use of the core is untested (the ui suite tests the server-rendered pages, not the core in a browser). | Medium | Medium | PR#2 (studio) exercises it; add a grep check for `node:` imports in CI. |
| R14 | The npm token leaks or expires before the first publish. | Low | High | Rotate before the first publish (SDO-48); `release.yml` uses provenance and can move to trusted publishing (`NPM_TRUSTED_PUBLISHING`). |

## Dependencies

| Dependency | Used by | Licence (basis) |
| ---------- | ------- | --------------- |
| unified, remark-*, rehype-*, micromark, mdast/hast utilities | core | MIT (general knowledge) |
| github-slugger, gemoji | core | ISC / MIT (general knowledge; re-check before release) |
| yaml, smol-toml | core | ISC / BSD-3-Clause (assumption; re-check) |
| KaTeX | core (`rehype-katex`), cli (assets) | MIT (general knowledge) |
| Shiki | highlight | MIT (general knowledge) |
| `@bpview/core` | diagrams | Yarlis, same org |
| `@hpcc-js/wasm-graphviz` | diagrams | Apache-2.0 (assumption; Graphviz itself is EPL; re-check) |
| Mermaid | cli (copied asset), page runtime | MIT (general knowledge) |
| commander | cli | MIT (general knowledge) |
| playwright (optional peer) | cli `diagram -o` for Mermaid | Apache-2.0 (general knowledge) |

A licence scan (NFR-071) runs before the first release and replaces the "assumption" entries above.
