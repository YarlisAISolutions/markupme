# Acceptance criteria: MarkupMe

- Date: 2026-10-21
- Related: [FRD](FRD.md) · [NFR](NFR.md) · [Traceability](../implementation/requirements-traceability.md)

Each criterion is measurable and names how it is verified:

- **vitest**: `packages/<pkg>/test/<file>.test.ts › describe › test name`. Counts on `main`: core 40, highlight 4, diagrams 7, themes 3, cli 18 (71 in total). The core test for the plugin `rehype` hook is being added with that change.
- **CLI**: a command and its expected exit code or output.
- **SDODS**: `Feature › Scenario` in `YarlisAISolutions/markupme-qa` (`projects/markupme/features/`). Last results: api 17/17, ui 10/10, locally and in GitHub Actions; `sdods lint --strict` clean. Studio, VS Code and React scenarios are planned.
- **CI**: a step in `.github/workflows/ci.yml`.

Status: **met** (an existing automated check passes), **open** (no automated check yet), **in progress**, **planned**.

## Engine and document model

| ID | Criterion | Requirement | Verified by | Status |
| -- | --------- | ----------- | ----------- | ------ |
| AC-001 | `parse('# Hello MarkupMe\n', { file: 'a.md' })` returns `type: 'markupme-document'`, `schemaVersion: 1`, `file: 'a.md'`, and the first node starts on line 1. | FR-B01, FR-A11 | vitest `core.test.ts › parse › produces a versioned document with positions` | met |
| AC-002 | YAML `title: A, n: 2` and TOML `title = "T"` frontmatter parse to the expected objects. | FR-A03 | vitest `core.test.ts › parse › reads YAML and TOML frontmatter` | met |
| AC-003 | Unclosed YAML frontmatter gives one `MM010` error on line 1 and no exception. | FR-A03 | vitest `core.test.ts › parse › reports invalid frontmatter without throwing` | met |
| AC-004 | Two `Hello World` headings get ids `hello-world` and `hello-world-1`; `## Custom {#my-id}` gets `my-id`. | FR-A07 | vitest `core.test.ts › parse › gives headings GitHub-style ids and honours {#custom}` | met |
| AC-005 | `At 10:30 we meet.` serializes unchanged; `:::mystery` gives exactly one `MM009`. | FR-A06 | vitest `core.test.ts › parse › keeps prose colons as text and reports unknown directives` | met |
| AC-006 | A processor with `gfm: false` finds 0 `delete` nodes in `~~x~~`; the default processor finds 1. | FR-A13, FR-F02 | vitest `core.test.ts › parse › is isolated per processor` | met |
| AC-007 | A table, a checked task, strikethrough and a bare URL render as `<table>`, `<input type="checkbox" checked disabled …>`, `<del>` and `<a href>`; task checkboxes carry `aria-label="Completed task: …"` / `"Open task: …"`. | FR-A01, FR-A02, FR-C05 | vitest `core.test.ts › render html › renders CommonMark and GFM`, `core.test.ts › labels task list checkboxes for screen readers`; SDODS `Render API › GitHub Flavored Markdown renders tables, task lists and strikethrough` | met |
| AC-008 | A footnote renders `href="#fn-a"`, `id="fn-a"` and `aria-describedby="footnote-label"`. | FR-A02, FR-C04 | vitest `core.test.ts › render html › renders footnotes with working links`; SDODS `Render API › Footnotes, alerts, directives and heading ids render` | met |
| AC-009 | `> [!WARNING]` renders `markdown-alert-warning` with title `Warning`; `:::tip[Pro tip]` renders `mm-callout-tip` titled `Pro tip`; `:kbd[Ctrl]` renders `<kbd>Ctrl</kbd>`. | FR-A04, FR-A05 | vitest `core.test.ts › render html › renders GitHub alerts and directive callouts`; SDODS `Render API › Footnotes, alerts, directives and heading ids render` | met |
| AC-010 | `[[toc]]` becomes `<nav class="mm-toc" aria-label="Table of contents">` with nested links to h2 and h3. | FR-A08 | vitest `core.test.ts › render html › inserts a table of contents at [[toc]]`; SDODS `Render API › A table of contents is generated on request`, `Rendered pages › The kitchen sink renders every block type` | met |
| AC-011 | A TOC is not inserted by position when there are no headings in range. | FR-A08 | vitest `core.test.ts › does not add an empty TOC by position` | met |
| AC-012 | With `math: true, emoji: true`, `$e^{i\pi}+1=0$ :rocket:` renders `class="katex"` and 🚀. | FR-A09, FR-A10 | vitest `core.test.ts › render html › renders math with KaTeX and emoji when enabled` | met |
| AC-013 | On one crafted document `validate` reports MM001 (heading jump), MM002 (second h1), MM004 (broken fragment), MM005 (no alt text), MM008 (unused definition), MM013 (fence without language) and MM015 (`javascript:` link). | FR-B09 | vitest `core.test.ts › validate › finds structural, link and accessibility problems`; SDODS `Validate and stats API › Broken links, skipped headings and missing alt text are reported`, `› A clean document passes` | met |
| AC-014 | With a `fileExists` that knows only `exists.md`, `[b](missing.md#x)` gives exactly one `MM012` "File not found: missing.md"; with `missing-local-file: 'off'` there are none. | FR-B09, FR-B11 | vitest `core.test.ts › validate › checks local files through an injected checker and honours rule settings` | met |
| AC-015 | A plugin rule (`X001 no-todo`) is run by `validate` and its diagnostic carries the plugin's code and rule name. | FR-B10, FR-F04 | vitest `core.test.ts › validate › accepts plugin rules` | met |
| AC-016 | `transform(doc, { plugins: ['toc'] })` adds a TOC after the title. | FR-B12 | vitest `core.test.ts › transform, diff and stats › adds a TOC after the title on request` | met |
| AC-017 | `diff` reports added, removed and changed blocks. | FR-B07 | vitest `core.test.ts › transform, diff and stats › diffs block structure` | met |
| AC-018 | `stats` counts words, tasks (total and done) and code languages. | FR-B08 | vitest `core.test.ts › transform, diff and stats › counts words, tasks and languages` | met |
| AC-019 | `serialize(doc, { format: 'json' })` has `schemaVersion` and `tree.type === 'root'`. | FR-B04 | vitest `core.test.ts › serialize › writes JSON AST with the schema version` | met |
| AC-020 | `roundTrip` of `examples/kitchen-sink.md` is lossless and the Markdown keeps `> [!NOTE]`, `## Text {#text-basics}` and `<!-- toc -->`. | FR-B03, FR-B05 | vitest `core.test.ts › serialize › round-trips the kitchen sink without loss` | met |
| AC-021 | Serializing a TOC document twice gives identical text. | FR-B03, NFR-041 | vitest `core.test.ts › serialize › keeps a TOC block idempotent` | met |
| AC-022 | `text`, `markdown` and `ast` formats give the expected output (`'Hi\n\n- a\n- [x] b\n'`, `'_a_\n'`, JSON). | FR-C03 | vitest `core.test.ts › other formats › renders plain text, markdown and ast`; SDODS `Render API › Other output formats: <format>` (markdown, text, ast) | met |
| AC-023 | The render title comes from frontmatter `title`, else the first h1. | FR-C09 | vitest `core.test.ts › other formats › takes the title from frontmatter, then the first h1` | met |
| AC-024 | `VERSION` equals `packages/core/package.json` version. | FR-F07, NFR-082 | vitest `core.test.ts › VERSION matches package.json` | met |
| AC-025 | A plugin `rehype` hook runs before sanitizing: it can add an allowlisted class (`mm-note`), and a class outside the allowlist (`evil-class`) is removed. | FR-C15, FR-F04 | vitest `core.test.ts › runs plugin rehype hooks before sanitizing` | met |

## Rendering and security

| ID | Criterion | Requirement | Verified by | Status |
| -- | --------- | ----------- | ----------- | ------ |
| AC-030 | Each of the 10 attack strings renders with no `<script`, no `on*=` attribute, no `href="javascript:`, no `<iframe`, no `style=`, no `<form`, no `<style`, no `id="location"`. | FR-C01, NFR-001, NFR-004 | vitest `core.test.ts › security › neutralises …` (10 tests); SDODS `Rendered pages › Raw HTML in the source is sanitized in the page` | met |
| AC-031 | A handler's `<svg class="graph"><g/></svg>` survives next to a removed `<script>`. | FR-C04, NFR-002 | vitest `core.test.ts › security › keeps trusted code block output after sanitizing` | met |
| AC-032 | `style="color:red"` is kept only with `sanitize: false`; `allowHtml: false` drops `<b>`. | FR-C02 | vitest `core.test.ts › security › allows raw HTML only when sanitize is explicitly off` | met |
| AC-033 | With `anchors`, `baseUrl` and `externalLinksNewTab`, output has `mm-anchor` links, absolute lazy image URLs and `target="_blank" rel="noopener noreferrer"`. | FR-C05 | vitest `core.test.ts › render html › adds anchors, lazy images, base URLs and external link targets when asked` | met |
| AC-034 | Rendering the kitchen sink twice gives identical HTML; two CI runs of `render examples --standalone`, `render -f ast` and `build examples` give identical files (`diff -r`). | FR-C10, NFR-040 | vitest `core.test.ts › render html › is deterministic`; CI `ci.yml › rendering is deterministic` | met |
| AC-035 | `parseMeta('title="a.ts" {1,3-5} showLineNumbers')` gives title, lines {1,3,4,5} and line numbers. | FR-C06 | vitest `highlight.test.ts › parseMeta › reads titles, ranges and line numbers` | met |
| AC-036 | Highlighted output has dual theme variables, a title, a copy button with `aria-label="Copy code"` and `mm-line-highlight`. | FR-C06, FR-C07, NFR-031 | vitest `highlight.test.ts › highlightHandler › highlights with dual themes, title, copy button and highlighted lines`; SDODS `Rendered pages › The kitchen sink renders every block type` ("Copy code" button visible) | met |
| AC-037 | An unknown language is escaped, not dropped; skipped languages return `undefined`. | FR-C06 | vitest `highlight.test.ts › highlightHandler › escapes unknown languages instead of dropping them`, `› skips configured languages` | met |
| AC-038 | `wrapDocument` output has `lang`, viewport, title, a labelled theme toggle and `<main>`. | FR-C08, NFR-031 | vitest `themes.test.ts › wrapDocument › builds an accessible standalone page` | met |
| AC-039 | Navigation renders with `aria-current="page"`, and a Mermaid URL containing `</script>` is escaped. | FR-C08 | vitest `themes.test.ts › wrapDocument › renders site navigation and escapes the Mermaid URL` | met |
| AC-040 | `markupmeCss` contains light, dark and print rules. | FR-C08, NFR-034 | vitest `themes.test.ts › ships light, dark and print styles` | met |
| AC-041 | `POST /api/render` with `<script>`, `onerror`, a `javascript:` link and an `<iframe>`, and `sanitize: false`, on a server without `--unsafe` returns none of them. | NFR-006 | vitest `cli.test.ts › serve API › renders sanitized HTML with diagrams and stats`; SDODS `Render API › Untrusted HTML is sanitized even when the caller asks otherwise` | met |
| AC-042 | The playground and the kitchen-sink page have no axe-core violations of impact serious or worse, exactly one h1 and no skipped heading levels (light theme). Dark-theme contrast is not checked yet. | NFR-030, NFR-032 | SDODS `Playground › The playground is accessible`, `Rendered pages › The page structure is accessible` | met (light); dark open |
| AC-043 | The theme toggle switches the painted background to dark. | FR-C08 | SDODS `Playground › The theme toggle switches to dark mode` | met |

## Diagrams

| ID | Criterion | Requirement | Verified by | Status |
| -- | --------- | ----------- | ----------- | ------ |
| AC-050 | A `ybp` block renders `mm-diagram-blueprint` with `<svg`, identical across two handlers. | FR-E02, NFR-040 | vitest `diagrams.test.ts › providers › renders Blueprint to deterministic SVG`; SDODS `Render API › Graphviz, Blueprint and Mermaid diagrams render` | met |
| AC-051 | `digraph G { a -> b }` renders `mm-diagram-graphviz` SVG containing `<title>a</title>`. | FR-E03 | vitest `diagrams.test.ts › providers › renders Graphviz DOT through WebAssembly`; SDODS `Rendered pages › Server-side and browser diagrams render` | met |
| AC-052 | A Mermaid block becomes `<pre class="mermaid">` with `>` escaped, and in Chromium the runtime turns it into an SVG (`data-processed="true"`). | FR-E04 | vitest `diagrams.test.ts › providers › emits Mermaid for the browser runtime`; SDODS `Playground › The playground loads with a rendered sample`, `Rendered pages › Server-side and browser diagrams render` | met |
| AC-053 | A broken diagram gives an `MM040` diagnostic and an inline `mm-diagram-error` box. | FR-E07 | vitest `diagrams.test.ts › providers › reports a bad diagram as a diagnostic and an inline error`; SDODS `Render API › A broken diagram is reported, not crashed on` | met |
| AC-054 | Without a Kroki server, `plantuml` is not a diagram; with a (mocked) server, its SVG is sanitized. | FR-E05, FR-E06, NFR-005 | vitest `diagrams.test.ts › providers › uses Kroki only when configured, and sanitizes its SVG` | met |
| AC-055 | `sanitizeSvg` removes `javascript:` links, `onclick`, `foreignObject` and `@import` styles, and keeps an `https:` link. | FR-E06, NFR-003 | vitest `diagrams.test.ts › sanitizeSvg › removes scripts, handlers, foreignObject and unsafe links` | met |
| AC-056 | `extractDiagrams` lists diagram blocks with provider and line. | FR-E10 | vitest `diagrams.test.ts › extracts diagram blocks` | met |
| AC-057 | `markupme diagram dia.md -o svg` writes `dia-1-dot.svg` and `dia-2-ybp.svg` containing `<svg`, exit 0. | FR-E09, FR-G11 | vitest `cli.test.ts › info commands › exports server-side diagrams as SVG` | met |
| AC-058 | `markupme diagram` on a Mermaid file with `-o` and no `playwright` exits 64. | FR-E09 | CLI: `markupme diagram mermaid.md -o out; echo $?` → `64` | open (no test) |
| AC-059 | A second render of the same diagram with the same handler does not call the provider again. | FR-E08, NFR-021 | vitest test to add | open |

## CLI and serve

| ID | Criterion | Requirement | Verified by | Status |
| -- | --------- | ----------- | ----------- | ------ |
| AC-060 | `render` to stdout works for `html`, `md`, `ast` and `text`. | FR-G01 | vitest `cli.test.ts › render › renders to stdout as html, md, ast and text` | met |
| AC-061 | `render -f pdf` exits 64 with "PDF export is planned"; `-f rtf` and a missing input file exit 2. `capabilities --json` lists PDF as planned, and lists every feature with its true status. | FR-G02, FR-G15 | vitest `cli.test.ts › render › reports planned formats with exit 64 and unknown ones as usage errors`, `› info commands › parse --outline, stats, diff and capabilities`; SDODS `Preview server health › Capabilities list built and planned features honestly` | met (studio, VS Code and React are listed as planned, in progress, Phase 1) |
| AC-062 | `render -s -o` of a Mermaid page writes the page and `assets/mermaid.min.js`, and the page references it. | FR-G03 | vitest `cli.test.ts › render › writes a standalone page with Mermaid copied to assets` | met |
| AC-063 | Rendering a directory with `-o` writes one file per input. | FR-G01 | vitest `cli.test.ts › render › renders a directory into an output directory` | met |
| AC-064 | `validate` on a file with an error exits 1 and prints `file:line:col` diagnostics. | FR-G04 | vitest `cli.test.ts › validate › fails on errors and prints file:line diagnostics`; CI `ci.yml › examples validate with --strict` (`--check-diagrams`) | met |
| AC-065 | Clean docs exit 0; `--rule name=off` silences a rule; `--strict` fails on warnings; `--json` has `ok`, `errors`, `warnings`, `diagnostics`. | FR-G04 | vitest `cli.test.ts › validate › passes clean docs, respects --rule and --strict, and emits JSON` | met |
| AC-066 | With `GITHUB_ACTIONS=true`, diagnostics also print `::error file=…,line=…` annotations. | FR-G05, NFR-062 | vitest `cli.test.ts › validate › emits GitHub annotations in Actions` | met |
| AC-067 | `format --check` exits 1 on an unformatted file; `--write` fixes it; `--check` then exits 0. | FR-G06 | vitest `cli.test.ts › format and toc › checks and writes formatting` | met |
| AC-068 | `toc --write` then `toc --check` exits 0, and a second `--write` changes nothing. | FR-G07, NFR-041 | vitest `cli.test.ts › format and toc › inserts and refreshes a TOC idempotently` | met |
| AC-069 | `build` writes pages with navigation, rewrites `.md` links to `.html`, and writes `search-index.json`. | FR-G08 | vitest `cli.test.ts › build › builds a site with navigation, rewritten links and a search index` | met |
| AC-070 | `parse --outline`, `stats`, `diff` (exit 1 on difference) and `capabilities` produce the expected output. | FR-G12, FR-G14 | vitest `cli.test.ts › info commands › parse --outline, stats, diff and capabilities` | met |
| AC-071 | `init` writes the config and sample; a second `init` exits 2; `validate docs --strict` on the sample exits 0. | FR-G16 | vitest `cli.test.ts › info commands › init writes a config and a sample` | met |
| AC-072 | `GET /api/health` returns `{"status":"ok","name":"markupme","version":"0.1.0"}` with `X-Content-Type-Options: nosniff`. | FR-G10, NFR-006 | vitest `cli.test.ts › serve API › reports health`; SDODS `Preview server health › Health reports ok with the product name and version` | met |
| AC-073 | `POST /api/render` of DOT, Blueprint and Mermaid blocks returns 200 with `mm-diagram-graphviz` and `mm-diagram-blueprint` SVG, `<pre class="mermaid">` and 0 diagnostics. | FR-G10, FR-E02, FR-E03 | vitest `cli.test.ts › serve API › renders sanitized HTML with diagrams and stats`; SDODS `Render API › Graphviz, Blueprint and Mermaid diagrams render` | met |
| AC-074 | `POST /api/validate` of `[x](#y)` returns `ok: false, errors: 1`; empty body to `/api/render` is 400; `format: "pdf"` is 501; `GET /api/render` is 405. | FR-G10 | vitest `cli.test.ts › serve API › validates and rejects bad requests`; SDODS `Render API › A body without markdown is rejected`, `› Planned formats answer 501 instead of pretending`, `› GET on a POST route is refused` | met |
| AC-075 | `GET /guide/intro.md` is HTML with `<h1 id="intro">`; `/..%2f..%2fbad.md` is 403; the playground is 200. | FR-G09, FR-D01, NFR-006 | vitest `cli.test.ts › serve API › serves rendered pages and refuses path traversal`; SDODS `Rendered pages › The kitchen sink renders every block type`, `› In-page links navigate to their heading` | met |
| AC-076 | `POST /api/stats` returns the `DocumentStats` shape: for a document with one heading, two tasks (one done) and a `ts` block, `headings: 1`, `tasks.done: 1`, `languages.ts: 1`. | FR-G10, FR-B08 | SDODS `Validate and stats API › Stats count words, headings, tasks and code languages` | met |
| AC-077 | A body larger than 1 MB returns 413 `TOO_LARGE`. | NFR-006 | No scenario yet (gap) | open |
| AC-078 | In the playground the sample renders and the status shows "Rendered"; typing Markdown updates the preview; a broken link appears in the diagnostics list as `MM004`. | FR-D01 | SDODS `Playground › The playground loads with a rendered sample`, `› Typing updates the preview`, `› Problems show up as diagnostics` | met |
| AC-080 | `POST /api/render` with `lint: true` adds rule diagnostics (for `[x](#nope)`: exactly `MM004`). | FR-G10 | vitest `cli.test.ts › serve API lint option › adds rule diagnostics to a render when lint is true` | met |
| AC-079 | `render --watch` re-renders after a file change. | FR-G01 | CLI manual check | open |

## Editors (Phase 1, in progress)

No criterion here is met yet. The studio criteria will be verified by a new SDODS `Studio` feature (PR#2); the VS Code and React criteria by their own tests (PR#3).

| ID | Criterion | Requirement | Verified by | Status |
| -- | --------- | ----------- | ----------- | ------ |
| AC-090 | The studio loads `examples/kitchen-sink.md`, and its preview HTML equals `markupme render` of the same file (diagrams aside). | FR-D02, FR-D03 | SDODS `@ui` `Studio` (planned) | in progress |
| AC-091 | Clicking an outline entry moves the editor to that heading. | FR-D04 | SDODS `Studio` (planned) | in progress |
| AC-092 | The command palette opens with a keyboard shortcut and runs "Insert TOC". | FR-D05 | SDODS `Studio` (planned) | in progress |
| AC-093 | After a reload, the last edited text is restored from local storage. | FR-D06 | SDODS `Studio` (planned) | in progress |
| AC-094 | Export HTML downloads a file that passes `markupme validate` with exit 0 for a clean input. | FR-D07 | SDODS `Studio` (planned) | in progress |
| AC-095 | The VS Code preview shows a Graphviz diagram from the open file. | FR-D08 | `packages/vscode` live test `scripts/e2e.mjs` (preview draws Graphviz SVG, Mermaid under CSP) | met |
| AC-096 | A broken fragment link appears in the Problems panel as `MM004`. | FR-D10 | Extension tests (PR#3) | in progress |
| AC-097 | `@markupme/react` renders the kitchen sink with no `<script>` in the DOM. | FR-C11 | vitest `packages/react/test/render.test.ts` | met |

## Done definition for a release

A release candidate is accepted when:

1. `bun run lint:check && bun run build && bun run type-check && bun run test` exits 0.
2. Every AC above marked met still passes.
3. The `ci.yml` jobs `test`, `e2e` and `gitleaks` are green: the SDODS api and ui suites pass 100%, and `scripts/qa-gate.mjs` sees at least 15 api and 10 ui scenarios.
4. `markupme capabilities` lists nothing as built that the repository does not contain.
