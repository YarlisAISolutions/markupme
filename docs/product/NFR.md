# Non-functional requirements: MarkupMe

- Date: 2026-10-21
- Related: [FRD](FRD.md) · [Acceptance criteria](acceptance-criteria.md) · [Security guide](../guide/security.md)

IDs are `NFR-<nnn>`, grouped by category. Each has a measure and how it is checked. Performance numbers are **targets**, not measurements: no benchmark has been run yet.

## Security

| ID | Requirement | Measure | Check |
| -- | ----------- | ------- | ----- |
| NFR-001 | HTML output is sanitized by default in the library, CLI, `build` and `serve`. | With default options, none of the 10 attack strings in `core.test.ts` yields `<script`, an `on*=` attribute, `href="javascript:`, `<iframe`, `style=`, `<form`, `<style` or `id="location"`. | vitest |
| NFR-002 | Trusted output (handlers, KaTeX) enters only after sanitizing, through slots with a per-render random nonce. | Slot ids contain 12 hex characters from `crypto.getRandomValues`; handler output appears intact next to sanitized user HTML. | vitest; code review of `render/html.ts` |
| NFR-003 | All diagram SVG is sanitized. | `sanitizeSvg` removes scripts, `foreignObject`, `on*` handlers and non-`#/http/https/mailto` links. | vitest |
| NFR-004 | Author ids cannot clobber DOM globals. | Author ids keep the `user-content-` prefix; generated heading and footnote ids do not. | vitest |
| NFR-005 | No network access by default. | Rendering with default options makes no HTTP request; Kroki is used only with a configured server; Mermaid loads from a local path unless `--mermaid-url` is given. | Code review; vitest (`uses Kroki only when configured`) |
| NFR-006 | The preview server is safe on a developer machine. | Binds `127.0.0.1` by default; path traversal returns 403; dotfiles return 404; a `Host` that is not loopback, an IP or `--host` returns 403; an unreadable file returns 500 without stopping the server; body over 1 MB returns 413; `sanitize: false` ignored without `--unsafe`; responses carry `nosniff`, `no-referrer`, `SAMEORIGIN`. | vitest; SDODS `Preview server health` (nosniff), `Render API › Untrusted HTML is sanitized even when the caller asks otherwise`, `› GET on a POST route is refused` (413 not covered) |
| NFR-007 | The sanitize default is never weakened without a security test. | Every change to `markupmeSchema` adds or updates a test in `describe('security')`. | Pull request review |
| NFR-008 | No secrets in the repository. | `gitleaks git --staged --no-banner .` passes before each commit; the full history passes in CI. | Pre-commit check; CI `ci.yml` job `gitleaks`; `security.yml` |

## Performance

| ID | Requirement | Target | Check |
| -- | ----------- | ------ | ----- |
| NFR-020 | Rendering a typical document is fast enough for live preview. | Target: under 100 ms to render a 10 KB document to HTML without diagrams, warm, on a recent laptop. | Benchmark to be added (Phase 1 follow-up) |
| NFR-021 | Diagram rendering does not repeat work. | Rendering the same diagram twice with one handler hits the cache (no second provider call). | Code review; test to be added |
| NFR-022 | Heavy dependencies load only when needed. | Shiki highlighter, Graphviz WASM, `@bpview/core` and gemoji load on first use; Mermaid loads in the page only when a Mermaid block exists. | Code review |
| NFR-023 | The serve API stays responsive. | Target: p95 under 300 ms for `/api/render` of a 10 KB document without diagrams on localhost. | Not measured yet; SDODS api runs could record timings |
| NFR-024 | `markupme build` scales to documentation folders. | Target: 200 pages in under 30 s without Kroki. | Benchmark to be added |

## Accessibility

| ID | Requirement | Measure | Check |
| -- | ----------- | ------- | ----- |
| NFR-030 | Generated markup is semantic. | TOC is `<nav aria-label>`; alerts and callouts have `role="note"`; diagrams are `<figure role="group" aria-label>`; diagram errors `role="alert"`; heading anchors have `aria-label="Link to section: …"`. | vitest (fragments asserted) |
| NFR-031 | Interactive controls have accessible names. | Copy button `aria-label="Copy code"`; theme toggle `aria-label` and `aria-pressed`; highlighted `<pre>` has `tabindex="0"`; task checkboxes have `aria-label="Completed task: …"` / `"Open task: …"`. | vitest; SDODS `Playground › The playground is accessible`, `Rendered pages › The page structure is accessible`, `Rendered pages › The kitchen sink renders every block type` ("Copy code" button) |
| NFR-032 | Theme colours meet WCAG 2.1 AA contrast. | Text and link colours in `markupmeCss` reach 4.5:1 on their background in light and dark. | axe-core in SDODS (`… is accessible` scenarios, light theme); dark theme not checked yet |
| NFR-033 | Lint helps authors write accessible docs. | MM005 (alt text), MM001 (heading order), MM006 (link text), MM016 (empty heading) are on by default. | vitest |
| NFR-034 | Pages print well. | `markupmeCss` has print rules. | vitest (`ships light, dark and print styles`) |

## Determinism

| ID | Requirement | Measure | Check |
| -- | ----------- | ------- | ----- |
| NFR-040 | Same input and options give the same output. | Rendering the kitchen sink twice gives byte-identical HTML; Blueprint SVG is identical across handlers. | vitest |
| NFR-041 | Formatting and TOC refresh are idempotent. | `serialize(parse(serialize(parse(x))))` equals `serialize(parse(x))` for TOC documents; `toc --write` then `toc --check` exits 0. | vitest |
| NFR-042 | Builds are reproducible. | Exact dependency versions in every `package.json`; `bun.lock` committed and installed with `--frozen-lockfile`; two renders and builds of `examples` are identical. | CI `ci.yml › rendering is deterministic` |

## Compatibility

| ID | Requirement | Measure | Check |
| -- | ----------- | ------- | ----- |
| NFR-050 | Node.js 22 or later. | `engines.node: ">=22"` in every package; tests pass on Node 22. | CI `ci.yml` (`setup-node` 22) |
| NFR-051 | Bun. | `bun install`, `bun run build`, `bun run test` pass with Bun 1.4. | Local and CI `ci.yml` (Bun 1.4.0) |
| NFR-052 | Browser-safe library packages. | No `node:` imports in `packages/core/src`, `highlight/src`, `diagrams/src`, `themes/src` (verified 2026-10-20 by grep); crypto via `globalThis.crypto`. A browser test is planned. | grep in CI (to add); browser test (planned) |
| NFR-053 | Standards. | CommonMark through micromark; GFM through `remark-gfm`; GitHub-compatible heading slugs and alerts. | vitest; CommonMark spec run (planned) |
| NFR-054 | ESM with type declarations. | Each package exports `types` and `default` from `dist/`. | `bun run build`, `bun run type-check` |
| NFR-055 | Stable public contracts. | Diagnostic codes, exit codes, the `Diagnostic` shape and `schemaVersion` change only with a major version (or a `schemaVersion` bump). | Review; CHANGELOG |

## Observability

| ID | Requirement | Measure | Check |
| -- | ----------- | ------- | ----- |
| NFR-060 | Problems are reported as structured diagnostics, not exceptions. | Bad frontmatter, unknown directives, broken diagrams and failing handlers produce diagnostics with code, rule, severity and position. | vitest |
| NFR-061 | Diagnostics are machine-readable. | `--json` on `render` and `validate`; serve API returns diagnostics arrays. | vitest |
| NFR-062 | CI integration. | `file:line:col severity code message (rule)` lines and GitHub Actions annotations. | vitest (`emits GitHub annotations in Actions`) |
| NFR-063 | Capabilities are discoverable. | `markupme capabilities --json` and `GET /api/capabilities`. | vitest |

## Licensing

| ID | Requirement | Measure | Check |
| -- | ----------- | ------- | ----- |
| NFR-070 | MarkupMe code is MIT. | `LICENSE` is MIT; every `package.json` has `"license": "MIT"`. | Review |
| NFR-071 | Dependencies are MIT-compatible. | No GPL code bundled; GPL tools (Pandoc, PlantUML via Kroki) only as separate programs or servers. | Licence scan before first release (to add) |

## Maintainability

| ID | Requirement | Measure | Check |
| -- | ----------- | ------- | ----- |
| NFR-080 | One command defines a green tree. | `bun run lint:check && bun run build && bun run type-check && bun run test` passes. | CI `ci.yml` job `test` |
| NFR-081 | Strict TypeScript. | `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` in `tsconfig.base.json`. | `bun run type-check` |
| NFR-082 | Version constants match manifests. | `VERSION` equals `package.json` version. | vitest (`VERSION matches package.json`) |
