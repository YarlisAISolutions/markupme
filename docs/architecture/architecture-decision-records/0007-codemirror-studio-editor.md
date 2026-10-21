# ADR 0007: CodeMirror 6 for the studio; rich-text editing deferred

- Status: Accepted. The studio (`apps/studio`) is in progress in Phase 1; this ADR records the editor choice it is built on.
- Date: 2026-10-20

## Context

The brief asks for a browser studio with source, split and preview modes, an outline, a command palette, autosave and export, plus a rich-text mode, and says to use CodeMirror 6 for source editing and to evaluate Milkdown and Tiptap against explicit criteria before choosing a rich-text editor. Rich-text editors keep their own document model (ProseMirror), which is where Markdown fidelity is usually lost.

## Decision

1. **Source editing uses CodeMirror 6** with its Markdown language support. The source text is the single source of truth. The preview renders it through `@markupme/core` (with highlighting and diagrams), so the studio, the CLI and the serve API render the same way.
2. **The studio is built with Vite** as an app in `apps/studio`. Phase 1 scope: source, split and preview modes; outline from `outline()`; command palette; local autosave; export to HTML and Markdown.
3. **Rich-text (WYSIWYG) editing is deferred to Phase 2.** It stays `planned` in `markupme capabilities`. Before we pick Milkdown or Tiptap, a spike must measure both against these criteria, and the winner must pass all of them:

| # | Criterion | Measure |
| - | --------- | ------- |
| RT-1 | Round-trip fidelity | Load `examples/kitchen-sink.md`, make no edit, export. `roundTrip` of the result against the original is lossless, and alerts, directives, `{#custom}` ids, footnotes, task lists, tables and TOC markers are all present. |
| RT-2 | Unknown syntax is kept | A document with an unknown directive and raw HTML comes back unchanged after a no-op edit. |
| RT-3 | Edit locality | Editing one paragraph changes only that block in `markupme diff` output. |
| RT-4 | Source mode sync | Switching rich-text to source and back keeps the cursor block and loses no text. |
| RT-5 | Security | Pasting HTML with scripts or event handlers into the editor leaves nothing executable in the exported HTML (same attack list as `core.test.ts`). |
| RT-6 | Accessibility | Keyboard-only editing of headings, lists, links and tables; toolbar has accessible names; no axe-core violations of serious or critical level. |
| RT-7 | Licence | MIT-compatible licence for everything bundled, with no paid tier required for the features we use. |
| RT-8 | Bundle cost | Gzipped size added to the studio is recorded; the target is under 300 KB (a target, not a measurement). |
| RT-9 | Maintenance | A release within the last 6 months and an open issue tracker. |

## Alternatives

| Option | Why not (now) |
| ------ | ------------- |
| Monaco | Large, desktop-oriented, weak on mobile; CodeMirror 6 is modular and accessible. |
| A `<textarea>` (as in the serve playground) | Fine for the playground; no syntax highlighting, folding, search or extensions for a real editor. |
| Pick Milkdown or Tiptap now | No measured evidence yet that either keeps MarkupMe's syntax extensions. |
| Lexical | Not Markdown-first; its Markdown import/export is a conversion layer (general knowledge). |

## Consequences

- Phase 1 ships a source-first studio. Users who need WYSIWYG wait for Phase 2.
- Editor state never leaks into the core; the core only sees Markdown strings.
- The rich-text spike has a written pass/fail bar, so the choice can be checked.
