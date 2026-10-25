# SDK guide

The programmatic API of the MarkupMe packages. Signatures match `packages/*/src` at version 0.1.0. The examples were run against the built packages.

> [!NOTE]
> The packages are not on npm yet. Until the first release is tagged, use them from a checkout of the monorepo (workspace dependencies).

## Contents

- [Packages](#packages)
- [Quick start](#quick-start)
- [Document model](#document-model)
- [Processors](#processors)
- [parse](#parse)
- [render](#render)
- [transform](#transform)
- [serialize](#serialize)
- [validate](#validate)
- [roundTrip](#roundtrip)
- [query, visit, outline](#query-visit-outline)
- [diff](#diff)
- [stats](#stats)
- [Plugins](#plugins)
- [Code block handlers](#code-block-handlers)
- [Syntax highlighting](#syntax-highlighting)
- [Diagrams](#diagrams)
- [Standalone pages](#standalone-pages)
- [Errors and diagnostics](#errors-and-diagnostics)
- [Runtime support](#runtime-support)

## Packages

| Package | Import | Main exports |
| ------- | ------ | ------------ |
| `@markupme/core` | `@markupme/core` | `createProcessor`, `parse`, `render`, `transform`, `serialize`, `validate`, `query`, `visit`, `diff`, `stats`, `outline`, `headingId`, `buildToc`, `insertToc`, `stripPositions`, `escapeHtml`, `formatDiagnostic`, `RULES`, `markupmeSchema`, `SCHEMA_VERSION`, `MarkupMeError`, `VERSION`, `ALERT_TYPES`, `ALERT_TITLES`, `CALLOUTS`, `CONTAINERS`, `TEXT_DIRECTIVES`, `LEAF_DIRECTIVES`, all types |
| `@markupme/highlight` | `@markupme/highlight` | `highlightHandler`, `parseMeta`, `escapeHtml` |
| `@markupme/diagrams` | `@markupme/diagrams` | `diagramHandler`, `codeBlockHandlers`, `providersFromIds`, `defaultProviders`, `blueprintProvider`, `graphvizProvider`, `mermaidProvider`, `krokiProvider`, `extractDiagrams`, `sanitizeSvg`, `DiagramError`, `KROKI_TYPES`, `MERMAID_LANGS`, types `ProviderProblem`, `ProvidersFromIds`, `CodeBlockHandlerOptions` |
| `@markupme/themes` | `@markupme/themes` | `wrapDocument`, `markupmeCss`, `runtimeScript`, `escapeHtml` |
| `@markupme/cli` | `@markupme/cli` | `run`, `startServer`, `createPipeline`, `mergeConfig`, `renderPage`, `CAPABILITIES`, `EXIT`, `CliError` (Node only) |
| `@markupme/react` | | In progress, Phase 1. Not in the repository yet. |

All packages are ESM-only (`"type": "module"`), ship `.d.ts` files and set `"sideEffects": false`.

## Quick start

```ts
import { parse, render, serialize, transform, validate } from '@markupme/core'

const doc = parse('# Hello MarkupMe\n\n## A\n\nText', { file: 'hello.md' })

const html = await render(doc)            // { format: 'html', output, diagnostics, title }
console.log(html.title)                   // 'Hello MarkupMe'

const { document } = transform(doc, { plugins: ['toc'] })
console.log(serialize(document))          // TOC inserted after the title

const problems = validate('[x](#nope)')   // MM004 broken-fragment-link
```

Note the shapes: `parse`, `transform`, `serialize` and `validate` are synchronous. Only `render` is async (code block handlers can be async).

## Document model

```ts
interface MarkupMeDocument {
  type: 'markupme-document'
  schemaVersion: 1                    // SCHEMA_VERSION; bumped on breaking changes
  source: string                      // the Markdown exactly as given
  file?: string
  tree: Root                          // mdast root with positions (unist-compatible)
  frontmatter?: Record<string, unknown>
  diagnostics: Diagnostic[]           // found while parsing
}
```

- `tree` is plain mdast. Any unified/remark utility works on it.
- Heading ids live in `node.data.hProperties.id`; a `{#custom}` id is also kept in `node.data.customId`.
- GitHub alerts are marked with `node.data.alert` on the blockquote; the text is untouched.
- A generated TOC is a node of type `toc` (`TocNode`) holding a list.
- Parse-time changes keep the data needed for serialization. Presentation (alert boxes, callouts, emoji) happens on a copy during rendering. See [ADR 0004](../architecture/architecture-decision-records/0004-document-model.md).

## Processors

```ts
import { createProcessor } from '@markupme/core'

const processor = createProcessor({
  gfm: true,           // default true
  frontmatter: true,   // default true
  directives: true,    // default true
  alerts: true,        // default true
  headingIds: true,    // default true
  toc: { minDepth: 2, maxDepth: 3, position: 'marker-only', title: 'Table of contents' }, // title = the nav's aria-label
  math: false,         // default false
  emoji: false,        // default false
  plugins: [],         // MarkupMePlugin[]
})
```

A processor's options are frozen at creation. There is no global registry; two processors never affect each other. The module-level `parse`, `render`, `transform`, `serialize` and `validate` use one shared processor with default options.

```ts
interface Processor {
  readonly options: Readonly<ProcessorOptions>
  parse(source: string, opts?: { file?: string }): MarkupMeDocument
  transform(doc: MarkupMeDocument, opts?: TransformOptions): TransformResult
  render(input: MarkupMeDocument | string, opts?: RenderOptions): Promise<RenderResult>
  serialize(input: MarkupMeDocument | Root, opts?: SerializeOptions): string
  validate(input: MarkupMeDocument | string, opts?: ValidateOptions): Diagnostic[]
  roundTrip(doc: MarkupMeDocument): { lossless: boolean; markdown: string; diagnostics: Diagnostic[] }
  rules(): Rule[]
}
```

`roundTrip` and `rules` exist only on processor instances.

## parse

```ts
const doc = processor.parse(source, { file: 'docs/intro.md' })
```

Never throws on bad input. Problems (invalid frontmatter, unknown directives, duplicate heading ids) go into `doc.diagnostics`, each tagged with `file` when given.

## render

```ts
interface RenderOptions {
  format?: 'html' | 'markdown' | 'ast' | 'text'   // default 'html'
  sanitize?: boolean            // default true
  allowHtml?: boolean           // default true (still sanitized)
  anchors?: boolean             // default false
  codeBlocks?: CodeBlockHandler[]
  lazyImages?: boolean          // default true: loading="lazy" decoding="async"
  externalLinksNewTab?: boolean // default false
  baseUrl?: string              // resolve relative links and images
  indent?: number               // JSON indent for 'ast', default 2
}

interface RenderResult {
  format: RenderFormat
  output: string
  diagnostics: Diagnostic[]     // parse diagnostics plus render diagnostics
  title?: string                // frontmatter title, else the first h1
}
```

```ts
const { output } = await processor.render('# Hi', { anchors: true, baseUrl: 'https://site.dev/docs/' })
const text = (await processor.render(doc, { format: 'text' })).output
const ast = (await processor.render(doc, { format: 'ast', indent: 0 })).output
```

An unknown format throws `MarkupMeError` with code `MM_FORMAT`. The HTML pipeline is described in [security.md](security.md#html-pipeline).

## transform

```ts
type BuiltinTransform = 'toc' | 'normalize'

interface TransformOptions {
  plugins?: (BuiltinTransform | MarkupMePlugin)[]   // applied in order
  toc?: TocOptions
}

interface TransformResult {
  document: MarkupMeDocument    // a new document; the input is not changed
  diagnostics: Diagnostic[]     // from this transform only
}
```

- `'toc'` inserts a TOC at a marker, or after the title by default. When there is nowhere to put one it reports `MM030` (info).
- `'normalize'` serializes and re-parses, so the tree matches what `serialize` would write.
- A `MarkupMePlugin` runs its `parse` hook on the copy.

```ts
const result = transform(doc, { plugins: ['toc'], toc: { maxDepth: 4 } })
```

## serialize

```ts
interface SerializeOptions {
  format?: 'markdown' | 'json'  // default 'markdown'
  bullet?: '-' | '*' | '+'      // default '-'
  emphasis?: '_' | '*'          // default '_'
  fence?: '`' | '~'             // default '`'
  indent?: number               // JSON indent, default 2
}
```

```ts
serialize(doc)                            // normalized Markdown
serialize(doc, { bullet: '*' })
serialize(doc, { format: 'json' })        // document without `source`, with schemaVersion
serialize(doc.tree)                       // a bare mdast Root works too
```

The serializer uses the same syntax extensions as the parser, so GFM, frontmatter, directives, math and plugin syntax survive. `{#custom}` ids are written back. A TOC is written between `<!-- toc -->` and `<!-- tocstop -->`. Alert markers `> [!NOTE]` and prose colons are written without escapes.

## validate

```ts
interface ValidateOptions {
  rules?: Record<string, 'off' | 'info' | 'warning' | 'error'>   // by rule name or code
  fileExists?: (path: string) => boolean   // enables MM012 missing-local-file
}
```

```ts
import { existsSync } from 'node:fs'

const diagnostics = processor.validate(doc, {
  rules: { 'single-h1': 'off', MM013: 'warning' },
  fileExists: (p) => existsSync(new URL(p, 'file:///repo/docs/')),
})
```

Returns parse diagnostics plus rule results, sorted by line and column. The core never touches the filesystem; local link checking only happens when you pass `fileExists`. The rule list is in [syntax.md](syntax.md#lint-rules); `RULES` exports the built-in rules and `processor.rules()` adds plugin rules.

## roundTrip

```ts
const { lossless, markdown, diagnostics } = processor.roundTrip(doc)
```

Serializes, re-parses, and compares both trees without positions. `lossless: false` means serialization would normalize something (markers, spacing, escapes); it adds `MM031` (info). Content is kept either way.

## query, visit, outline

```ts
import { outline, query, visit } from '@markupme/core'

const links = query(doc.tree, 'link')                        // typed: Link[]
const external = query(doc.tree, (n) => n.type === 'link' && n.url.startsWith('http'))
visit(doc.tree, 'heading', (h) => console.log(h.depth))      // re-export of unist-util-visit

const toc = outline(doc.tree)
// [{ depth: 1, text: 'Hello MarkupMe', id: 'hello-markupme', line: 1, children: [...] }]
```

`stripPositions(node, dropData?)` removes `position` (and optionally `data`) for structural comparison. `buildToc(tree, opts)` and `insertToc(tree, opts)` expose the TOC builder.

## diff

```ts
import { diff, parse } from '@markupme/core'

diff(parse('a').tree, parse('b').tree)
// [{ kind: 'changed', index: 0, type: 'paragraph', before: 'a', after: 'b', line: 1 }]
```

A longest-common-subsequence diff over top-level blocks, ignoring positions and `data`. A removal followed by an addition of the same block type is reported as one `changed` entry. Previews are cut at 80 characters.

## stats

```ts
import { stats } from '@markupme/core'

stats(doc.tree)
// { words, characters, readingMinutes, headings, paragraphs, links, images, tables,
//   codeBlocks, footnotes, tasks: { total, done }, languages: { ts: 2, text: 1 } }
```

Reading time assumes 230 words a minute and is at least 1.

## Plugins

```ts
interface MarkupMePlugin {
  name: string
  remarkPlugins?: PluggableList                       // syntax extensions (parser and serializer)
  parse?: (tree: Root, ctx: PluginContext) => void    // after parsing; keep it data-preserving
  render?: (tree: Root, ctx: PluginContext) => void | Promise<void>   // on a copy, before HTML
  rehype?: (tree: HastRoot, ctx: PluginContext) => void | Promise<void>   // hast, before sanitizing
  rules?: Rule[]
  codeBlock?: CodeBlockHandler
}

interface PluginContext {
  doc: MarkupMeDocument
  options: ProcessorOptions
  report(d: Diagnostic): void
}
```

Plugins run after the built-ins, in the order given. Example: a lint rule.

```ts
import { createProcessor, type MarkupMePlugin, query } from '@markupme/core'

const noTodo: MarkupMePlugin = {
  name: 'no-todo',
  rules: [
    {
      code: 'X001',
      name: 'no-todo',
      description: 'No TODO markers in published docs.',
      severity: 'warning',
      check({ doc, report }) {
        for (const t of query(doc.tree, 'text'))
          if (t.value.includes('TODO')) report({ message: 'TODO left', line: t.position?.start.line })
      },
    },
  ],
}

createProcessor({ plugins: [noTodo] }).validate('TODO x')
// [{ code: 'X001', rule: 'no-todo', severity: 'warning', message: 'TODO left', line: 1 }]
```

Example: a render-time transform (from the CLI's `build` command, which rewrites `.md` links to `.html`).

```ts
const mdLinksToHtml: MarkupMePlugin = {
  name: 'md-links-to-html',
  render(tree) {
    for (const link of query(tree, 'link'))
      if (!/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(link.url))
        link.url = link.url.replace(/\.md(?=$|#|\?)/i, '.html')
  },
}
```

Example: a `rehype` hook. It runs on the hast tree after code blocks have become slots and before raw HTML is parsed and the tree is sanitized, so whatever it adds still has to pass `markupmeSchema`. A class outside the allowlist is removed:

```ts
const markParagraphs: MarkupMePlugin = {
  name: 'mark-paragraphs',
  rehype(tree) {
    for (const node of tree.children)
      if (node.type === 'element' && node.tagName === 'p')
        node.properties.className = ['mm-note', 'evil-class']
  },
}

(await createProcessor({ plugins: [markParagraphs] }).render('Hello')).output
// '<p class="mm-note">Hello</p>'
```

Order of plugin hooks during `render`: `render` (mdast copy) → code block handlers → `rehype` (hast) → sanitize → slots filled.

## Code block handlers

```ts
interface CodeBlock {
  lang: string | undefined    // from the fence info string, lower-cased
  meta: string | undefined    // rest of the info string
  code: string
  index: number               // 0-based among code blocks
  line?: number
}

type CodeBlockHandler = (block: CodeBlock) =>
  CodeBlockResult | undefined | Promise<CodeBlockResult | undefined>

interface CodeBlockResult { html: string; diagnostics?: Diagnostic[] }
```

Handlers come from plugins (`codeBlock`) first, then `RenderOptions.codeBlocks`, in order. The first handler that returns a result wins; return `undefined` to pass. A handler that throws becomes an `MM020` error and the block stays as plain code.

> [!WARNING]
> Handler output is trusted. It is inserted after sanitization and is not sanitized again. Escape everything you put in it. See [security.md](security.md#trusted-slots).

## Syntax highlighting

```ts
import { render } from '@markupme/core'
import { highlightHandler, parseMeta } from '@markupme/highlight'

const { output } = await render(source, {
  codeBlocks: [
    highlightHandler({
      light: 'github-light',   // any Shiki bundled theme
      dark: 'github-dark',
      lineNumbers: false,      // all blocks; blocks can opt in with showLineNumbers
      copyButton: true,
      skip: ['mermaid'],       // languages to leave to another handler
    }),
  ],
})

parseMeta('title="a.ts" {1,3-5} showLineNumbers startLine=10')
// { title: 'a.ts', lineNumbers: true, highlight: Set{1,3,4,5}, startLine: 10 }
```

The Shiki highlighter is created once per handler, on first use, and loads languages as needed.

## Diagrams

```ts
import { render } from '@markupme/core'
import { defaultProviders, diagramHandler, type DiagramProvider, krokiProvider } from '@markupme/diagrams'
import { highlightHandler } from '@markupme/highlight'

const upper: DiagramProvider = {
  id: 'upper',
  langs: ['upper'],
  mode: 'server',
  async render({ source }) {
    return { kind: 'svg', svg: `<svg><text>${source.toUpperCase()}</text></svg>` }
  },
}

const diagrams = diagramHandler({
  providers: [...defaultProviders(), upper, krokiProvider({ server: 'http://localhost:8000' })],
  theme: 'light',    // 'light' | 'dark'
  cacheSize: 200,
})

const { output, diagnostics } = await render(source, {
  codeBlocks: [diagrams, highlightHandler({ skip: diagrams.langs })],
})
```

```ts
interface DiagramProvider {
  id: string
  langs: string[]
  mode: 'server' | 'client'
  remote?: boolean
  render(req: { lang: string; source: string; theme: 'light' | 'dark' }): Promise<DiagramOutput>
}
type DiagramOutput = { kind: 'svg'; svg: string } | { kind: 'client'; html: string }
```

- `defaultProviders()` returns blueprint, graphviz and mermaid. `defaultProviders({ kroki: url })` adds Kroki.
- SVG output is passed through `sanitizeSvg` before it is used. Client output (Mermaid's `<pre class="mermaid">`) is HTML the provider builds and escapes itself.
- Throw `new DiagramError(message, line)` to report a line inside the diagram; the handler adds the fence line.
- The handler caches results by SHA-256 of provider id, theme, language and source. `diagrams.clearCache()` empties it.
- `extractDiagrams(markdown, providers?)` lists diagram blocks: `{ index, lang, provider, source, line }`.

## Standalone pages

```ts
import { wrapDocument } from '@markupme/themes'

const page = wrapDocument({
  body: output,                    // rendered HTML
  title: 'Guide',
  description: 'How to use it',
  lang: 'en',
  theme: 'auto',                   // 'light' | 'dark' | 'auto'
  mermaidUrl: './assets/mermaid.min.js',   // only when the page has Mermaid
  nav: [{ title: 'Home', href: './', current: true }],
  siteName: 'Docs',
})
```

Other options: `cssHref` (link instead of inline CSS), `extraCss`, `head` and `footer` (trusted HTML), `mermaidInline` (Mermaid source in the page), `runtime: false` (no script), `homeHref`. The page uses landmark elements (`header`, `nav`, `main`, `article`), a theme toggle with `aria-pressed`, and `markupmeCss` with light, dark and print rules. `runtimeScript` handles copy buttons, the theme toggle (saved in `localStorage` when available) and Mermaid rendering.

## Errors and diagnostics

```ts
interface Diagnostic {
  code: string                 // stable, e.g. 'MM004'
  rule: string                 // e.g. 'broken-fragment-link'
  severity: 'error' | 'warning' | 'info'
  message: string
  file?: string
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
}
```

`formatDiagnostic(d)` gives `file:line:col severity code message (rule)`. Parsing, validation and rendering report problems as diagnostics. `MarkupMeError` (with a `code`) is thrown only for programming errors such as an unknown render format.

## Runtime support

| Runtime | `@markupme/core`, `highlight`, `diagrams`, `themes` | `@markupme/cli` |
| ------- | ------------------------------------------------ | --------------- |
| Node.js 22+ | Yes (tested with vitest) | Yes |
| Bun | Yes (used for development and builds) | Yes |
| Browsers | Designed for it: no `node:` imports in these packages; uses `globalThis.crypto`. Not yet covered by a browser test. | No (uses `node:fs`, `node:http`) |

Graphviz loads a WebAssembly module on first use. Mermaid needs a DOM, so it renders in the page, or in headless Chromium for `markupme diagram -o`.
