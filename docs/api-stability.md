# API stability

What MarkupMe 1.0 promises not to break, and how CI holds it to that. MarkupMe follows [Semantic Versioning](https://semver.org/): from 1.0.0 on, a minor or patch release never removes or renames a **stable** item or changes its meaning. A breaking change to a stable item needs a new major version and a CHANGELOG entry.

**Experimental** items are built and tested but may change, or go away, in a minor release. Use them, but pin the exact version. They become stable in a minor release once their shape has settled.

Not covered at all: anything not listed here, such as files under `dist/` other than the package entry points, the HTML class names and CSS custom properties of the themes (beyond `markupmeCss` itself), the `markupme serve` playground page, the VS Code extension's settings (it is versioned on its own) and the MarkupMe Studio app.

## How it is checked

| Check | Where | Fails when |
| ----- | ----- | ---------- |
| API surface snapshot | [`test/api-surface.test.ts`](../test/api-surface.test.ts) against [`api/exports.snapshot.json`](../api/exports.snapshot.json), in `bun run test` | A stable export, command, alias, argument or flag (or a flag's default) is removed or renamed without a major version bump; an exit code, diagnostic code or `SCHEMA_VERSION` changes; a new export or flag is not classified yet; an experimental export sits in a package root, or a stable one in an `experimental` entry. The message names the item. |
| Doc and snapshot agree | the same test file | An export or command in the snapshot has no row below, or its row has a different status. |
| Type contract | each package's `test/contract.test.ts`, in `bun run type-check` and `bun run test` | A stable type is removed or loses the property its row relies on. |
| Capabilities | [`packages/cli/test/cli.test.ts`](../packages/cli/test/cli.test.ts) › capabilities marks experimental features as experimental | `markupme capabilities` stops marking experimental features. |

The snapshot lists everything each package's entry point exports (values from the built module, types from its `.d.ts`), every `markupme` command with its aliases, arguments and flags (with defaults), the exit codes, the diagnostic codes and `SCHEMA_VERSION`. Descriptions and help text are not part of it and can change freely.

### Changing the API

- **Adding** an export, command or flag: run `bun run api:update` after `bun run build`. The new item is recorded as `experimental`. Add its row below. A new export belongs in the package root only when it is stable: change its status in `api/exports.snapshot.json` and in its row, and link a test. An experimental export goes in the package's `src/experimental.ts` (`<package>/experimental`).
- **Promoting** an experimental export to stable: export it from the package root as well, run `bun run api:update`, change its root status in both places and link its test. You may keep the `experimental` export for one more minor release so existing imports keep working; removing it after that is an experimental removal. Allowed in a minor release.
- **Removing or renaming** an experimental item: run `bun run api:update` and update the row. Allowed in a minor release; say so in the CHANGELOG.
- **Removing or renaming** a stable item: only with a major version bump. Bump the versions first (they are pinned together, see `CLAUDE.md`), then run `bun run api:update`; before the bump it refuses and lists what was removed.

## Contracts outside the exports

| Contract | Status | Defined in | Test |
| -------- | ------ | ---------- | ---- |
| Exit codes 0 `OK`, 1 `INVALID`, 2 `USAGE`, 3 `FAILURE`, 64 `UNSUPPORTED` | stable | [`packages/cli/src/exit.ts`](../packages/cli/src/exit.ts), [CLI guide](guide/cli.md#exit-codes) | [contract.test.ts › EXIT codes are fixed](../packages/cli/test/contract.test.ts) |
| Diagnostic codes `MM001` to `MM016` and the `Diagnostic` shape | stable | [`packages/core/src/validate.ts`](../packages/core/src/validate.ts), [`types.ts`](../packages/core/src/types.ts) | [contract.test.ts › RULES have stable MM codes and markupmeSchema is a sanitize schema](../packages/core/test/contract.test.ts) |
| Document model `MarkupMeDocument` with `schemaVersion: 1` (new fields stay optional) | stable | [ADR 0004](architecture/architecture-decision-records/0004-document-model.md) | [core.test.ts › writes JSON AST with the schema version](../packages/core/test/core.test.ts) |
| Sanitize by default (`sanitize: true` everywhere) | stable | [ADR 0003](architecture/architecture-decision-records/0003-sanitize-by-default.md) | [core.test.ts › allows raw HTML only when sanitize is explicitly off](../packages/core/test/core.test.ts) |
| `markupme.config.json` keys: `gfm`, `frontmatter`, `directives`, `alerts`, `math`, `emoji`, `headingIds`, `toc`, `render.{sanitize, allowHtml, anchors, highlight, lineNumbers, theme, baseUrl, externalLinksNewTab}`, `diagrams.{providers, server}`, `rules`, `site.{name, exclude}` | stable | [`packages/cli/src/config.ts`](../packages/cli/src/config.ts), [CLI guide](guide/cli.md#configuration-file) | [cli.test.ts › init writes a config and a sample](../packages/cli/test/cli.test.ts) |
| Serve API: `GET /api/health`, `GET /api/capabilities`, `POST /api/render` (with `lint`), `POST /api/validate`, `POST /api/stats`; planned formats answer 501 | stable | [`packages/cli/src/commands/serve.ts`](../packages/cli/src/commands/serve.ts) | [cli.test.ts › renders sanitized HTML with diagrams and stats](../packages/cli/test/cli.test.ts), and the markupme-qa api suite |
| `markupme capabilities --json` shape `{ name, version, capabilities: [{ area, feature, status, note? }], rules }`; `status` is one of `built`, `experimental`, `opt-in`, `planned` | stable | [`packages/cli/src/commands/info.ts`](../packages/cli/src/commands/info.ts) | [cli.test.ts › capabilities marks experimental features as experimental](../packages/cli/test/cli.test.ts) |
| Structural diff output (`diff()` from `@markupme/core/experimental`, `markupme diff`) | experimental | [`packages/core/src/util.ts`](../packages/core/src/util.ts) | [core.test.ts › diffs block structure](../packages/core/test/core.test.ts) |

## Why these are experimental

The split, accepted on 2026-11-03 (MKP-3):

- **`diff` and `BlockChange` in core, `markupme diff`**: the block-level change model (`added`, `removed`, `changed` with line numbers) is young, and a word-level or move-aware diff would change its shape.
- **`@markupme/diagrams` plumbing** (`providersFromIds`, `codeBlockHandlers`, `extractDiagrams` and their types): helpers the CLI and the VS Code extension share. Their option objects are still growing. `diagramHandler` and the providers are the stable way in.
- **`@markupme/react` low-level helpers** (`renderToTree`, `treeToReact`, `htmlToReact`, `MarkdownTree`): they expose the hast tree, which ties callers to the hast version. `<Markdown>`, `useMarkdown` and `renderToReact` are the stable way in.
- **`@markupme/cli` programmatic API** (`createPipeline`, `mergeConfig`, `renderPage`, `startServer`, `CAPABILITIES`): the command line is the CLI's contract; these Node functions follow its internals. `run`, `EXIT`, `CliError` and `Io` are stable.
- **MarkupMe Studio** shows as experimental in `markupme capabilities`; it is not published.

Since 0.2.0 (unreleased; 0.1.1 is a security patch without this change), experimental exports live behind each package's `experimental` subpath (`@markupme/core/experimental`, `@markupme/diagrams/experimental`, `@markupme/react/experimental`, `@markupme/cli/experimental`), so an import says what it relies on. The package roots export stable items only, and the API surface test fails when an item sits in the wrong one. CLI commands and flags stay top-level (`markupme diff`); they are marked in `markupme capabilities` and below (MKP-6).

## Exports and commands

Status per item. Types are checked at compile time by each package's `contract.test.ts` (or by the behaviour test linked in their row).

### `@markupme/core`

| Export | Status | Kind | Test |
| ------ | ------ | ---- | ---- |
| `ALERT_TITLES` | stable | value | [contract.test.ts › alert constants list the five GitHub alert types with titles](../packages/core/test/contract.test.ts) |
| `ALERT_TYPES` | stable | value | [contract.test.ts › alert constants list the five GitHub alert types with titles](../packages/core/test/contract.test.ts) |
| `AlertType` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `BuiltinTransform` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `CALLOUTS` | stable | value | [contract.test.ts › directive constants name the built-in directives](../packages/core/test/contract.test.ts) |
| `CONTAINERS` | stable | value | [contract.test.ts › directive constants name the built-in directives](../packages/core/test/contract.test.ts) |
| `CodeBlock` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `CodeBlockHandler` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `CodeBlockResult` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `Diagnostic` | stable | type | [contract.test.ts › formatDiagnostic prints file, line, code and message](../packages/core/test/contract.test.ts) |
| `DocumentStats` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `LEAF_DIRECTIVES` | stable | value | [contract.test.ts › directive constants name the built-in directives](../packages/core/test/contract.test.ts) |
| `MarkupMeDocument` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `MarkupMeError` | stable | value | [contract.test.ts › MarkupMeError carries a code](../packages/core/test/contract.test.ts) |
| `MarkupMePlugin` | stable | type | [core.test.ts › accepts plugin rules](../packages/core/test/core.test.ts) |
| `OutlineItem` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `ParseOptions` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `PluginContext` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `Processor` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `ProcessorOptions` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `RULES` | stable | value | [contract.test.ts › RULES have stable MM codes and markupmeSchema is a sanitize schema](../packages/core/test/contract.test.ts) |
| `RenderFormat` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `RenderOptions` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `RenderResult` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `Rule` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `RuleContext` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `RuleSetting` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `SCHEMA_VERSION` | stable | value | [core.test.ts › writes JSON AST with the schema version](../packages/core/test/core.test.ts) |
| `SerializeFormat` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `SerializeOptions` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `Severity` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `TEXT_DIRECTIVES` | stable | value | [contract.test.ts › directive constants name the built-in directives](../packages/core/test/contract.test.ts) |
| `TocNode` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `TocOptions` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `Toml` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `TransformOptions` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `TransformResult` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `VERSION` | stable | value | [core.test.ts › VERSION matches package.json](../packages/core/test/core.test.ts) |
| `ValidateOptions` | stable | type | [contract.test.ts › exports the stable types](../packages/core/test/contract.test.ts) |
| `buildToc` | stable | value | [contract.test.ts › buildToc, insertToc and headingId work on a parsed tree](../packages/core/test/contract.test.ts) |
| `createProcessor` | stable | value | [core.test.ts › is isolated per processor](../packages/core/test/core.test.ts) |
| `escapeHtml` | stable | value | [core.test.ts › escapes the five HTML-special characters as numeric references](../packages/core/test/core.test.ts) |
| `formatDiagnostic` | stable | value | [contract.test.ts › formatDiagnostic prints file, line, code and message](../packages/core/test/contract.test.ts) |
| `headingId` | stable | value | [contract.test.ts › buildToc, insertToc and headingId work on a parsed tree](../packages/core/test/contract.test.ts) |
| `insertToc` | stable | value | [contract.test.ts › buildToc, insertToc and headingId work on a parsed tree](../packages/core/test/contract.test.ts) |
| `markupmeSchema` | stable | value | [contract.test.ts › RULES have stable MM codes and markupmeSchema is a sanitize schema](../packages/core/test/contract.test.ts) |
| `outline` | stable | value | [core.test.ts › gives headings GitHub-style ids and honours {#custom}](../packages/core/test/core.test.ts) |
| `parse` | stable | value | [core.test.ts › produces a versioned document with positions](../packages/core/test/core.test.ts) |
| `query` | stable | value | [core.test.ts › is isolated per processor](../packages/core/test/core.test.ts) |
| `render` | stable | value | [core.test.ts › renders CommonMark and GFM](../packages/core/test/core.test.ts) |
| `serialize` | stable | value | [core.test.ts › round-trips the kitchen sink without loss](../packages/core/test/core.test.ts) |
| `stats` | stable | value | [core.test.ts › counts words, tasks and languages](../packages/core/test/core.test.ts) |
| `stripPositions` | stable | value | [contract.test.ts › stripPositions and visit walk the tree](../packages/core/test/contract.test.ts) |
| `transform` | stable | value | [core.test.ts › adds a TOC after the title on request](../packages/core/test/core.test.ts) |
| `validate` | stable | value | [core.test.ts › finds structural, link and accessibility problems](../packages/core/test/core.test.ts) |
| `visit` | stable | value | [contract.test.ts › stripPositions and visit walk the tree](../packages/core/test/contract.test.ts) |

### `@markupme/core/experimental`

| Export | Status | Kind | Test |
| ------ | ------ | ---- | ---- |
| `BlockChange` | experimental | type | [core.test.ts › diffs block structure](../packages/core/test/core.test.ts) |
| `diff` | experimental | value | [core.test.ts › diffs block structure](../packages/core/test/core.test.ts) |

### `@markupme/highlight`

| Export | Status | Kind | Test |
| ------ | ------ | ---- | ---- |
| `CodeMeta` | stable | type | [contract.test.ts › exports the stable types](../packages/highlight/test/contract.test.ts) |
| `HighlightOptions` | stable | type | [contract.test.ts › exports the stable types](../packages/highlight/test/contract.test.ts) |
| `escapeHtml` | stable | value | [contract.test.ts › escapeHtml escapes markup](../packages/highlight/test/contract.test.ts) |
| `highlightHandler` | stable | value | [highlight.test.ts › highlights with dual themes, title, copy button and highlighted lines](../packages/highlight/test/highlight.test.ts) |
| `parseMeta` | stable | value | [highlight.test.ts › reads titles, ranges and line numbers](../packages/highlight/test/highlight.test.ts) |

### `@markupme/diagrams`

| Export | Status | Kind | Test |
| ------ | ------ | ---- | ---- |
| `DiagramError` | stable | value | [contract.test.ts › DiagramError carries the source line](../packages/diagrams/test/contract.test.ts) |
| `DiagramHandler` | stable | type | [diagrams.test.ts › puts diagrams first and hands their languages to the next handler](../packages/diagrams/test/diagrams.test.ts) |
| `DiagramOptions` | stable | type | [contract.test.ts › exports the stable types](../packages/diagrams/test/contract.test.ts) |
| `DiagramOutput` | stable | type | [contract.test.ts › exports the stable types](../packages/diagrams/test/contract.test.ts) |
| `DiagramProvider` | stable | type | [diagrams.test.ts › passes the theme to the diagram handler](../packages/diagrams/test/diagrams.test.ts) |
| `DiagramRequest` | stable | type | [contract.test.ts › exports the stable types](../packages/diagrams/test/contract.test.ts) |
| `DiagramTheme` | stable | type | [contract.test.ts › exports the stable types](../packages/diagrams/test/contract.test.ts) |
| `KROKI_TYPES` | stable | value | [contract.test.ts › KROKI_TYPES maps fence languages to Kroki types](../packages/diagrams/test/contract.test.ts) |
| `KrokiOptions` | stable | type | [contract.test.ts › exports the stable types](../packages/diagrams/test/contract.test.ts) |
| `MERMAID_LANGS` | stable | value | [contract.test.ts › the built-in providers have fixed ids, languages and modes](../packages/diagrams/test/contract.test.ts) |
| `blueprintProvider` | stable | value | [contract.test.ts › the built-in providers have fixed ids, languages and modes](../packages/diagrams/test/contract.test.ts) |
| `defaultProviders` | stable | value | [contract.test.ts › the built-in providers have fixed ids, languages and modes](../packages/diagrams/test/contract.test.ts) |
| `diagramHandler` | stable | value | [diagrams.test.ts › renders Blueprint to deterministic SVG](../packages/diagrams/test/diagrams.test.ts) |
| `graphvizProvider` | stable | value | [contract.test.ts › the built-in providers have fixed ids, languages and modes](../packages/diagrams/test/contract.test.ts) |
| `krokiProvider` | stable | value | [diagrams.test.ts › uses Kroki only when configured, and sanitizes its SVG](../packages/diagrams/test/diagrams.test.ts) |
| `mermaidProvider` | stable | value | [contract.test.ts › mermaid renders a client placeholder with escaped source](../packages/diagrams/test/contract.test.ts) |
| `sanitizeSvg` | stable | value | [diagrams.test.ts › removes scripts, handlers, foreignObject and unsafe links](../packages/diagrams/test/diagrams.test.ts) |

### `@markupme/diagrams/experimental`

| Export | Status | Kind | Test |
| ------ | ------ | ---- | ---- |
| `CodeBlockHandlerOptions` | experimental | type | [diagrams.test.ts › puts diagrams first and hands their languages to the next handler](../packages/diagrams/test/diagrams.test.ts) |
| `ExtractedDiagram` | experimental | type | [diagrams.test.ts › extracts diagram blocks](../packages/diagrams/test/diagrams.test.ts) |
| `ProviderProblem` | experimental | type | [diagrams.test.ts › reports unknown ids and kroki without a server, in order](../packages/diagrams/test/diagrams.test.ts) |
| `ProvidersFromIds` | experimental | type | [diagrams.test.ts › reports unknown ids and kroki without a server, in order](../packages/diagrams/test/diagrams.test.ts) |
| `codeBlockHandlers` | experimental | value | [diagrams.test.ts › puts diagrams first and hands their languages to the next handler](../packages/diagrams/test/diagrams.test.ts) |
| `extractDiagrams` | experimental | value | [diagrams.test.ts › extracts diagram blocks](../packages/diagrams/test/diagrams.test.ts) |
| `providersFromIds` | experimental | value | [diagrams.test.ts › reports unknown ids and kroki without a server, in order](../packages/diagrams/test/diagrams.test.ts) |

### `@markupme/themes`

| Export | Status | Kind | Test |
| ------ | ------ | ---- | ---- |
| `DocumentOptions` | stable | type | [contract.test.ts › exports the stable types](../packages/themes/test/contract.test.ts) |
| `NavItem` | stable | type | [contract.test.ts › exports the stable types](../packages/themes/test/contract.test.ts) |
| `ThemeMode` | stable | type | [contract.test.ts › exports the stable types](../packages/themes/test/contract.test.ts) |
| `escapeHtml` | stable | value | [contract.test.ts › escapeHtml escapes markup](../packages/themes/test/contract.test.ts) |
| `markupmeCss` | stable | value | [themes.test.ts › ships light, dark and print styles](../packages/themes/test/themes.test.ts) |
| `runtimeScript` | stable | value | [themes.test.ts › builds an accessible standalone page](../packages/themes/test/themes.test.ts) |
| `wrapDocument` | stable | value | [themes.test.ts › builds an accessible standalone page](../packages/themes/test/themes.test.ts) |

### `@markupme/react`

| Export | Status | Kind | Test |
| ------ | ------ | ---- | ---- |
| `Markdown` | stable | value | [hook.test.ts › renders after the first effect, with component overrides](../packages/react/test/hook.test.ts) |
| `MarkdownComponents` | stable | type | [contract.test.ts › exports the stable types](../packages/react/test/contract.test.ts) |
| `MarkdownOptions` | stable | type | [contract.test.ts › exports the stable types](../packages/react/test/contract.test.ts) |
| `MarkdownProps` | stable | type | [contract.test.ts › exports the stable types](../packages/react/test/contract.test.ts) |
| `renderToReact` | stable | value | [render.test.ts › renders GFM](../packages/react/test/render.test.ts) |
| `useMarkdown` | stable | value | [hook.test.ts › re-renders when the source changes, with inline options](../packages/react/test/hook.test.ts) |

### `@markupme/react/experimental`

| Export | Status | Kind | Test |
| ------ | ------ | ---- | ---- |
| `MarkdownTree` | experimental | type | [render.test.ts › returns the tree with diagnostics and title](../packages/react/test/render.test.ts) |
| `htmlToReact` | experimental | value | [render.test.ts › converts trusted HTML strings](../packages/react/test/render.test.ts) |
| `renderToTree` | experimental | value | [render.test.ts › returns the tree with diagnostics and title](../packages/react/test/render.test.ts) |
| `treeToReact` | experimental | value | [render.test.ts › returns the tree with diagnostics and title](../packages/react/test/render.test.ts) |

### `@markupme/cli`

| Export | Status | Kind | Test |
| ------ | ------ | ---- | ---- |
| `CliError` | stable | value | [contract.test.ts › CliError carries an exit code](../packages/cli/test/contract.test.ts) |
| `EXIT` | stable | value | [contract.test.ts › EXIT codes are fixed](../packages/cli/test/contract.test.ts) |
| `Io` | stable | type | [contract.test.ts › exports the stable types](../packages/cli/test/contract.test.ts) |
| `run` | stable | value | [cli.test.ts › renders to stdout as html, md, ast and text](../packages/cli/test/cli.test.ts) |

### `@markupme/cli/experimental`

| Export | Status | Kind | Test |
| ------ | ------ | ---- | ---- |
| `CAPABILITIES` | experimental | value | [cli.test.ts › capabilities marks experimental features as experimental](../packages/cli/test/cli.test.ts) |
| `createPipeline` | experimental | value | none yet |
| `mergeConfig` | experimental | value | none yet |
| `renderPage` | experimental | value | none yet |
| `startServer` | experimental | value | [cli.test.ts › reports health](../packages/cli/test/cli.test.ts) |

### `markupme`

| Command | Status | Aliases | Arguments | Own flags | Shared flags | Test |
| ------- | ------ | ------- | --------- | --------- | ------------ | ---- |
| `markupme` | stable |  |  | `-v, --version` |  | [cli.test.ts › renders to stdout as html, md, ast and text](../packages/cli/test/cli.test.ts) |
| `init` | stable |  |  | `--force` `--no-sample` |  | [cli.test.ts › init writes a config and a sample](../packages/cli/test/cli.test.ts) |
| `render` | stable |  | `[inputs...]` | `-f, --format <format>` `-o, --output <path>` `-s, --standalone` `--assets-dir <dir>` `--inline-assets` `--mermaid-url <url>` `-w, --watch` `--strict` `--json` `-q, --quiet` | feature, render | [cli.test.ts › renders to stdout as html, md, ast and text](../packages/cli/test/cli.test.ts) |
| `validate` | stable | `lint` | `[inputs...]` | `--strict` `--json` `--no-check-links` `--check-diagrams` `--diagrams <list>` `--diagram-server <url>` `-r, --rule <name=level>` `-q, --quiet` | feature | [cli.test.ts › passes clean docs, respects --rule and --strict, and emits JSON](../packages/cli/test/cli.test.ts) |
| `format` | stable | `fmt` | `[inputs...]` | `--write` `--check` `--bullet <char>` `--emphasis <char>` | feature | [cli.test.ts › checks and writes formatting](../packages/cli/test/cli.test.ts) |
| `toc` | stable |  | `<file>` | `--write` `--check` `--position <where>` | feature | [cli.test.ts › inserts and refreshes a TOC idempotently](../packages/cli/test/cli.test.ts) |
| `build` | stable |  | `[dir]` | `-o, --output <dir>` `--name <name>` `--no-clean` `--strict` | feature, render | [cli.test.ts › builds a site with navigation, rewritten links and a search index](../packages/cli/test/cli.test.ts) |
| `serve` | stable | `preview` | `[path]` | `-p, --port <port>` `--host <host>` `--cors <origin>` `--unsafe` `--no-live-reload` | feature, render | [cli.test.ts › reports health](../packages/cli/test/cli.test.ts) |
| `diagram` | stable |  | `<file>` | `-o, --output <dir>` `--list` `--diagrams <list>` `--diagram-server <url>` | feature | [cli.test.ts › exports server-side diagrams as SVG](../packages/cli/test/cli.test.ts) |
| `parse` | stable |  | `[file]` | `--outline` `--no-positions` | feature | [cli.test.ts › parse --outline, stats, diff and capabilities](../packages/cli/test/cli.test.ts) |
| `stats` | stable |  | `[inputs...]` | `--json` | feature | [cli.test.ts › parse --outline, stats, diff and capabilities](../packages/cli/test/cli.test.ts) |
| `diff` | experimental |  | `<a>` `<b>` | `--json` | feature | [cli.test.ts › parse --outline, stats, diff and capabilities](../packages/cli/test/cli.test.ts) |
| `capabilities` | stable |  |  | `--json` |  | [cli.test.ts › capabilities marks experimental features as experimental](../packages/cli/test/cli.test.ts) |
