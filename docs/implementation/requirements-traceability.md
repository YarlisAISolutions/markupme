# Requirements traceability

- Date: 2026-10-21
- Related: [FRD](../product/FRD.md) · [NFR](../product/NFR.md) · [Acceptance criteria](../product/acceptance-criteria.md) · [Implementation plan](implementation-plan.md)

Each row links a requirement to the code that implements it, the vitest test that covers it, the SDODS scenario that covers it end to end, and its status.

- **Test** is `file::describe › test name` from the real test files. Paths are under `packages/`.
- **SDODS** is `Feature › Scenario` from `YarlisAISolutions/markupme-qa`, `projects/markupme/features/`. The feature files are listed in [SDODS scenarios](#sdods-scenarios). Last results: api 17/17 and ui 10/10 passed, locally and in GitHub Actions; `sdods lint --strict` clean.
- **Status**:
  - **verified**: code, a passing unit test and a passing SDODS scenario.
  - **built**: code and a passing unit test (no end-to-end scenario, or not applicable).
  - **built, no test**: code exists, no automated test.
  - **in progress**: Phase 1 work on `feat/studio` / `feat/vscode`.
  - **planned**: later phase.

## A. Engine

| Req | Package / file | Test | SDODS | Status |
| --- | -------------- | ---- | ----- | ------ |
| FR-A01 | core `src/parse.ts` | `core/test/core.test.ts::render html › renders CommonMark and GFM` | Render API › GitHub Flavored Markdown renders tables, task lists and strikethrough | verified |
| FR-A02 | core `src/parse.ts` (`remark-gfm`) | `core.test.ts::render html › renders CommonMark and GFM`; `::render html › renders footnotes with working links`; `::parse › is isolated per processor` | Render API › GitHub Flavored Markdown renders tables, task lists and strikethrough; Render API › Footnotes, alerts, directives and heading ids render | verified |
| FR-A03 | core `src/plugins/frontmatter.ts` | `core.test.ts::parse › reads YAML and TOML frontmatter`; `::parse › reports invalid frontmatter without throwing` | Rendered pages › The kitchen sink renders every block type (frontmatter title) | verified |
| FR-A04 | core `src/plugins/alerts.ts` | `core.test.ts::render html › renders GitHub alerts and directive callouts` | Render API › Footnotes, alerts, directives and heading ids render | verified |
| FR-A05 | core `src/plugins/directives.ts` | `core.test.ts::render html › renders GitHub alerts and directive callouts` (callout, kbd). `details`, `figure`, `columns`, `abbr`, `mark`, `sub`, `sup`, `badge`, `br` have no dedicated test. | Render API › Footnotes, alerts, directives and heading ids render (callout, kbd) | verified (callout, kbd); rest built, no test |
| FR-A06 | core `src/plugins/directives.ts` | `core.test.ts::parse › keeps prose colons as text and reports unknown directives` | none | built |
| FR-A07 | core `src/plugins/headings.ts` | `core.test.ts::parse › gives headings GitHub-style ids and honours {#custom}` | Render API › Footnotes, alerts, directives and heading ids render; Rendered pages › In-page links navigate to their heading (`{#text-basics}`) | verified |
| FR-A08 | core `src/plugins/toc.ts` | `core.test.ts::render html › inserts a table of contents at [[toc]]`; `::does not add an empty TOC by position`; `::transform, diff and stats › adds a TOC after the title on request` | Render API › A table of contents is generated on request; Rendered pages › The kitchen sink renders every block type | verified |
| FR-A09 | core `src/parse.ts`, `src/render/html.ts` (KaTeX) | `core.test.ts::render html › renders math with KaTeX and emoji when enabled` | none | built |
| FR-A10 | core `src/plugins/emoji.ts` | `core.test.ts::render html › renders math with KaTeX and emoji when enabled` | none | built |
| FR-A11 | core `src/parse.ts`, `src/types.ts` | `core.test.ts::parse › produces a versioned document with positions` | Validate and stats API › Broken links, skipped headings and missing alt text are reported (line 7) | verified |
| FR-A12 | core `src/parse.ts` (`syntaxPlugins`) | none | none | built, no test |
| FR-A13 | core `src/parse.ts`, `src/processor.ts` | `core.test.ts::parse › is isolated per processor` | none | built |
| FR-A14 | none | none | none | planned |

## B. Document model

| Req | Package / file | Test | SDODS | Status |
| --- | -------------- | ---- | ----- | ------ |
| FR-B01 | core `src/types.ts`, `src/parse.ts` | `core.test.ts::parse › produces a versioned document with positions` | Render API › Other output formats: ast | verified |
| FR-B02 | core `src/parse.ts`, `src/render/html.ts` | `core.test.ts::serialize › round-trips the kitchen sink without loss` | none | built |
| FR-B03 | core `src/serialize.ts` | `core.test.ts::serialize › round-trips the kitchen sink without loss`; `::serialize › keeps a TOC block idempotent` | Render API › Other output formats: markdown | verified |
| FR-B04 | core `src/serialize.ts` | `core.test.ts::serialize › writes JSON AST with the schema version` | Render API › Other output formats: ast | verified |
| FR-B05 | core `src/processor.ts` (`roundTrip`) | `core.test.ts::serialize › round-trips the kitchen sink without loss` | none | built |
| FR-B06 | core `src/util.ts`, `src/plugins/headings.ts` | `core.test.ts::parse › is isolated per processor` (`query`); `::parse › gives headings GitHub-style ids and honours {#custom}` (`outline`) | none | built |
| FR-B07 | core `src/util.ts` (`diff`) | `core.test.ts::transform, diff and stats › diffs block structure` | none | built |
| FR-B08 | core `src/util.ts` (`stats`) | `core.test.ts::transform, diff and stats › counts words, tasks and languages` | Validate and stats API › Stats count words, headings, tasks and code languages | verified |
| FR-B09 | core `src/validate.ts` | `core.test.ts::validate › finds structural, link and accessibility problems`; `::validate › checks local files through an injected checker and honours rule settings` | Validate and stats API › Broken links, skipped headings and missing alt text are reported; › A clean document passes | verified (MM006 and MM016 have no dedicated test) |
| FR-B10 | core `src/processor.ts` (`rules`), `src/validate.ts` | `core.test.ts::validate › accepts plugin rules` | none | built |
| FR-B11 | core `src/validate.ts` (MM012) | `core.test.ts::validate › checks local files through an injected checker and honours rule settings` | none | built |
| FR-B12 | core `src/processor.ts` (`transform`) | `core.test.ts::transform, diff and stats › adds a TOC after the title on request` | none | built (`normalize` has no test) |
| FR-B13 | none | none | none | planned |

## C. Rendering

| Req | Package / file | Test | SDODS | Status |
| --- | -------------- | ---- | ----- | ------ |
| FR-C01 | core `src/render/html.ts`, `src/render/schema.ts` | `core.test.ts::security › neutralises …` (10 tests) | Render API › Untrusted HTML is sanitized even when the caller asks otherwise; Rendered pages › Raw HTML in the source is sanitized in the page | verified |
| FR-C02 | core `src/render/html.ts` | `core.test.ts::security › allows raw HTML only when sanitize is explicitly off` | Render API › Untrusted HTML is sanitized even when the caller asks otherwise | verified |
| FR-C03 | core `src/processor.ts`, `src/render/text.ts` | `core.test.ts::other formats › renders plain text, markdown and ast` | Render API › Other output formats: markdown / text / ast | verified |
| FR-C04 | core `src/render/html.ts` | `core.test.ts::security › keeps trusted code block output after sanitizing`; `::security › neutralises <a href="#" id="location">clobber</a>`; `::render html › renders footnotes with working links` | Render API › Graphviz, Blueprint and Mermaid diagrams render (trusted SVG survives sanitizing) | verified |
| FR-C05 | core `src/render/html.ts` | `core.test.ts::render html › adds anchors, lazy images, base URLs and external link targets when asked`; `core.test.ts::labels task list checkboxes for screen readers` | Render API › GitHub Flavored Markdown renders tables, task lists and strikethrough (task `aria-label`) | verified |
| FR-C06 | highlight `src/index.ts` | `highlight/test/highlight.test.ts::parseMeta › reads titles, ranges and line numbers`; `::highlightHandler › highlights with dual themes, title, copy button and highlighted lines`; `::highlightHandler › escapes unknown languages instead of dropping them`; `::highlightHandler › skips configured languages` | Rendered pages › The kitchen sink renders every block type | verified |
| FR-C07 | highlight `src/index.ts`, themes `src/runtime.ts` | `highlight.test.ts::highlightHandler › highlights with dual themes, title, copy button and highlighted lines` | Rendered pages › The kitchen sink renders every block type ("Copy code" button visible) | verified |
| FR-C08 | themes `src/index.ts`, `src/css.ts`, `src/runtime.ts` | `themes/test/themes.test.ts::wrapDocument › builds an accessible standalone page`; `::wrapDocument › renders site navigation and escapes the Mermaid URL`; `::ships light, dark and print styles` | Playground › The theme toggle switches to dark mode; Rendered pages › The page structure is accessible | verified |
| FR-C09 | core `src/processor.ts` (`titleOf`) | `core.test.ts::other formats › takes the title from frontmatter, then the first h1` | Render API › GitHub Flavored Markdown renders tables, task lists and strikethrough (`title` = "Report") | verified |
| FR-C10 | core `src/render/html.ts` | `core.test.ts::render html › is deterministic` | none; CI `ci.yml` step "rendering is deterministic" | built |
| FR-C11 | `packages/react` | none yet | none (planned) | in progress |
| FR-C12 | cli `src/commands/render.ts` (exit 64 stub), serve (501) | `cli/test/cli.test.ts::render › reports planned formats with exit 64 and unknown ones as usage errors` | Render API › Planned formats answer 501 instead of pretending | planned (refusal verified) |
| FR-C13 | cli `src/commands/render.ts` (exit 64 stub) | none for docx | none | planned |
| FR-C14 | cli `src/commands/render.ts` (exit 64 stub) | none for mdx | none | planned |
| FR-C15 | core `src/render/html.ts` (hook runs before raw HTML parsing and sanitizing) | `core.test.ts::runs plugin rehype hooks before sanitizing` (being added with the hook) | none | built |

## D. Editing

| Req | Package / file | Test | SDODS | Status |
| --- | -------------- | ---- | ----- | ------ |
| FR-D01 | cli `src/commands/serve.ts` (`playgroundPage`) | `cli.test.ts::serve API › serves rendered pages and refuses path traversal` (status 200); `cli.test.ts::serve API lint option › adds rule diagnostics to a render when lint is true` | Playground › The playground loads with a rendered sample; › Typing updates the preview; › Problems show up as diagnostics; › The playground is accessible | verified |
| FR-D02 | `apps/studio` | none yet | Studio (planned) | in progress |
| FR-D03 | `apps/studio` | none yet | Studio (planned) | in progress |
| FR-D04 | `apps/studio` | none yet | Studio (planned) | in progress |
| FR-D05 | `apps/studio` | none yet | Studio (planned) | in progress |
| FR-D06 | `apps/studio` | none yet | Studio (planned) | in progress |
| FR-D07 | `apps/studio` | none yet | Studio (planned) | in progress |
| FR-D08 | `packages/vscode` | none yet | none (planned) | in progress |
| FR-D09 | `packages/vscode` | none yet | none (planned) | in progress |
| FR-D10 | `packages/vscode` | none yet | none (planned) | in progress |
| FR-D11 | none | none | none | planned |
| FR-D12 | none | none | none | planned |

## E. Diagrams

| Req | Package / file | Test | SDODS | Status |
| --- | -------------- | ---- | ----- | ------ |
| FR-E01 | diagrams `src/index.ts` (`DiagramProvider`) | `diagrams/test/diagrams.test.ts::providers › uses Kroki only when configured, and sanitizes its SVG` (custom provider list) | none | built |
| FR-E02 | diagrams `src/index.ts` (`blueprintProvider`) | `diagrams.test.ts::providers › renders Blueprint to deterministic SVG` | Render API › Graphviz, Blueprint and Mermaid diagrams render | verified |
| FR-E03 | diagrams `src/index.ts` (`graphvizProvider`) | `diagrams.test.ts::providers › renders Graphviz DOT through WebAssembly`; `cli.test.ts::serve API › renders sanitized HTML with diagrams and stats` | Render API › Graphviz, Blueprint and Mermaid diagrams render; Rendered pages › Server-side and browser diagrams render | verified |
| FR-E04 | diagrams `src/index.ts` (`mermaidProvider`), themes `src/runtime.ts` | `diagrams.test.ts::providers › emits Mermaid for the browser runtime` | Render API › Graphviz, Blueprint and Mermaid diagrams render; Playground › The playground loads with a rendered sample; Rendered pages › Server-side and browser diagrams render (Mermaid SVG drawn in Chromium) | verified |
| FR-E05 | diagrams `src/index.ts` (`krokiProvider`) | `diagrams.test.ts::providers › uses Kroki only when configured, and sanitizes its SVG` | none | built |
| FR-E06 | diagrams `src/sanitize-svg.ts` | `diagrams.test.ts::sanitizeSvg › removes scripts, handlers, foreignObject and unsafe links` | none | built |
| FR-E07 | diagrams `src/index.ts` (`diagramHandler`) | `diagrams.test.ts::providers › reports a bad diagram as a diagnostic and an inline error` | Render API › A broken diagram is reported, not crashed on | verified |
| FR-E08 | diagrams `src/index.ts` (cache) | none | none | built, no test |
| FR-E09 | cli `src/commands/diagram.ts` | `cli.test.ts::info commands › exports server-side diagrams as SVG` (Mermaid path untested) | none | built |
| FR-E10 | diagrams `src/index.ts` (`extractDiagrams`) | `diagrams.test.ts::extracts diagram blocks` | none | built |
| FR-E11 | none | none | none | planned |

## F. SDK

| Req | Package / file | Test | SDODS | Status |
| --- | -------------- | ---- | ----- | ------ |
| FR-F01 | every `packages/*/package.json` | build and type-check; CI `ci.yml` step "pack (what npm would publish)" | none | built |
| FR-F02 | core `src/processor.ts` (`createProcessor`) | `core.test.ts::parse › is isolated per processor` | none | built |
| FR-F03 | core `src/processor.ts` | most core tests use the module-level functions | none | built |
| FR-F04 | core `src/types.ts`, `src/parse.ts`, `src/render/html.ts` | `core.test.ts::validate › accepts plugin rules`; `core.test.ts::runs plugin rehype hooks before sanitizing` | none | built (`render` and `codeBlock` hooks used by the CLI, no dedicated test) |
| FR-F05 | core `src/render/html.ts` | `core.test.ts::security › keeps trusted code block output after sanitizing` | none | built (MM020 path untested) |
| FR-F06 | core `src/types.ts`, `src/format.ts` | `cli.test.ts::validate › fails on errors and prints file:line diagnostics` | Validate and stats API › Broken links, skipped headings and missing alt text are reported | verified |
| FR-F07 | core `src/version.ts` | `core.test.ts::VERSION matches package.json` | Preview server health › Health reports ok with the product name and version | verified |

## G. CLI

| Req | Package / file | Test | SDODS | Status |
| --- | -------------- | ---- | ----- | ------ |
| FR-G01 | cli `src/commands/render.ts` | `cli.test.ts::render › renders to stdout as html, md, ast and text`; `::render › renders a directory into an output directory` | none | built (`--watch` untested) |
| FR-G02 | cli `src/commands/render.ts`, `src/exit.ts` | `cli.test.ts::render › reports planned formats with exit 64 and unknown ones as usage errors` | none | built |
| FR-G03 | cli `src/commands/render.ts`, `src/pipeline.ts` | `cli.test.ts::render › writes a standalone page with Mermaid copied to assets` | none | built |
| FR-G04 | cli `src/commands/validate.ts` | `cli.test.ts::validate › fails on errors and prints file:line diagnostics`; `::validate › passes clean docs, respects --rule and --strict, and emits JSON` | none; CI `ci.yml` step "examples validate with --strict" | built |
| FR-G05 | cli `src/io.ts` | `cli.test.ts::validate › emits GitHub annotations in Actions` | none | built |
| FR-G06 | cli `src/commands/validate.ts` (`runFormat`) | `cli.test.ts::format and toc › checks and writes formatting` | none | built |
| FR-G07 | cli `src/commands/validate.ts` (`runToc`) | `cli.test.ts::format and toc › inserts and refreshes a TOC idempotently` | none | built |
| FR-G08 | cli `src/commands/build.ts` | `cli.test.ts::build › builds a site with navigation, rewritten links and a search index` | none; CI determinism step builds the site twice and diffs | built |
| FR-G09 | cli `src/commands/serve.ts` | `cli.test.ts::serve API › serves rendered pages and refuses path traversal` | Rendered pages › The kitchen sink renders every block type; › In-page links navigate to their heading | verified (live reload untested) |
| FR-G10 | cli `src/commands/serve.ts` (`handleApi`) | `cli.test.ts::serve API › reports health`; `::serve API › renders sanitized HTML with diagrams and stats`; `::serve API › validates and rejects bad requests`; `::serve API lint option › adds rule diagnostics to a render when lint is true` | Preview server health (2 scenarios); Render API (12 scenarios incl. outline rows); Validate and stats API (3 scenarios) | verified (413, 404 and `BAD_JSON` not covered) |
| FR-G11 | cli `src/commands/diagram.ts` | `cli.test.ts::info commands › exports server-side diagrams as SVG` | none | built |
| FR-G12 | cli `src/commands/info.ts` (`runParse`) | `cli.test.ts::info commands › parse --outline, stats, diff and capabilities` | none | built |
| FR-G13 | cli `src/config.ts`, `src/flags.ts`, `src/pipeline.ts` (`mergeConfig`) | `cli.test.ts::validate › passes clean docs, respects --rule and --strict, and emits JSON` (flags); config file precedence has no dedicated test | none | built |
| FR-G14 | cli `src/commands/info.ts` (`runStats`, `runDiff`) | `cli.test.ts::info commands › parse --outline, stats, diff and capabilities` | none | built |
| FR-G15 | cli `src/commands/info.ts` (`CAPABILITIES`) | `cli.test.ts::info commands › parse --outline, stats, diff and capabilities` | Preview server health › Capabilities list built and planned features honestly | verified (studio, VS Code, React listed as planned, in progress) |
| FR-G16 | cli `src/commands/info.ts` (`runInit`) | `cli.test.ts::info commands › init writes a config and a sample` | none | built |
| FR-G17 | cli `src/exit.ts`, `src/index.ts` (`run`) | `cli.test.ts::render › reports planned formats with exit 64 and unknown ones as usage errors`; `::format and toc › checks and writes formatting` | none | built (exit 3 untested) |

## Non-functional requirements

| Req | Where | Test | SDODS | Status |
| --- | ----- | ---- | ----- | ------ |
| NFR-001 | core `src/render/html.ts`, `src/render/schema.ts` | `core.test.ts::security › neutralises …` (10) | Render API › Untrusted HTML is sanitized even when the caller asks otherwise; Rendered pages › Raw HTML in the source is sanitized in the page | verified |
| NFR-002 | core `src/render/html.ts` | `core.test.ts::security › keeps trusted code block output after sanitizing` | Render API › Graphviz, Blueprint and Mermaid diagrams render | verified |
| NFR-003 | diagrams `src/sanitize-svg.ts` | `diagrams.test.ts::sanitizeSvg › removes scripts, handlers, foreignObject and unsafe links` | none | built |
| NFR-004 | core `src/render/html.ts` | `core.test.ts::security › neutralises <a href="#" id="location">clobber</a>` | none | built |
| NFR-005 | diagrams `src/index.ts`, cli `src/pipeline.ts` | `diagrams.test.ts::providers › uses Kroki only when configured, and sanitizes its SVG` | none | built |
| NFR-006 | cli `src/commands/serve.ts` | `cli.test.ts::serve API › renders sanitized HTML with diagrams and stats`; `::serve API › serves rendered pages and refuses path traversal` | Preview server health › Health reports ok … (`nosniff` header); Render API › Untrusted HTML is sanitized even when the caller asks otherwise; › GET on a POST route is refused | verified (413 untested) |
| NFR-008 | `.github/workflows/ci.yml` job `gitleaks`, `security.yml` | CI | none | built |
| NFR-020 – NFR-024 | none | none | none | targets; benchmarks planned |
| NFR-030 – NFR-031 | core, highlight, diagrams, themes | `core.test.ts::render html › inserts a table of contents at [[toc]]`; `core.test.ts::labels task list checkboxes for screen readers`; `highlight.test.ts::highlightHandler › highlights with dual themes, title, copy button and highlighted lines`; `themes.test.ts::wrapDocument › builds an accessible standalone page` | Playground › The playground is accessible; Rendered pages › The page structure is accessible | verified |
| NFR-032 | themes `src/css.ts` | none | Playground › The playground is accessible; Rendered pages › The page structure is accessible (axe-core, impact serious or worse; light theme) | verified for light theme; dark theme contrast not checked by axe |
| NFR-040 | core, diagrams, cli | `core.test.ts::render html › is deterministic`; `diagrams.test.ts::providers › renders Blueprint to deterministic SVG` | none; CI `ci.yml` step "rendering is deterministic" (`diff -r` of two runs of render, ast and build) | built |
| NFR-041 | core `src/serialize.ts`, cli `runToc` | `core.test.ts::serialize › keeps a TOC block idempotent`; `cli.test.ts::format and toc › inserts and refreshes a TOC idempotently` | none | built |
| NFR-050 – NFR-051 | root `package.json`, CI | CI `ci.yml` runs on Node 22 and Bun 1.4.0 | none | built |
| NFR-052 | core, highlight, diagrams, themes | grep for `node:` imports (manual, 2026-10-20) | Studio (planned; first browser use of the core) | built, not tested in a browser |
| NFR-062 | cli `src/io.ts` | `cli.test.ts::validate › emits GitHub annotations in Actions` | none | built |
| NFR-080 | root scripts, `ci.yml` job `test` | CI | none | built |
| NFR-082 | core `src/version.ts` | `core.test.ts::VERSION matches package.json` | Preview server health › Health reports ok with the product name and version | verified |

## SDODS scenarios

Repository `YarlisAISolutions/markupme-qa` (PRs #1 and #2 merged), project `markupme`, environment `local` against `markupme serve examples --port 4321`. Custom steps for diagrams and the TOC live in `projects/markupme/pages/PreviewPage.ts` (`the page should show a rendered {string} diagram`, `the Mermaid diagram should finish rendering`, `the table of contents should link to {string}`). The suites run in this repository's `ci.yml` job `e2e` and in markupme-qa's own `e2e.yml` (also nightly), and `scripts/qa-gate.mjs` fails a run with fewer than 15 api or 10 ui scenarios.

| Feature file | Feature | Tags | Scenarios | Phase | Status |
| ------------ | ------- | ---- | --------- | ----- | ------ |
| `00-probes/health.feature` | Preview server health | `@api @smoke @probes` | Health reports ok with the product name and version; Capabilities list built and planned features honestly | PR#1 | passing |
| `01-render/render-api.feature` | Render API | `@api @render` (`@smoke`, `@regression`, `@diagrams`, `@security`, `@negative`) | GitHub Flavored Markdown renders tables, task lists and strikethrough; Footnotes, alerts, directives and heading ids render; A table of contents is generated on request; Graphviz, Blueprint and Mermaid diagrams render; A broken diagram is reported, not crashed on; Untrusted HTML is sanitized even when the caller asks otherwise; Other output formats: markdown / text / ast (outline, 3 rows); A body without markdown is rejected; Planned formats answer 501 instead of pretending; GET on a POST route is refused | PR#1 | passing |
| `02-validate/validate-api.feature` | Validate and stats API | `@api @validate` | Broken links, skipped headings and missing alt text are reported; A clean document passes; Stats count words, headings, tasks and code languages | PR#1 | passing |
| `03-playground/playground.feature` | Playground | `@ui @playground` (`@a11y`, `@dark`) | The playground loads with a rendered sample; Typing updates the preview; Problems show up as diagnostics; The playground is accessible; The theme toggle switches to dark mode | PR#1 | passing |
| `04-pages/rendered-pages.feature` | Rendered pages | `@ui @pages` (`@diagrams`, `@security`, `@a11y`) | The kitchen sink renders every block type; Server-side and browser diagrams render; Raw HTML in the source is sanitized in the page; The page structure is accessible; In-page links navigate to their heading | PR#1 | passing |
| (to write) | Studio | `@ui @studio` | Modes, outline jump, command palette, autosave restore, export | PR#2 | planned |
| (to write) | VS Code extension, React component | n/a (extension and package tests) | Preview, diagnostics, export; React render without script | PR#3 | planned |

Gaps in end-to-end coverage today: HTTP 413, 404 and `BAD_JSON` errors; `/api/render` with `lint: true` (covered indirectly by the playground diagnostics scenario); math and emoji; dark-theme contrast; Kroki.
