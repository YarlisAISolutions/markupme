# Competitive analysis

What exists in the Markdown space, what MarkupMe reuses, and where it differs. Written 2026-10-20 without web access.

## How to read this page

Every fact carries a basis label:

| Label | Meaning |
| ----- | ------- |
| **G** | Verified from general knowledge (as of 2026). Widely documented, stable facts about the project. Still worth re-checking before quoting externally. |
| **A** | Assumption. Plausible but not checked: recent changes, exact licence variants, sizes, speed. Re-check before relying on it. |
| **U** | Unverified. We do not know what the project is. |

No bundle sizes or benchmark numbers are given, because none were measured. Where size or speed matters, the text says "smaller" or "faster" and is labelled **A**.

## Comparison matrix

### Parsing and processing

| Project | Architecture | Programming model | Plugin mechanism | Standards | Runtime | Security default | Licence | Notes |
| ------- | ------------ | ----------------- | ---------------- | --------- | ------- | ---------------- | ------- | ----- |
| marked | Lexer to tokens to renderer (**G**) | `marked.parse(md)` returns an HTML string; sync or async (**G**) | `marked.use({ extensions, renderer, tokenizer, hooks, walkTokens })` (**G**) | CommonMark and GFM, with known deviations listed by the project (**G**) | Node, browsers (**G**) | No sanitizing; docs tell you to add DOMPurify (**G**) | MIT (**G**) | Very fast and small (**A**). No AST standard, no Markdown serializer (**G**). The original reference for this project. |
| markdown-it | Block and inline rule chains produce a flat token stream, then a renderer (**G**) | `md.render(src)`; `md.parse` for tokens (**G**) | `md.use(plugin)`; rules can be added or replaced (**G**) | CommonMark, with GFM tables and strikethrough built in (**G**) | Node, browsers (**G**) | `html: false` by default, so raw HTML is escaped; `validateLink` blocks `javascript:` (**G**) | MIT (**G**) | Large plugin ecosystem (containers, footnotes, anchors) (**G**). No serializer (**G**). |
| remark / unified | Parse to mdast, transform with plugins, compile (**G**) | `unified().use(remarkParse).use(...).process()` (**G**) | unified plugins on syntax trees; micromark extensions for syntax (**G**) | CommonMark through micromark; GFM, frontmatter, directives, math as extensions (**G**) | Node, browsers, Deno, Bun; ESM only (**G**) | Sanitizing via `rehype-sanitize`; `remark-rehype` drops raw HTML unless `allowDangerousHtml` (**G**) | MIT (**G**) | Standard trees (unist, mdast, hast) and a serializer (`remark-stringify`) (**G**). Many small packages (**G**). MarkupMe builds on it ([ADR 0001](../architecture/architecture-decision-records/0001-unified-remark-micromark.md)). |
| micromark | State-machine tokenizer emitting events; HTML compiler or mdast via `mdast-util-from-markdown` (**G**) | `micromark(md)` returns HTML (**G**) | Syntax extensions (constructs) and HTML extensions (**G**) | Aims at 100% CommonMark compliance (**G**) | Node, browsers (**G**) | Raw HTML not allowed unless `allowDangerousHtml` (**G**) | MIT (**G**) | The tokenizer under remark-parse (**G**). |
| commonmark.js | Reference parser: block parse, inline parse, AST, renderers (**G**) | `new Parser().parse()`, `new HtmlRenderer().render()` (**G**) | None formal; walk and edit the AST (**G**) | The CommonMark reference implementation for JavaScript (**G**) | Node, browsers (**G**) | `safe` option strips raw HTML and unsafe links; off by default (**G**) | BSD-2-Clause (**A**) | No GFM (**G**). Low release activity (**A**). |
| showdown | Regex-based converter, Markdown to HTML and HTML to Markdown (**G**) | `new showdown.Converter().makeHtml(md)` (**G**) | Extensions (lang and output types) (**G**) | Its own dialect with GFM-like options; not CommonMark-compliant (**G**) | Node, browsers (**G**) | No sanitizing; the docs warn about XSS (**G**) | MIT for v2 and later (**A**) | Older design; maintenance slowed (**A**). |
| TanStack/markdown | **U** | **U** | **U** | **U** | **U** | **U** | **U** | We could not confirm that a TanStack Markdown project exists or what it does. Treat as unverified until someone checks the repository. |

### Editing

| Project | Architecture | Programming model | Plugin mechanism | Standards | Runtime | Security default | Licence | Notes |
| ------- | ------------ | ----------------- | ---------------- | --------- | ------- | ---------------- | ------- | ----- |
| Milkdown | WYSIWYG Markdown editor on ProseMirror, with remark for Markdown in and out (**G**) | Editor factory with plugins (**G**) | Plugins add nodes, marks, commands, remark plugins (**G**) | Markdown through remark (**G**) | Browser (**G**) | Content is a ProseMirror schema, so unknown HTML is not rendered as live HTML (**A**) | MIT (**G**) | Closest fit for keeping MarkupMe syntax, because it shares remark (**A**). Candidate in [ADR 0007](../architecture/architecture-decision-records/0007-codemirror-studio-editor.md). |
| Tiptap | Headless editor framework on ProseMirror (**G**) | `new Editor({ extensions })`; React/Vue bindings (**G**) | Extensions (nodes, marks, functionality) (**G**) | Markdown support through an extension, not native (**A**) | Browser (**G**) | Schema-based; pasted HTML is parsed into the schema (**G**) | MIT core; some extensions and cloud features are paid (**A**) | Candidate in ADR 0007; Markdown fidelity is the open question (**A**). |
| ProseMirror | Toolkit: schema, state, transactions, view (**G**) | Low-level; you build the editor (**G**) | Plugins and node views (**G**) | Not Markdown-native; `prosemirror-markdown` uses markdown-it (**G**) | Browser (**G**) | Schema-based (**G**) | MIT (**G**) | Base of Milkdown and Tiptap (**G**). |
| CodeMirror 6 | Modular code editor: state, view, extensions; Lezer parsers (**G**) | `new EditorView({ state })` with extensions (**G**) | Extensions, facets, state fields (**G**) | Markdown language package (CommonMark and GFM via Lezer) (**G**) | Browser (**G**) | Edits text only; renders nothing as HTML (**G**) | MIT (**G**) | Chosen for the studio source editor (ADR 0007). Strong accessibility and mobile support (**G**). |
| Lexical | Editor framework with its own node tree and update model (**G**) | `createEditor`, React bindings (**G**) | Nodes, commands, plugins (**G**) | Markdown import/export and shortcuts via `@lexical/markdown` (**G**) | Browser (**G**) | Own model; HTML import goes through conversion (**G**) | MIT (**G**) | Not Markdown-first (**A**). |
| MDXEditor | React WYSIWYG editor for Markdown and MDX, built on Lexical (**G**) | `<MDXEditor markdown=... plugins=[...] />` (**G**) | Plugins (toolbar, tables, code, JSX) (**G**) | Markdown through mdast utilities (**A**) | Browser, React (**G**) | Model-based; JSX components are declared, not executed from text (**A**) | MIT (**A**) | React-only (**G**). |

### Rendering and documentation

| Project | Architecture | Programming model | Plugin mechanism | Standards | Runtime | Security default | Licence | Notes |
| ------- | ------------ | ----------------- | ---------------- | --------- | ------- | ---------------- | ------- | ----- |
| react-markdown | remark to rehype to React elements (**G**) | `<Markdown remarkPlugins rehypePlugins components>` (**G**) | remark and rehype plugins; `components` map (**G**) | CommonMark; GFM with `remark-gfm` (**G**) | React (browser and server) (**G**) | Safe by default: raw HTML ignored unless `rehype-raw` is added; URL transform blocks unsafe protocols (**G**) | MIT (**G**) | Reference for the planned `@markupme/react`. |
| MDX | Markdown plus JSX compiled to JavaScript (**G**) | `@mdx-js/mdx` compile; runtime components (**G**) | remark, rehype and recma plugins (**G**) | Based on CommonMark via micromark, with MDX deviations (no indented code, HTML replaced by JSX) (**G**) | Build-time compile, runs anywhere JS runs (**G**) | Compiles to code: never safe for untrusted input (**G**) | MIT (**G**) | MarkupMe MDX output is planned and must keep execution off for untrusted documents. |
| Docusaurus | React static site generator; MDX content (**G**) | Config file, docs and blog plugins, themes (**G**) | Plugins and swizzled theme components (**G**) | MDX (**G**) | Node build, static output (**G**) | Content is trusted code (MDX) (**G**) | MIT (**G**) | Full docs framework: versioning, i18n, search integrations (**G**). |
| VitePress | Vue and Vite static site generator (**G**) | Markdown pages with Vue components (**G**) | markdown-it plugins; Vue theme (**G**) | markdown-it based (**G**) | Node build, static output (**G**) | Content is trusted (Vue in Markdown) (**G**) | MIT (**G**) | Shiki highlighting, `:::` containers, `[[toc]]` (**G**). Inspiration for MarkupMe's containers and TOC marker. |
| Nextra | Next.js-based docs framework on MDX (**G**) | Pages and theme config (**G**) | MDX plugins, theme (**G**) | MDX (**G**) | Next.js (**G**) | Trusted content (**G**) | MIT (**G**) | Tied to Next.js (**G**). |
| Astro Starlight | Docs theme and integration for Astro (**G**) | Content collections in Markdown or MDX (**G**) | Astro integrations, remark and rehype plugins (**G**) | Markdown via remark; MDX optional (**G**) | Node build, static output (**G**) | Trusted content (**G**) | MIT (**G**) | Strong accessibility and i18n focus (**A**). Supports `:::note` asides via directives (**G**). |

### Conversion, diagrams and tooling

| Project | Architecture | Programming model | Plugin mechanism | Standards | Runtime | Security default | Licence | Notes |
| ------- | ------------ | ----------------- | ---------------- | --------- | ------- | ---------------- | ------- | ----- |
| Pandoc | Readers to a Haskell AST to writers (**G**) | CLI `pandoc in.md -o out.docx`; library (**G**) | Lua filters, JSON filters, custom readers and writers (**G**) | Pandoc Markdown, CommonMark, GFM and many more (**G**) | Native binary; WASM builds exist (**A**) | Converts; raw HTML passes to HTML output (**A**) | GPL-2.0-or-later (**G**) | The reference for PDF/DOCX. Calling the binary is fine; linking GPL code into MIT packages is not (**G**). Option for Phase 2 export as an external tool (**A**). |
| Mermaid | Text grammars to SVG, rendered with a DOM (**G**) | `mermaid.run()` / `mermaid.render()` in a browser (**G**) | Diagram types registered internally; external diagrams API (**A**) | Own syntax per diagram type (**G**) | Browser; server rendering needs a headless browser (**G**) | `securityLevel` (`strict` blocks HTML labels and click scripts) (**G**) | MIT (**G**) | Used client-side ([ADR 0006](../architecture/architecture-decision-records/0006-mermaid-client-side.md)). |
| PlantUML | Java program; Graphviz for some diagram types (**G**) | CLI, server, or encoded URLs (**G**) | Standard library, includes, themes (**G**) | Own syntax; C4 via C4-PlantUML (**G**) | JVM (**G**) | Server can fetch includes; needs care when hosted (**A**) | Several editions: GPL by default, also LGPL, Apache, EPL and MIT builds (**A**) | MarkupMe reaches it only through Kroki, opt-in. |
| Structurizr DSL | Text DSL for C4 models; renders through Structurizr tools or exporters (**G**) | CLI / Lite / cloud (**G**) | Scripts and plugins (**A**) | Own DSL (**G**) | JVM (**G**) | n/a | Apache-2.0 for the open-source parts (**A**) | Through Kroki, opt-in. |
| Shiki | TextMate grammars and VS Code themes, output as HTML with inline styles (**G**) | `createHighlighter`, `codeToHtml` (**G**) | Transformers, custom languages and themes (**G**) | n/a | Node, browsers (Oniguruma WASM or JS regex engine) (**G**) | Escapes code; output uses `style` attributes (**G**) | MIT (**G**) | Used by `@markupme/highlight` with dual themes. |
| Prettier | Parses to an AST, prints with its own algorithm (**G**) | `prettier --write`; API (**G**) | Plugins for languages (**G**) | Markdown via remark (older parser version) (**A**) | Node (**G**) | n/a | MIT (**G**) | Formats Markdown but does not know MarkupMe directives or alerts (**A**). |
| markdownlint | Rule engine over markdown-it tokens (newer versions also micromark) (**A**) | `markdownlint` library, `markdownlint-cli2` (**G**) | Custom rules (**G**) | CommonMark (**G**) | Node (**G**) | n/a | MIT (**G**) | Large rule set with stable `MDxxx` ids (**G**). MarkupMe uses `MMxxx` codes in the same spirit. |

## Reusable ideas we took

| Idea | From | Where in MarkupMe |
| ---- | ---- | ----------------- |
| Standard syntax trees and a serializer | unified/remark | `@markupme/core` document model |
| GitHub's sanitize schema and `user-content-` prefix | GitHub, `hast-util-sanitize` | `markupmeSchema`, un-clobbering of generated ids |
| `> [!NOTE]` alerts | GitHub | `plugins/alerts.ts` |
| `:::` containers, `[[toc]]` | VitePress, markdown-it-container, Starlight asides | directives, TOC markers |
| Fence meta `title=`, `{1,3-5}`, `showLineNumbers` | VitePress, rehype-pretty-code, Docusaurus | `parseMeta` in `@markupme/highlight` |
| Dual light/dark highlighting with CSS variables | Shiki | `highlightHandler` |
| Stable rule ids | markdownlint | `MM001`… codes |
| A diagram gateway for many grammars | Kroki | opt-in `krokiProvider` |

## Feature-gap analysis

### What MarkupMe adds

Each item is built and tested in 0.1.0 unless marked otherwise.

1. **One CLI for the whole workflow.** `render`, `validate`/`lint`, `format`, `toc`, `build`, `serve`, `diagram`, `parse`, `stats`, `diff`, `capabilities` and `init` share one config file, one set of feature flags and stable exit codes (0/1/2/3/64). Comparable tools split this across marked or markdown-it (render), markdownlint (lint), Prettier (format), doctoc-style tools (TOC), and a docs framework (build, serve).
2. **Sanitize by default with trusted slots.** Raw HTML is cleaned with the GitHub schema, while highlighting, diagrams and KaTeX are inserted after sanitizing through random-nonce placeholders. marked and showdown leave sanitizing to the caller; react-markdown is safe but drops raw HTML instead of sanitizing it unless you add plugins.
3. **Diagram provider interface.** Blueprint and Graphviz render to sanitized SVG on the server with no system binaries (Graphviz via WebAssembly). Mermaid renders in the browser from a local copy. PlantUML, C4, Structurizr and D2 work through a Kroki server only when configured. Errors become diagnostics plus an inline error box. Results are cached by SHA-256.
4. **GitHub alerts and generic directives together**: `> [!NOTE]` alerts, `:::note` and seven other callouts, `:::details`, `:::figure`, `::::columns`, `:kbd[]`, `:abbr[]{title}`, `:mark[]`, `:sub[]`, `:sup[]`, `:badge[]{type}`, with unknown directives kept and reported.
5. **Round-trip check.** `roundTrip()` says whether serializing changes the document. The serializer keeps alerts, `{#custom}` ids, directives and TOC markers.
6. **Capability honesty.** `markupme capabilities` lists what is built, opt-in and planned. Planned formats exit 64 in the CLI and return HTTP 501 from the API instead of producing something half-done. Work in progress is listed as planned with an "in progress" note, and an SDODS scenario checks the table over the API.
7. **Structured diagnostics everywhere**: stable codes, `file:line:col` output, JSON output, GitHub Actions annotations.
8. **Local preview server with a JSON API** (`/api/render`, `/api/validate`, `/api/stats`) that other tools and the SDODS tests can call.
9. **Offline by default**: no CDN for Mermaid or KaTeX; no network unless Kroki is configured.

### What MarkupMe lacks

| Gap | Who has it | Plan |
| --- | ---------- | ---- |
| PDF and DOCX export | Pandoc | Phase 2. Meanwhile print the standalone HTML. |
| MDX | MDX, Docusaurus, Nextra | Phase 2, with execution off for untrusted documents. |
| Web studio, VS Code extension, React component | Milkdown, MDXEditor; VS Code built-in preview; react-markdown | In progress, Phase 1 (PR#2, PR#3). |
| WYSIWYG editing | Milkdown, Tiptap, MDXEditor | Phase 2, after the spike in ADR 0007. |
| Raw speed | marked, markdown-it are faster (**A**) | Not measured. Performance targets are in [NFR.md](../product/NFR.md). |
| Byte-exact formatting preservation | Nobody in this list does it fully; Prettier is closest in output stability (**A**) | Normalized output with an honest round-trip report. |
| Large lint rule set | markdownlint | 10 rules today; add rules by demand. |
| Docs framework features: versioning, i18n, full-text search service, theming system | Docusaurus, VitePress, Starlight | `build` has navigation and a client-side substring search only. Not a goal to match them. |
| Large plugin ecosystem | markdown-it, remark | remark plugins can be added through `MarkupMePlugin.remarkPlugins`. |
| Diagram PNG export | Kroki, mermaid-cli | SVG only. |
| Browser test coverage for the core | n/a | The core has no `node:` imports, but it has not run in a browser yet (the SDODS ui suite tests server-rendered pages); the studio will be the first browser use. |
| CommonMark spec suite run | micromark, commonmark.js publish results | We rely on micromark; running the spec examples in our own tests is a Phase 1 follow-up. |
