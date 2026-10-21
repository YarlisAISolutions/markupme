# ADR 0006: Mermaid renders in the browser, no CDN by default

- Status: Accepted
- Date: 2026-10-20

## Context

Mermaid is the most used diagram syntax in Markdown, but it lays out text through the browser DOM. Most Markdown tools load Mermaid from a public CDN. That makes rendered pages depend on a third party, breaks offline use, and lets the CDN see who reads the page.

## Decision

- The Mermaid provider emits `<pre class="mermaid">` with the escaped source. The page runtime (`runtimeScript` in `@markupme/themes`) loads Mermaid only when such a block exists, initializes it with `securityLevel: 'strict'`, and re-renders on theme change.
- The script URL comes from `window.MARKUPME_MERMAID_URL`, which the page sets. The CLI fills it with a local copy:
  - `render -s -o <file>` copies `mermaid.min.js` (from the `mermaid` dependency of `@markupme/cli`) into `<output dir>/assets/` or `--assets-dir`;
  - `render -s` to stdout, or `--inline-assets`, puts Mermaid inside the page;
  - `build` writes `assets/mermaid.min.js` once for the site;
  - `serve` serves it at `/__markupme/mermaid.min.js`.
- A remote URL is used only with `--mermaid-url <url>`.
- `markupme diagram -o` exports Mermaid to SVG through headless Chromium when the optional `playwright` peer dependency is installed, and exits 64 with install instructions when it is not.

KaTeX follows the same rule: its CSS and fonts are copied into the assets folder, or the CSS is inlined.

## Alternatives

| Option | Why not |
| ------ | ------- |
| CDN by default | Third-party dependency, privacy leak, offline failure. |
| Server-side Mermaid with jsdom | Unreliable layout. |
| Always run headless Chromium | Makes every render slow and needs a large optional dependency. |

## Consequences

- Rendered pages work offline and make no third-party requests by default.
- Pages with Mermaid include or link a large script (the Mermaid bundle is several MB; exact size not measured here). Pages without Mermaid load nothing.
- Readers with JavaScript off see the Mermaid source in a `<pre>`, which stays readable.
- The test `writes a standalone page with Mermaid copied to assets` checks the copy step.
