# Functional requirements: MarkupMe

- Date: 2026-10-20
- Related: [PRD](PRD.md) · [NFR](NFR.md) · [Acceptance criteria](acceptance-criteria.md) · [Traceability](../implementation/requirements-traceability.md)

Requirement IDs are `FR-<module><nn>`. Modules follow the brief: A engine, B document model, C rendering, D editing, E diagrams, F SDK, G CLI. "Shall" is mandatory. Status:

- **built**: in the repository and covered by a unit test.
- **in progress**: being built; no test results yet. (All Phase 1 editor items are now built.)
- **planned**: later phase; the CLI exits 64 or the API returns 501 where applicable.

## A. Engine

| ID | Requirement | Status |
| -- | ----------- | ------ |
| FR-A01 | The engine shall parse CommonMark through `remark-parse` (micromark). | built |
| FR-A02 | The engine shall support GFM tables, task lists, strikethrough, autolinks and footnotes, on by default and switchable off (`gfm: false`, `--no-gfm`). | built |
| FR-A03 | The engine shall read YAML (`---`) and TOML (`+++`) frontmatter into `doc.frontmatter`. Invalid frontmatter, or frontmatter that is not a mapping, shall produce `MM010` (error) and never throw. | built |
| FR-A04 | The engine shall recognize the GitHub alerts `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION` (case-insensitive) and render them as `markdown-alert` boxes with a title. | built |
| FR-A05 | The engine shall support container directives `note tip info important warning caution danger success details figure columns column`, text directives `kbd abbr mark sub sup badge` and leaf directives `toc br`. | built |
| FR-A06 | Unknown directives shall be kept, rendered as `mm-directive-<name>` elements and reported as `MM009` (warning). A text directive with no label and no attributes (for example `10:30`) shall stay plain text. | built |
| FR-A07 | Every heading shall get a GitHub-compatible id. Duplicates shall get numeric suffixes and an `MM003` warning. A trailing `{#custom-id}` shall set the id and be removed from the heading text. | built |
| FR-A08 | The engine shall replace `[[toc]]`, `[toc]`, `::toc` and `<!-- toc -->…<!-- tocstop -->` (or `<!-- /toc -->`) with a generated TOC of levels `minDepth`–`maxDepth` (default 2–3). With `position: 'top'` or `'after-title'` it shall insert a TOC when no marker exists and the TOC is not empty. | built |
| FR-A09 | `$…$` and `$$…$$` math shall be parsed and rendered with KaTeX when `math: true`; off by default. Bad TeX shall not fail the render. | built |
| FR-A10 | GitHub `:shortcode:` emoji shall be replaced at render time when `emoji: true`; off by default. Unknown shortcodes stay as written. | built |
| FR-A11 | Every mdast node shall carry its source position; diagnostics shall carry line and column when known. | built |
| FR-A12 | Custom syntax shall be addable through `MarkupMePlugin.remarkPlugins`, applied to both the parser and the serializer. | built |
| FR-A13 | Each feature switch (`gfm`, `frontmatter`, `directives`, `alerts`, `math`, `emoji`, `headingIds`, `toc`) shall work independently of the others. | built |
| FR-A14 | The engine shall offer a streaming (incremental) parse interface. | planned |

## B. Document model

| ID | Requirement | Status |
| -- | ----------- | ------ |
| FR-B01 | `parse` shall return a `MarkupMeDocument` with `type: 'markupme-document'`, `schemaVersion` (currently 1), the unchanged `source`, optional `file`, an mdast `tree`, optional `frontmatter` and `diagnostics`. | built |
| FR-B02 | Parse-time transforms shall be data-preserving: information goes into `data` fields or a `toc` node, never into presentation-shaped nodes. Presentation transforms (alerts, directives, emoji, plugin `render`) shall run on a clone during rendering. | built |
| FR-B03 | `serialize` shall write Markdown that keeps GFM, frontmatter, directives, alerts (`> [!NOTE]` unescaped), `{#custom}` ids and TOC markers, with configurable bullet, emphasis and fence characters. | built |
| FR-B04 | `serialize(doc, { format: 'json' })` shall write the document without `source`, including `schemaVersion`. | built |
| FR-B05 | `roundTrip(doc)` shall report whether serialize-then-parse keeps the tree (ignoring positions) and add `MM031` (info) when it does not. | built |
| FR-B06 | The SDK shall provide `query(tree, type \| predicate)`, `visit`, `outline(tree)` and `stripPositions`. | built |
| FR-B07 | `diff(a, b)` shall return block-level changes (`added`, `removed`, `changed`) with index, type, previews and line. | built |
| FR-B08 | `stats(tree)` shall return words, characters, reading minutes (230 wpm, minimum 1), headings, paragraphs, links, images, tables, code blocks, footnotes, task totals and code languages. | built |
| FR-B09 | `validate` shall run the built-in rules MM001, MM002, MM004, MM005, MM006, MM008, MM012, MM013, MM015, MM016 and include parse diagnostics, sorted by line and column. Severities shall be overridable by rule name or code, including `off`. | built |
| FR-B10 | Plugins shall be able to add lint rules, which `validate` runs and `rules()` lists. | built |
| FR-B11 | Local file links (MM012) shall be checked only through an injected `fileExists` function; the core shall not access the filesystem. | built |
| FR-B12 | `transform(doc, { plugins })` shall return a new document (the input unchanged) and support the built-ins `toc` and `normalize` and plugin `parse` hooks. | built |
| FR-B13 | Stable semantic node ids and source maps from output back to source. | planned |

## C. Rendering

| ID | Requirement | Status |
| -- | ----------- | ------ |
| FR-C01 | HTML output shall be sanitized by default with `markupmeSchema` (GitHub schema plus MarkupMe tags, ARIA attributes and a class allowlist). | built |
| FR-C02 | `allowHtml: false` shall drop raw HTML. `sanitize: false` shall keep raw HTML and must be set explicitly. | built |
| FR-C03 | `render` shall support `html`, `markdown`, `ast` and `text` formats. An unknown format shall throw `MarkupMeError` code `MM_FORMAT`. | built |
| FR-C04 | Code block handler output shall be inserted after sanitizing through random-nonce slots, and only ids MarkupMe generated shall lose the `user-content-` prefix. | built |
| FR-C05 | The renderer shall support heading anchors (`anchors`), lazy images (default on), `baseUrl` resolution, `externalLinksNewTab` (`target="_blank" rel="noopener noreferrer"`) and an accessible name on task list checkboxes (`Completed task: …` / `Open task: …`). | built |
| FR-C06 | Syntax highlighting (`@markupme/highlight`) shall use dual light/dark themes and support fence meta `title=`/`filename=`, `{ranges}`, `showLineNumbers`/`lineNumbers`/`linenums`, `startLine=`. Unknown languages shall be escaped as plain text. | built |
| FR-C07 | Highlighted blocks shall have a copy button with an accessible name, unless `copyButton: false`. | built |
| FR-C08 | `wrapDocument` shall produce a complete HTML5 page with `lang`, viewport, title, optional description, light/dark/auto theme, print styles, a theme toggle, optional navigation, and the runtime script unless `runtime: false`. | built |
| FR-C09 | `render` shall return the document title (frontmatter `title`, else the first h1). | built |
| FR-C10 | Rendering the same input with the same options shall produce identical output. | built |
| FR-C11 | A React component (`@markupme/react`) shall render a document as React elements with the same sanitizing rules. | built |
| FR-C12 | PDF output. | planned |
| FR-C13 | DOCX output. | planned |
| FR-C14 | MDX output, with execution disabled for untrusted documents. | planned |
| FR-C15 | Plugin `rehype` hooks shall run on the hast tree before raw HTML is parsed and the tree is sanitized, so their output is sanitized too. | built (being merged with its test) |

## D. Editing

| ID | Requirement | Status |
| -- | ----------- | ------ |
| FR-D01 | `markupme serve` shall offer a playground at `/__markupme/playground`: a Markdown textarea, TOC/math/emoji/line-number options, a render button, a live preview and a diagnostics list, all with `data-testid` hooks. | built |
| FR-D02 | The studio (`apps/studio`) shall provide a CodeMirror 6 source editor with Markdown highlighting. | built |
| FR-D03 | The studio shall offer source, split and preview modes. | built |
| FR-D04 | The studio shall show a document outline from `outline()` and jump to a heading on click. | built |
| FR-D05 | The studio shall have a command palette. | built |
| FR-D06 | The studio shall autosave to local browser storage and restore on reload. | built |
| FR-D07 | The studio shall export HTML and Markdown. | built |
| FR-D08 | The VS Code extension shall show a preview in a webview rendered with `@markupme/core`, including diagrams. | built |
| FR-D09 | The VS Code extension shall offer commands to export HTML, insert a TOC and format the document. | built |
| FR-D10 | The VS Code extension shall publish `validate` diagnostics to the Problems panel. | built |
| FR-D11 | Rich-text (WYSIWYG) editing, chosen by the criteria in ADR 0007. | planned |
| FR-D12 | VS Code Marketplace listing. | built |

## E. Diagrams

| ID | Requirement | Status |
| -- | ----------- | ------ |
| FR-E01 | `@markupme/diagrams` shall define a `DiagramProvider` interface (`id`, `langs`, `mode`, `remote?`, `render`) so renderers can be added without engine changes. | built |
| FR-E02 | Yarlis Blueprint (`ybp`, `blueprint`, `blueprint-yaml`) shall render to SVG on the server via `@bpview/core`. | built |
| FR-E03 | Graphviz (`dot`, `graphviz`) shall render to SVG via WebAssembly with no system binary. | built |
| FR-E04 | Mermaid shall be emitted as `<pre class="mermaid">` with escaped source and rendered in the browser by the page runtime with `securityLevel: 'strict'`. | built |
| FR-E05 | Kroki types (PlantUML, C4-PlantUML, Structurizr, D2 and others in `KROKI_TYPES`) shall render only when a server URL is configured, with a 15 s default timeout. | built |
| FR-E06 | Every server-rendered SVG shall pass through `sanitizeSvg` before insertion or export. | built |
| FR-E07 | A failing diagram shall produce an inline error box with the message and source, plus an `MM040` error diagnostic, without failing the render. | built |
| FR-E08 | Diagram results shall be cached by SHA-256 of provider, theme, language and source, with a size limit (default 200). | built |
| FR-E09 | `markupme diagram -o` shall export each diagram as SVG; Mermaid export shall use headless Chromium when `playwright` is installed and exit 64 when it is not. | built |
| FR-E10 | `extractDiagrams` shall list diagram blocks with index, language, provider, source and line. | built |
| FR-E11 | PNG export. | planned |

## F. SDK

| ID | Requirement | Status |
| -- | ----------- | ------ |
| FR-F01 | Each package shall be independently publishable under `@markupme`, ESM-only, with TypeScript declarations and `sideEffects: false`. | built |
| FR-F02 | `createProcessor(options)` shall create an isolated processor with frozen options; there shall be no global plugin registry. | built |
| FR-F03 | Module-level `parse`, `render`, `transform`, `serialize`, `validate` shall use a shared default processor. | built |
| FR-F04 | Plugins (`MarkupMePlugin`) shall be able to add remark plugins, `parse` and `render` hooks, lint rules and a code block handler. | built |
| FR-F05 | Code block handlers shall run plugin handlers first, then `RenderOptions.codeBlocks`; the first result wins; a throwing handler shall produce `MM020` and leave the block as code. | built |
| FR-F06 | Diagnostics shall have the stable shape `{ code, rule, severity, message, file?, line?, column?, endLine?, endColumn? }`; `formatDiagnostic` shall print `file:line:col severity code message (rule)`. | built |
| FR-F07 | `@markupme/core` shall export a `VERSION` constant equal to its `package.json` version (and the CLI reports it with `--version`). | built |

## G. CLI

| ID | Requirement | Status |
| -- | ----------- | ------ |
| FR-G01 | `markupme render` shall render files, directories or stdin to `html`, `md`, `ast` or `text`, to stdout or `-o`, with `--standalone`, `--strict`, `--json`, `--quiet` and `--watch`. | built |
| FR-G02 | `render -f pdf\|docx\|mdx` shall exit 64 with a message pointing to `markupme capabilities`; unknown formats shall exit 2. | built |
| FR-G03 | Standalone pages with Mermaid or math shall get local assets (copied to `--assets-dir` or `<output>/assets`, or inlined with `--inline-assets`); a remote Mermaid URL only with `--mermaid-url`. | built |
| FR-G04 | `markupme validate` (`lint`) shall lint files and folders, check local links (unless `--no-check-links`), optionally check diagrams, support `--rule`, `--strict`, `--json`, `--quiet`, and exit 1 on errors. | built |
| FR-G05 | Inside GitHub Actions the CLI shall print `::error`/`::warning` annotations for diagnostics. | built |
| FR-G06 | `markupme format` (`fmt`) shall print, `--write` or `--check` normalized Markdown; `--check` exits 1 when a file would change. | built |
| FR-G07 | `markupme toc` shall insert or refresh a TOC between `<!-- toc -->` markers; `--write` and `--check`; idempotent. | built |
| FR-G08 | `markupme build` shall create a static site: one page per Markdown file, `README.md` as `index.html`, `.md` links rewritten to `.html`, sidebar navigation, `search-index.json` with a search box, shared CSS, copied images. | built |
| FR-G09 | `markupme serve` shall serve rendered pages with live reload (SSE), a diagnostics banner, the playground, local Mermaid and KaTeX assets, and block path traversal (403). | built |
| FR-G10 | The serve API shall provide `GET /api/health`, `GET /api/capabilities`, `POST /api/render` (with an optional `lint: true` that adds rule diagnostics), `POST /api/validate`, `POST /api/stats` with JSON errors (400, 404, 405, 413, 500, 501). | built |
| FR-G11 | `markupme diagram` shall list or export diagrams (see FR-E09). | built |
| FR-G12 | `markupme parse` shall print the JSON document or `--outline`, with `--no-positions`. | built |
| FR-G13 | All commands shall share `markupme.config.json` and the feature flags; precedence is defaults < file < flags the user typed. | built |
| FR-G14 | `markupme stats` and `markupme diff` shall print human or `--json` output; `diff` exits 1 when files differ. | built |
| FR-G15 | `markupme capabilities` shall list every feature as built, opt-in or planned, plus the lint rules, as text or `--json`. Work in progress is listed as planned with an `in progress` note. | built |
| FR-G16 | `markupme init` shall write a config and a sample document, refusing to overwrite without `--force`. | built |
| FR-G17 | Exit codes shall be 0 OK, 1 invalid, 2 usage, 3 failure, 64 unsupported, and stable across releases. | built |
