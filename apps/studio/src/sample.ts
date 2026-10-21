/**
 * The welcome document. It starts at `##` because the Studio chrome owns the page's single h1.
 */
export const SAMPLE = `## Welcome to MarkupMe Studio

Write Markdown on the left and watch it render on the right. Everything runs in your browser: nothing is sent to a server. Press **Ctrl/⌘ K** for every command.

[[toc]]

### Text and tables

**Bold**, _italic_, \`inline code\`, ~~strikethrough~~ and a footnote.[^1]

| Feature      | Syntax               | Status |
| ------------ | -------------------- | :----: |
| Tables       | GitHub Flavored      |   ✓    |
| Task lists   | \`- [ ]\` / \`- [x]\`    |   ✓    |
| Diagrams     | Mermaid, DOT, ybp    |   ✓    |

### Tasks

- [x] Open MarkupMe Studio
- [x] Read the welcome document
- [ ] Write your own

### Alerts and callouts

> [!NOTE]
> GitHub alerts render as styled boxes.

:::tip
Callouts use the \`:::name\` directive syntax.
:::

### Code

\`\`\`ts title="hello.ts"
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

### Diagrams

A Mermaid flowchart:

\`\`\`mermaid
flowchart LR
  Write --> Preview --> Publish
\`\`\`

A Graphviz graph:

\`\`\`dot
digraph G {
  rankdir=LR
  node [shape=box, style=rounded]
  Markdown -> MarkupMe -> HTML
}
\`\`\`

A Yarlis Blueprint diagram:

\`\`\`ybp
flowchart "Rendering"
editor: Editor [service]
core: MarkupMe core [service]
preview: Preview [database]
editor -> core
core -> preview
\`\`\`

[^1]: Footnotes link both ways.
`
