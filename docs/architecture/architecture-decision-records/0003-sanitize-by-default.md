# ADR 0003: Sanitize by default, insert trusted output through slots

- Status: Accepted
- Date: 2026-10-20

## Context

Markdown allows raw HTML, and many Markdown libraries pass it through unless the caller adds a sanitizer. People then render untrusted input and ship XSS. MarkupMe also produces HTML that a sanitizer would break: Shiki colours use `style`, diagrams are SVG, KaTeX uses `style`. And remark's GitHub-style id prefixing (`user-content-`) protects against DOM clobbering but breaks heading and footnote links if applied to MarkupMe's own ids.

## Decision

The HTML renderer (`packages/core/src/render/html.ts`) works like this:

1. Presentation transforms run on a copy of the tree.
2. mdast becomes hast with an empty clobber prefix. Before raw HTML is parsed, every existing `id` is recorded as trusted: only MarkupMe could have made it.
3. Fenced code blocks go to code block handlers. A handler's HTML is set aside and the block becomes an empty `<div>` with id `mm-slot-<nonce>-<n>`. The nonce is random per render.
4. Raw HTML is parsed (`rehype-raw`), then the whole tree is sanitized with `markupmeSchema`: the GitHub schema from `hast-util-sanitize` plus a short list of tags, ARIA attributes and an allowlist of MarkupMe class names.
5. The sanitizer's `user-content-` prefix is removed only from ids in the trusted set. Author-written ids keep it.
6. KaTeX runs, then slots are replaced by the trusted HTML.

`sanitize: true` is the default in the library, the CLI, `build` and `serve`. Turning it off needs an explicit `sanitize: false` / `--no-sanitize`, and over the serve API it also needs the server to run with `--unsafe`. Diagram SVG has its own sanitizer (`sanitizeSvg`) because it enters through a slot.

## Alternatives

| Option | Why not |
| ------ | ------- |
| Leave sanitizing to the caller (marked, markdown-it with `html: true`) | Unsafe by default; the brief requires secure-by-default rendering. |
| Escape all raw HTML | Safe, but breaks common uses like `<details>` and `<kbd>`. Still available as `allowHtml: false`. |
| Sanitize after inserting handler output | The sanitizer would strip Shiki styles and most SVG, so highlighting and diagrams would break. |
| Widen the schema to allow `style` and SVG | Opens CSS and SVG attack surface for every user's HTML. |
| DOMPurify | Needs a DOM (or jsdom on the server). The hast sanitizer runs anywhere and fits the pipeline. |

## Consequences

- Untrusted Markdown is safe by default; the tests in `core.test.ts` `describe('security')` check ten attack strings.
- Code block handlers are trusted code: their output is not sanitized. Built-in handlers escape their input and diagrams pass through `sanitizeSvg`. Third-party handlers must do the same. This is documented in [security.md](../../guide/security.md#trusted-slots).
- Author classes outside the allowlist are removed, which can surprise people who style with custom classes. That is intended.
- Any change to `markupmeSchema` needs a security test. The default must not be weakened.
