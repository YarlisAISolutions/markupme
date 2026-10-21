/**
 * The MarkupMe stylesheet. Scoped to `.markupme`, light/dark through `prefers-color-scheme` and a
 * `data-theme` override on any ancestor, plus print rules. Colours meet WCAG AA contrast.
 */
export const markupmeCss = `
:root {
  --mm-bg: #ffffff;
  --mm-fg: #1f2328;
  --mm-muted: #59636e;
  --mm-border: #d1d9e0;
  --mm-subtle: #f6f8fa;
  --mm-link: #0969da;
  --mm-accent: #8250df;
  --mm-mark: #fff8c5;
  --mm-line-hl: rgba(84, 174, 255, 0.15);
  --mm-diagram-paper: #ffffff;
  --mm-note: #0969da;
  --mm-tip: #1a7f37;
  --mm-important: #8250df;
  --mm-warning: #9a6700;
  --mm-caution: #cf222e;
  --mm-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  --mm-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --mm-bg: #0d1117;
    --mm-fg: #e6edf3;
    --mm-muted: #9198a1;
    --mm-border: #3d444d;
    --mm-subtle: #151b23;
    --mm-link: #4493f8;
    --mm-accent: #ab7df8;
    --mm-mark: #bb800926;
    --mm-line-hl: rgba(56, 139, 253, 0.2);
    --mm-diagram-paper: #ffffff;
    --mm-note: #4493f8;
    --mm-tip: #3fb950;
    --mm-important: #ab7df8;
    --mm-warning: #d29922;
    --mm-caution: #f85149;
    color-scheme: dark;
  }
}
:root[data-theme='dark'] {
  --mm-bg: #0d1117;
  --mm-fg: #e6edf3;
  --mm-muted: #9198a1;
  --mm-border: #3d444d;
  --mm-subtle: #151b23;
  --mm-link: #4493f8;
  --mm-accent: #ab7df8;
  --mm-mark: #bb800926;
  --mm-line-hl: rgba(56, 139, 253, 0.2);
  --mm-diagram-paper: #ffffff;
  --mm-note: #4493f8;
  --mm-tip: #3fb950;
  --mm-important: #ab7df8;
  --mm-warning: #d29922;
  --mm-caution: #f85149;
  color-scheme: dark;
}
body.mm-page { margin: 0; background: var(--mm-bg); color: var(--mm-fg); font-family: var(--mm-font); }
.mm-layout { display: grid; grid-template-columns: minmax(0, 1fr); max-width: 1180px; margin: 0 auto; padding: 24px 16px 64px; gap: 32px; }
.mm-layout.mm-has-sidebar { grid-template-columns: 240px minmax(0, 1fr); }
.mm-sidebar { position: sticky; top: 16px; align-self: start; max-height: calc(100vh - 32px); overflow: auto; font-size: 14px; }
.mm-sidebar ul { list-style: none; padding-left: 12px; margin: 4px 0; }
.mm-sidebar > ul { padding-left: 0; }
.mm-sidebar a { color: var(--mm-muted); text-decoration: none; display: block; padding: 2px 0; }
.mm-sidebar a:hover, .mm-sidebar a[aria-current='page'] { color: var(--mm-link); }
.mm-topbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; max-width: 1180px; margin: 0 auto; padding: 12px 16px; border-bottom: 1px solid var(--mm-border); }
.mm-topbar a { color: var(--mm-fg); font-weight: 600; text-decoration: none; }
.mm-theme-toggle, .mm-search input { font: inherit; color: var(--mm-fg); background: var(--mm-subtle); border: 1px solid var(--mm-border); border-radius: 6px; padding: 4px 10px; }
.mm-theme-toggle { cursor: pointer; }
@media (max-width: 860px) { .mm-layout.mm-has-sidebar { grid-template-columns: minmax(0, 1fr); } .mm-sidebar { position: static; max-height: none; } }

.markupme { max-width: 860px; font-size: 16px; line-height: 1.6; word-wrap: break-word; color: var(--mm-fg); }
.markupme > *:first-child { margin-top: 0 !important; }
.markupme h1, .markupme h2, .markupme h3, .markupme h4, .markupme h5, .markupme h6 { margin: 1.5em 0 0.75em; font-weight: 600; line-height: 1.25; scroll-margin-top: 16px; position: relative; }
.markupme h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid var(--mm-border); }
.markupme h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--mm-border); }
.markupme h3 { font-size: 1.25em; } .markupme h4 { font-size: 1em; } .markupme h5 { font-size: 0.875em; } .markupme h6 { font-size: 0.85em; color: var(--mm-muted); }
.markupme p, .markupme ul, .markupme ol, .markupme blockquote, .markupme table, .markupme pre, .markupme details, .markupme figure { margin: 0 0 16px; }
.markupme a { color: var(--mm-link); text-decoration: underline; text-underline-offset: 0.2em; }
.markupme a:focus-visible, .markupme button:focus-visible, .markupme summary:focus-visible, .markupme pre:focus-visible { outline: 2px solid var(--mm-link); outline-offset: 2px; border-radius: 4px; }
.markupme .mm-anchor { margin-left: 0.4em; color: var(--mm-muted); text-decoration: none; opacity: 0; font-weight: 400; }
.markupme h1:hover .mm-anchor, .markupme h2:hover .mm-anchor, .markupme h3:hover .mm-anchor, .markupme h4:hover .mm-anchor, .markupme h5:hover .mm-anchor, .markupme h6:hover .mm-anchor, .markupme .mm-anchor:focus { opacity: 1; }
.markupme ul, .markupme ol { padding-left: 2em; }
.markupme li + li { margin-top: 0.25em; }
.markupme .contains-task-list { list-style: none; padding-left: 1.2em; }
.markupme .task-list-item input { margin: 0 0.4em 0 -1.2em; vertical-align: middle; }
.markupme blockquote { padding: 0 1em; color: var(--mm-muted); border-left: 0.25em solid var(--mm-border); }
.markupme hr { height: 0.25em; padding: 0; margin: 24px 0; background: var(--mm-border); border: 0; }
.markupme code, .markupme kbd { font-family: var(--mm-mono); font-size: 85%; }
.markupme :not(pre) > code { padding: 0.2em 0.4em; background: var(--mm-subtle); border-radius: 6px; }
.markupme kbd { display: inline-block; padding: 2px 5px; line-height: 1; border: 1px solid var(--mm-border); border-bottom-width: 2px; border-radius: 6px; background: var(--mm-subtle); }
.markupme mark { background: var(--mm-mark); color: inherit; padding: 0 2px; }
.markupme abbr[title] { text-decoration: underline dotted; cursor: help; }
.markupme img { max-width: 100%; height: auto; box-sizing: content-box; }
.markupme table { display: block; width: max-content; max-width: 100%; overflow: auto; border-spacing: 0; border-collapse: collapse; }
.markupme th, .markupme td { padding: 6px 13px; border: 1px solid var(--mm-border); }
.markupme th { font-weight: 600; background: var(--mm-subtle); }
.markupme tr:nth-child(2n) td { background: color-mix(in srgb, var(--mm-subtle) 60%, transparent); }
.markupme details { border: 1px solid var(--mm-border); border-radius: 6px; padding: 8px 12px; }
.markupme summary { cursor: pointer; font-weight: 600; }
.markupme .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.markupme .footnotes { font-size: 0.875em; color: var(--mm-muted); border-top: 1px solid var(--mm-border); padding-top: 8px; }

.markupme pre, .markupme .mm-pre { padding: 16px; overflow: auto; font-size: 85%; line-height: 1.45; background: var(--mm-subtle); border-radius: 6px; }
.markupme pre code { padding: 0; background: transparent; font-size: 100%; }
.markupme .mm-code { position: relative; margin: 0 0 16px; }
.markupme .mm-code pre { margin: 0; }
.markupme .mm-code-title { font-family: var(--mm-mono); font-size: 12px; color: var(--mm-muted); padding: 6px 16px; background: var(--mm-subtle); border: 1px solid var(--mm-border); border-bottom: 0; border-radius: 6px 6px 0 0; }
.markupme .mm-code-title + .mm-copy + pre, .markupme .mm-code-title + pre { border-radius: 0 0 6px 6px; }
.markupme .mm-copy { position: absolute; right: 8px; top: 8px; z-index: 1; font: 12px var(--mm-font); color: var(--mm-muted); background: var(--mm-bg); border: 1px solid var(--mm-border); border-radius: 6px; padding: 3px 8px; cursor: pointer; opacity: 0; transition: opacity 0.15s; }
.markupme .mm-code-title ~ .mm-copy { top: 38px; }
.markupme .mm-code:hover .mm-copy, .markupme .mm-copy:focus-visible, .markupme .mm-copy[data-copied] { opacity: 1; }
.markupme .shiki span { color: var(--shiki-light); }
.markupme .shiki { background-color: var(--shiki-light-bg, var(--mm-subtle)) !important; }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) .markupme .shiki span { color: var(--shiki-dark); } :root:not([data-theme='light']) .markupme .shiki { background-color: var(--shiki-dark-bg, var(--mm-subtle)) !important; } }
:root[data-theme='dark'] .markupme .shiki span { color: var(--shiki-dark); }
:root[data-theme='dark'] .markupme .shiki { background-color: var(--shiki-dark-bg, var(--mm-subtle)) !important; }
.markupme .mm-line-numbers code { counter-reset: mm-line calc(var(--mm-start, 1) - 1); }
.markupme .mm-line-numbers .line::before { counter-increment: mm-line; content: counter(mm-line); display: inline-block; width: 2.5em; margin-right: 1em; text-align: right; color: var(--mm-muted); user-select: none; }
.markupme .mm-line-highlight { display: inline-block; width: 100%; background: var(--mm-line-hl); }

.markupme .markdown-alert, .markupme .mm-callout { padding: 8px 16px; margin: 0 0 16px; color: inherit; border-left: 0.25em solid var(--mm-c, var(--mm-note)); border-radius: 0 6px 6px 0; background: color-mix(in srgb, var(--mm-c, var(--mm-note)) 6%, transparent); }
.markupme .markdown-alert > :last-child, .markupme .mm-callout > :last-child { margin-bottom: 0; }
.markupme .markdown-alert-title, .markupme .mm-callout-title { font-weight: 600; color: var(--mm-c, var(--mm-note)); margin-bottom: 4px; }
.markupme .markdown-alert-note, .markupme .mm-callout-note, .markupme .mm-callout-info { --mm-c: var(--mm-note); }
.markupme .markdown-alert-tip, .markupme .mm-callout-tip, .markupme .mm-callout-success { --mm-c: var(--mm-tip); }
.markupme .markdown-alert-important, .markupme .mm-callout-important { --mm-c: var(--mm-important); }
.markupme .markdown-alert-warning, .markupme .mm-callout-warning { --mm-c: var(--mm-warning); }
.markupme .markdown-alert-caution, .markupme .mm-callout-caution, .markupme .mm-callout-danger { --mm-c: var(--mm-caution); }
.markupme .mm-badge { display: inline-block; padding: 0 7px; font-size: 12px; font-weight: 500; line-height: 18px; border: 1px solid var(--mm-border); border-radius: 2em; }
.markupme .mm-badge-success { color: var(--mm-tip); border-color: var(--mm-tip); } .markupme .mm-badge-warning { color: var(--mm-warning); border-color: var(--mm-warning); } .markupme .mm-badge-danger { color: var(--mm-caution); border-color: var(--mm-caution); }
.markupme .mm-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.markupme .mm-figure { text-align: center; } .markupme figcaption { font-size: 0.875em; color: var(--mm-muted); }

.markupme .mm-toc { border: 1px solid var(--mm-border); border-radius: 6px; padding: 8px 16px; margin: 0 0 16px; background: var(--mm-subtle); }
.markupme .mm-toc::before { content: 'Contents'; display: block; font-weight: 600; margin-bottom: 4px; }
.markupme .mm-toc ul { margin: 0; padding-left: 1.2em; }
.markupme .mm-diagram { margin: 0 0 16px; padding: 12px; overflow: auto; text-align: center; border: 1px solid var(--mm-border); border-radius: 6px; background: var(--mm-bg); }
.markupme .mm-diagram svg { max-width: 100%; height: auto; }
/* Graphviz and Blueprint draw dark ink on white, so in dark mode they sit on a light paper card. */
.markupme .mm-diagram-graphviz, .markupme .mm-diagram-blueprint { background: var(--mm-diagram-paper); }
.markupme .mm-diagram pre.mermaid { background: transparent; text-align: left; }
.markupme .mm-diagram pre.mermaid[data-processed] { text-align: center; }
.markupme .mm-diagram-error { border: 1px solid var(--mm-caution); border-radius: 6px; padding: 8px 16px; margin: 0 0 16px; color: var(--mm-caution); }
.markupme .mm-diagram-error pre { color: var(--mm-fg); }
.markupme .katex-display { overflow-x: auto; overflow-y: hidden; }

@media print {
  .mm-sidebar, .mm-topbar, .mm-copy, .mm-anchor { display: none !important; }
  .mm-layout, .mm-layout.mm-has-sidebar { display: block; max-width: none; padding: 0; }
  .markupme { max-width: none; font-size: 11pt; color: #000; }
  .markupme a { color: #000; }
  .markupme a[href^='http']::after { content: ' (' attr(href) ')'; font-size: 0.85em; color: #555; }
  .markupme pre, .markupme .mm-diagram, .markupme table, .markupme blockquote, .markupme figure { break-inside: avoid; }
  .markupme h1, .markupme h2, .markupme h3 { break-after: avoid; }
}
`
