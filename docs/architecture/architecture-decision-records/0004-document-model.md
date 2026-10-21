# ADR 0004: Document model: mdast + schemaVersion + diagnostics

- Status: Accepted
- Date: 2026-10-20

## Context

The engine feeds several consumers: HTML rendering, Markdown serialization (format, TOC refresh), lint, diff, stats, and later the studio and editor integrations. If parse-time transforms rewrite the tree for presentation (for example turning an alert blockquote into a `div`), the serializer can no longer write the original Markdown, and round trips lose content. Tools that store or exchange the model also need to know which shape they have.

## Decision

The canonical document is `MarkupMeDocument` (`packages/core/src/types.ts`):

```ts
{ type: 'markupme-document', schemaVersion: 1, source, file?, tree /* mdast Root */, frontmatter?, diagnostics }
```

- `source` is kept exactly as given.
- `tree` is plain mdast with positions. MarkupMe adds information only in `data` fields or in its own node type: `data.hProperties.id` and `data.customId` on headings, `data.alert` on alert blockquotes, a `toc` node for generated TOCs.
- **Parse-time transforms are data-preserving.** Frontmatter is read but its node stays; directives are normalized (prose colons go back to text, unknown names are reported, never dropped); alerts are annotated; heading ids are added; TOC markers are replaced by a `toc` node that serializes back to `<!-- toc -->` markers.
- **Presentation transforms run on a clone at render time.** Alert boxes, directive-to-HTML mapping and emoji replacement change a `structuredClone` of the tree inside `renderHtml`.
- `schemaVersion` (`SCHEMA_VERSION = 1`) is bumped on a breaking change to the document shape. New fields stay optional.
- Problems are `Diagnostic` objects with stable codes, never exceptions.
- `roundTrip()` serializes, re-parses and compares trees without positions, and says whether the document is normalized (`MM031`).

## Alternatives

| Option | Why not |
| ------ | ------- |
| A custom document model separate from mdast | Loses the unified ecosystem and needs adapters both ways. |
| Presentation transforms at parse time | Simpler render code, but the serializer would write HTML-shaped Markdown or lose alerts, callouts and emoji shortcodes. |
| A concrete syntax tree for byte-exact round trips | Large work and not needed yet. We report normalization instead of hiding it. |
| Throwing on bad frontmatter or unknown syntax | Breaks editors and batch tools on one bad file. |

## Consequences

- `serialize(parse(x))` keeps every construct, including alerts, `{#custom}` ids, directives and TOC markers (tested in `round-trips the kitchen sink without loss` and `keeps a TOC block idempotent`).
- The Markdown output is normalized (markers, spacing), not byte-identical. `format` makes this explicit; `roundTrip` reports it.
- Plugin authors must keep `parse` hooks data-preserving and do presentation work in `render` hooks. The `MarkupMePlugin` doc comments say so.
- Editor-specific models (CodeMirror state, a future rich-text schema) stay out of the core; they convert to and from Markdown text.
