# ADR 0001: unified, remark and micromark as the parsing foundation

- Status: Accepted
- Date: 2026-10-20

## Context

MarkupMe needs CommonMark and GFM parsing with source positions, a syntax tree other tools can read, Markdown serialization for formatting and round trips, and a way to add syntax (directives, math, frontmatter). Writing a correct CommonMark parser is large work: the spec has hundreds of examples and many edge cases in emphasis, lists and link reference definitions. The brief says to reuse mature parsers unless there is strong evidence against them.

## Decision

Use the unified ecosystem:

- `remark-parse` (built on micromark) to parse.
- `remark-gfm`, `remark-frontmatter`, `remark-directive` and `remark-math` for extensions.
- `remark-stringify` to serialize, with the same extension list as the parser (`syntaxPlugins` in `packages/core/src/parse.ts`), so every construct the parser reads can be written back.
- `remark-rehype`, `rehype-raw`, `rehype-sanitize`, `rehype-katex` and `rehype-stringify` for HTML.

MarkupMe's own code is the layer on top: the document wrapper, heading ids, TOC, alerts, directive mapping, lint rules, the safe HTML pipeline, diff and stats.

## Alternatives

| Option | Why not |
| ------ | ------- |
| marked | Fast and small, but its main output is HTML strings and its token list is not a standard tree. No Markdown serializer. Extensions hook into the lexer and renderer, which makes source-preserving round trips hard. |
| markdown-it | Good CommonMark support and a large plugin set, but its token stream is flat and render-oriented, with no standard AST and no serializer. Formatting and diffing would need a second model. |
| Write our own parser | High cost and high risk of spec bugs, no ecosystem. Nothing in the requirements needs it. |

## Consequences

- The tree is mdast, so any unified utility (`unist-util-visit`, `mdast-util-to-string`) works on it, and users can bring remark plugins through `MarkupMePlugin.remarkPlugins`.
- Positions come for free, which the diagnostics and the planned editor integrations rely on.
- We inherit unified's dependency count (dozens of small packages). We pin exact versions in `package.json`.
- unified is ESM-only, so MarkupMe is ESM-only too.
- Throughput is lower than marked or markdown-it (general knowledge; not measured here). If a hot path needs raw speed, we can add a fast-path renderer behind the same document API later.
- Serialization is normalizing, not byte-preserving: bullet style, emphasis markers and spacing are rewritten. `roundTrip()` reports this honestly ([ADR 0004](0004-document-model.md)).
