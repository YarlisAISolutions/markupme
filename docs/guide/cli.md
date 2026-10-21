# CLI reference

The `markupme` command comes from `@markupme/cli` (`packages/cli`). This page is built from the real `--help` output and the code in `packages/cli/src`. Run `markupme <command> --help` for the same text in your terminal.

> [!NOTE]
> The packages are not on npm yet. Until the first release is tagged, run the CLI from a checkout:
> `bun install && bun run build && node packages/cli/dist/bin.js --help`.

## Contents

- [Install](#install)
- [Exit codes](#exit-codes)
- [Configuration file](#configuration-file)
- [Shared flags](#shared-flags)
- [Commands](#commands): [init](#init), [render](#render), [validate](#validate), [format](#format), [toc](#toc), [build](#build), [serve](#serve), [diagram](#diagram), [parse](#parse), [stats](#stats), [diff](#diff), [capabilities](#capabilities)
- [Diagnostics output](#diagnostics-output)

## Install

```bash
npm i -g @markupme/cli      # after the first release
markupme --version          # prints 0.1.0
```

Requirements: Node.js 22 or later (`engines.node: ">=22"`). Bun works for development. Mermaid SVG export also needs the optional peer dependency `playwright` (`npm i -D playwright && npx playwright install chromium`).

## Exit codes

Defined in `packages/cli/src/exit.ts`. They are stable; CI scripts may depend on them.

| Code | Name | When |
| ---: | ---- | ---- |
| 0 | `OK` | Success. |
| 1 | `INVALID` | Validation errors (or warnings with `--strict`); `format --check` found files to change; `toc --check` found a stale or missing TOC; `diff` found differences; `diagram -o` had a diagram that failed; `toc` found no headings deep enough. |
| 2 | `USAGE` | Bad arguments or options: unknown format, unknown flag, missing input file, bad `--rule`, `--toc`, `--toc-depth`, `--theme` or `--port` value, unknown diagram provider, `kroki` without `--diagram-server`, invalid or missing config file. |
| 3 | `FAILURE` | Rendering or file I/O failed (for example an unreadable input file). |
| 64 | `UNSUPPORTED` | The format or feature is on the roadmap but not built: `render -f pdf`, `-f docx`, `-f mdx`; Mermaid SVG export when `playwright` is not installed. |

## Configuration file

`markupme.config.json` in the working directory is read automatically. `-c, --config <file>` picks another file; a missing explicit file is a usage error (exit 2). The schema is the `MarkupMeConfig` interface in `packages/cli/src/config.ts`. Every field is optional.

Precedence: built-in defaults, then the config file, then flags. Only flags you actually typed override the file (the CLI checks `getOptionValueSource(...) === 'cli'`). Objects merge one level deep.

```jsonc
{
  "gfm": true,              // tables, task lists, strikethrough, autolinks, footnotes
  "frontmatter": true,      // YAML (---) and TOML (+++)
  "directives": true,       // :::note, ::toc, :kbd[]
  "alerts": true,           // > [!NOTE]
  "math": false,            // $x$ and $$x$$ with KaTeX
  "emoji": false,           // :rocket:
  "headingIds": true,       // GitHub-style ids and {#custom-id}
  "toc": { "minDepth": 2, "maxDepth": 3 },   // or true/false; also "position", "title"
  "render": {
    "sanitize": true,
    "allowHtml": true,
    "anchors": true,
    "highlight": true,
    "lineNumbers": false,
    "theme": "auto",        // light | dark | auto
    "baseUrl": "https://example.com/docs/",
    "externalLinksNewTab": false
  },
  "diagrams": {
    "providers": ["blueprint", "graphviz", "mermaid"],
    "server": "http://localhost:8000"         // Kroki; off when absent
  },
  "rules": { "single-h1": "off", "MM013": "warning" },
  "site": { "name": "Docs", "exclude": ["drafts"] }
}
```

The values above that are not comments match `DEFAULT_CONFIG`, except `baseUrl`, `server`, `rules` and `site`, which are examples. `toc.position` takes `marker-only`, `top` or `after-title`. `rules` keys are rule names or codes; values are `off`, `info`, `warning` or `error`.

`markupme init` writes this file with a `$schema` key that points at the GitHub repository. That URL is not a JSON Schema document yet; editors will not validate against it.

Note that the CLI default for `render.anchors` is `true`, while the core library default (`RenderOptions.anchors`) is `false`.

## Shared flags

### Feature flags

Accepted by `render`, `validate`, `format`, `toc`, `build`, `serve`, `diagram`, `parse`, `stats` and `diff`.

| Flag | Effect |
| ---- | ------ |
| `-c, --config <file>` | Config file (default `./markupme.config.json`). |
| `--no-gfm` | CommonMark only: no tables, task lists, strikethrough, autolinks, footnotes. |
| `--no-frontmatter` | Treat `---` blocks as Markdown. |
| `--no-directives` | Disable `:::callouts`, `::toc` and `:kbd[]` directives. |
| `--no-alerts` | Disable GitHub `> [!NOTE]` alerts. |
| `--math` | Render `$math$` and `$$math$$` with KaTeX. |
| `--emoji` | Replace `:shortcode:` emoji. |
| `--no-heading-ids` | Do not add ids to headings. |
| `--toc [position]` | Insert a table of contents: `marker` (default, only where a marker is), `top` or `after-title`. |
| `--toc-depth <range>` | Heading levels in the TOC, for example `2-3`. Must match `^[1-6]-[1-6]$`. |

### Render flags

Accepted by `render`, `build` and `serve`.

| Flag | Effect |
| ---- | ------ |
| `--theme <mode>` | `light`, `dark` or `auto` (follows the system). Affects standalone pages. |
| `--no-sanitize` | Trust the input: keep scripts, styles and event handlers. Unsafe. |
| `--no-html` | Drop raw HTML in the Markdown. |
| `--no-anchors` | No `#` links on headings. |
| `--no-highlight` | No syntax highlighting. |
| `--line-numbers` | Line numbers on every code block. |
| `--diagrams <list>` | Diagram providers: `blueprint`, `graphviz`, `mermaid`, `kroki`, or `none`. Comma-separated. |
| `--diagram-server <url>` | Kroki server for PlantUML, Structurizr, C4, D2 and others. Sends diagram source to that server. |
| `--base-url <url>` | Resolve relative links and images against this URL. |
| `--external-new-tab` | Open external links in a new tab (`target="_blank" rel="noopener noreferrer"`). |

## Commands

### init

```text
markupme init [--force] [--no-sample]
```

Writes `markupme.config.json` (the defaults plus `site: { name: "Docs", exclude: [] }`) and, unless `--no-sample`, `docs/welcome.md`. Refuses to overwrite an existing config without `--force` (exit 2). An existing `docs/welcome.md` is never overwritten.

### render

```text
markupme render [options] [inputs...]
```

Renders files, directories or stdin (`-` or no input).

| Flag | Effect |
| ---- | ------ |
| `-f, --format <format>` | `html` (default), `md`/`markdown`, `ast`/`json`, `text`/`txt`. `pdf`, `docx`, `mdx` exit 64. Anything else exits 2. |
| `-o, --output <path>` | Output file, or a directory for several inputs. Several inputs without `-o` exit 2. |
| `-s, --standalone` | Full HTML page with styles, dark mode, the runtime script (copy buttons, theme toggle, Mermaid). |
| `--assets-dir <dir>` | Where to write `mermaid.min.js` and KaTeX files. Default `<output>/assets`. |
| `--inline-assets` | Put Mermaid inside the page (one offline file). |
| `--mermaid-url <url>` | Load Mermaid from this URL instead of a local copy. |
| `-w, --watch` | Re-render when files change. Not allowed with stdin (exit 2). |
| `--strict` | Warnings fail the command. |
| `--json` | Print diagnostics as JSON: `{ "ok": boolean, "diagnostics": [...] }`. |
| `-q, --quiet` | Only print problems. |

Plus all [feature flags](#feature-flags) and [render flags](#render-flags).

Output names: a directory output keeps the input's relative path and swaps the extension (`.html`, `.md`, `.json`, `.txt`). When writing to stdout, a standalone page with Mermaid has Mermaid inlined, because there is no folder to copy assets into.

Examples:

```bash
markupme render README.md                       # HTML fragment to stdout
markupme render README.md -s -o out/readme.html # page + out/assets/mermaid.min.js if needed
markupme render docs -o out                     # every Markdown file under docs/
markupme render notes.md -s --inline-assets -o notes.html   # single offline file
cat a.md | markupme render -f ast               # JSON AST from stdin
markupme render a.md -f pdf                     # exit 64: planned
```

### validate

Alias: `lint`.

```text
markupme validate [options] [inputs...]
```

Lints files or directories (default `.`): parse diagnostics, the built-in rules, plugin rules, local links, and optionally diagrams.

| Flag | Effect |
| ---- | ------ |
| `--strict` | Warnings fail the command. |
| `--json` | `{ ok, files, errors, warnings, diagnostics }`. |
| `--no-check-links` | Skip checking that relative links and images point to files. |
| `--check-diagrams` | Render diagrams and report their errors (`MM040`). |
| `--diagrams <list>` | Diagram providers for `--check-diagrams`. |
| `--diagram-server <url>` | Kroki server for `--check-diagrams`. |
| `-r, --rule <name=level>` | Set a rule to `off`, `info`, `warning` or `error`. Repeatable. |
| `-q, --quiet` | Only print errors. |

Plus the [feature flags](#feature-flags). Exit 1 when any error remains (or any warning with `--strict`).

```bash
markupme validate docs
markupme lint README.md --strict -r single-h1=off -r MM013=warning
markupme validate . --json > lint.json
```

The rules are listed under [capabilities](#capabilities) and in [syntax.md](syntax.md#lint-rules).

### format

Alias: `fmt`.

```text
markupme format [options] [inputs...]
```

Normalizes Markdown through the parser and serializer (`-` bullets, `_` emphasis, `*` strong, backtick fences, `-` rules, one-space list indent). Content is kept; TOC insertion is turned off while formatting.

| Flag | Effect |
| ---- | ------ |
| `--write` | Rewrite files in place. |
| `--check` | Exit 1 when a file would change. |
| `--bullet <char>` | List bullet: `-`, `*` or `+`. |
| `--emphasis <char>` | Emphasis marker: `_` or `*`. |

`--write` and `--check` need files, not stdin (exit 2). Without either flag the formatted text goes to stdout.

### toc

```text
markupme toc [options] <file>
```

Inserts or refreshes a table of contents between `<!-- toc -->` and `<!-- tocstop -->`. Existing markers (`[[toc]]`, `::toc`, `<!-- toc -->`) are replaced in place; with no marker the TOC goes after the title (or at the top with `--position top`).

| Flag | Effect |
| ---- | ------ |
| `--write` | Update the file in place. |
| `--check` | Exit 1 when the TOC is missing or stale. |
| `--position <where>` | `after-title` (default) or `top`, used when the file has no marker. |

Exit 1 when the document has no headings in the TOC depth range. A file with headings but no TOC block fails `--check` ("out of date"), because the output would add one.

```bash
markupme toc README.md --write
markupme toc README.md --check   # in CI
```

### build

```text
markupme build [options] [dir]
```

Builds a static site from a directory (default `.`): one HTML page per Markdown file, a sidebar, a search box backed by `search-index.json`, a shared `markupme.css`, and `assets/` for Mermaid and KaTeX when pages need them.

| Flag | Effect |
| ---- | ------ |
| `-o, --output <dir>` | Output directory. Default `site`. Must differ from the source (exit 2). |
| `--name <name>` | Site name. Default: config `site.name`, else the index page title, else `Docs`. |
| `--no-clean` | Keep existing files in the output directory. |
| `--strict` | Warnings fail the build. |

Plus the feature and render flags. Details:

- `README.md` becomes `index.html`; relative `.md` links are rewritten to `.html`.
- When no index page exists, a generated `index.html` lists all pages.
- Images and other assets (`png jpg jpeg gif svg webp avif ico pdf mp4 webm`) are copied next to the pages.
- `node_modules`, `.git`, `dist`, `site`, `out`, `coverage`, dot folders and `site.exclude` entries are skipped.

```bash
markupme build docs -o site --name "Team docs"
```

### serve

Alias: `preview`.

```text
markupme serve [options] [path]
```

Live preview of a file or directory (default `.`), a playground and a JSON API.

| Flag | Effect |
| ---- | ------ |
| `-p, --port <port>` | Port. Default `4321` (or `$PORT`); `0` picks a free port. Must be 0-65535. |
| `--host <host>` | Interface to bind. Default `127.0.0.1`. |
| `--cors <origin>` | Allow this origin (or `*`) to call the API. |
| `--unsafe` | Let API callers turn sanitizing off. Never use on a shared host. |
| `--no-live-reload` | Do not reload pages on change. |

Plus the feature and render flags.

On start it prints:

```text
markupme 0.1.0 serving docs at http://127.0.0.1:4321
  playground  http://127.0.0.1:4321/__markupme/playground
  api         http://127.0.0.1:4321/api/health · POST /api/render · POST /api/validate
```

It stops on Ctrl+C (SIGINT) or SIGTERM. Requests to the API reuse up to 32 cached pipelines, one per option combination.

Routes:

| Route | Method | Response |
| ----- | ------ | -------- |
| `/` | GET | `index.md` or `README.md` rendered, else a file listing. For a single file, that file. |
| `/<path>.md` | GET | The file as a standalone page, with a diagnostics banner (`data-testid="render-diagnostics"`) when it has warnings or errors. |
| other files | GET | Served as-is with a content type from the extension. Paths outside the root return 403. |
| `/__markupme/playground` | GET | Playground page: textarea, option checkboxes, preview, diagnostics list. |
| `/__markupme/events` | GET | Server-sent events; sends `reload` when a file changes. |
| `/__markupme/mermaid.min.js`, `/__markupme/katex/*` | GET | Local browser assets. No CDN. |
| `/api/health` | GET | `{ "status": "ok", "name": "markupme", "version": "0.1.0" }`. Other methods: 405. |
| `/api/capabilities` | GET | `{ version, capabilities }`. |
| `/api/render` | POST | `{ format, title, output, diagnostics, stats }`. |
| `/api/validate` | POST | `{ ok, errors, warnings, diagnostics }`. `ok` is false when any error exists. |
| `/api/stats` | POST | The `DocumentStats` object (see [sdk.md](sdk.md#stats)). |

POST body (JSON, at most 1 MB):

```json
{
  "markdown": "# Hello",
  "format": "html",
  "toc": true,
  "math": false,
  "emoji": false,
  "anchors": true,
  "highlight": true,
  "lineNumbers": false,
  "diagrams": true,
  "standalone": false,
  "sanitize": true,
  "lint": false
}
```

Only `markdown` is required. `lint: true` (on `/api/render`) also runs the lint rules and merges their diagnostics into the response, sorted by line; the playground uses it. `format` is `html`, `markdown`/`md`, `ast` or `text`. `diagrams: false` turns diagram providers off. `sanitize: false` is ignored unless the server runs with `--unsafe`.

API errors are `{ "error": { "code", "message" } }`:

| Status | Code | Cause |
| -----: | ---- | ----- |
| 400 | `BAD_JSON` | Body is not JSON. |
| 400 | `MARKDOWN_REQUIRED` | No string `markdown` field. |
| 400 | `FORMAT` | Unknown format. |
| 404 | `NOT_FOUND` | Unknown `/api/` route. |
| 405 | `METHOD` | Wrong method (with an `Allow` header). |
| 413 | `TOO_LARGE` | Body larger than 1 MB. |
| 500 | `INTERNAL` | Unexpected failure. |
| 501 | `UNSUPPORTED` | `pdf`, `docx` or `mdx` (planned). |

Every response sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: SAMEORIGIN` and (except static assets) `Cache-Control: no-store`.

```bash
markupme serve docs
markupme serve examples --port 4321          # what markupme-qa expects
curl -s localhost:4321/api/render -H 'Content-Type: application/json' \
  -d '{"markdown":"# Hi\n\n> [!TIP]\n> Works"}'
```

### diagram

```text
markupme diagram [options] <file>
```

Lists the diagram blocks in a file, or exports each one as SVG.

| Flag | Effect |
| ---- | ------ |
| `-o, --output <dir>` | Write one SVG per diagram: `<stem>-<n>-<lang>.svg`. |
| `--list` | Only list the diagrams. |
| `--diagrams <list>` | Diagram providers. |
| `--diagram-server <url>` | Kroki server for PlantUML, Structurizr, C4 and others. |

Only fences that an enabled provider claims are listed. A `plantuml` fence is not a diagram unless a Kroki server is configured; without one it renders as a plain code block.

```console
$ markupme diagram d.md --list
1. blueprint (ybp) line 1
2. graphviz (dot) line 8
2 diagrams in d.md (use -o <dir> to export SVG)
$ markupme diagram d.md -o svg
wrote svg/d-1-ybp.svg
wrote svg/d-2-dot.svg
2 diagrams exported
```

Blueprint and Graphviz export without extra software. Mermaid export launches headless Chromium through the optional `playwright` package; without it the command exits 64 with install instructions. Every exported SVG passes through `sanitizeSvg`. Exit 1 when any diagram fails.

```bash
markupme diagram architecture.md --list
markupme diagram architecture.md -o svg
markupme diagram c4.md -o svg --diagram-server http://localhost:8000
```

### parse

```text
markupme parse [options] [file]
```

Prints the document model as JSON (`type`, `schemaVersion`, `file`, `tree`, `frontmatter`, `diagnostics`; the source text is left out). Reads stdin when no file is given.

| Flag | Effect |
| ---- | ------ |
| `--outline` | Print the heading outline: `- Text (#id, line N)`, indented by depth. |
| `--no-positions` | Leave out source positions. |

### stats

```text
markupme stats [--json] [inputs...]
```

```console
$ markupme stats docs/welcome.md
docs/welcome.md
  49 words, ~1 min read, 4 headings, 3 links, 0 images, 0 tables, 1 code blocks, 1 footnotes
  tasks: 1/2 done
  code: mermaid×1
```

Word count, reading time (230 words a minute, at least 1 minute), headings, links, images, tables, code blocks, footnotes, task progress and code languages. `--json` prints one object for one file, an array for several.

### diff

```text
markupme diff [--json] <a> <b>
```

Block-level structural diff of two Markdown files.

```console
$ markupme diff a.md b.md
~ paragraph (line 3): old → new
+ heading (line 5): Added
```

Lines start with `+` (added), `-` (removed) or `~` (changed). Exit 1 when they differ, 0 when they are the same. Formatting-only differences (positions, markers) are not reported.

### capabilities

```text
markupme capabilities [--json]
```

Prints what is built, opt-in and planned, and the lint rules with codes and severities. The JSON form is `{ name, version, capabilities: [{ area, feature, status, note? }], rules: [...] }`. The serve API returns the same table at `GET /api/capabilities`.

Current status of the larger items, as tracked in the [implementation plan](../implementation/implementation-plan.md):

| Item | Status |
| ---- | ------ |
| CommonMark, GFM, frontmatter, alerts, directives, heading ids | built |
| Math, emoji | built, opt-in |
| HTML, standalone page, Markdown, JSON AST, text, static site | built |
| Mermaid (browser), Blueprint, Graphviz | built |
| PlantUML, C4, Structurizr, D2 via Kroki | built, opt-in |
| Web studio (`apps/studio`) | planned (in progress, Phase 1, branch `feat/studio`) |
| VS Code extension (`packages/vscode`) | built |
| React component (`@markupme/react`) | built |
| PDF, DOCX, MDX output; rich-text editing; Marketplace listing | planned, Phase 2 |

The three in-progress items appear as `planned` with the note `in progress, Phase 1` until their pull requests merge. The SDODS scenario `Preview server health › Capabilities list built and planned features honestly` checks this table over the API.

## Diagnostics output

Human output goes to stderr, one line per problem:

```text
docs/a.md:12:1 error MM012 File not found: a.png (missing-local-file)
```

The format is `file:line:column severity code message (rule)` (`formatDiagnostic` in core). Inside GitHub Actions (`GITHUB_ACTIONS=true`) the CLI also prints workflow commands such as `::error file=docs/a.md,line=12,col=1,title=MM012::File not found: a.png`, so problems show up as annotations. With `--strict`, warnings are annotated as errors.
