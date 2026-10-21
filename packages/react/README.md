# @markupme/react

MarkupMe for React. Standards-first Markdown (CommonMark + GFM) rendered to React elements, with sanitized HTML by default, component overrides, and the MarkupMe highlighting and diagram handlers.

```sh
npm install @markupme/react react
```

React 18 or later is a peer dependency.

## How it works

`@markupme/core` renders Markdown to HTML (sanitized with GitHub's schema unless you turn it off). The HTML is parsed into a hast tree with `hast-util-from-html` and turned into React elements with `hast-util-to-jsx-runtime`. No `dangerouslySetInnerHTML` is used, so `components` can replace any element.

Code block handlers (syntax highlighting, diagrams) are trusted: their output is inserted after sanitization, as in core.

## Server rendering and Server Components

Use `renderToReact`. It is async and returns a `ReactElement`.

```tsx
import { renderToReact } from '@markupme/react'

export default async function Page() {
  const content = await renderToReact(markdown, { options: { math: true } })
  return <article className="markupme">{content}</article>
}
```

It works the same way before `renderToString` or `renderToStaticMarkup`:

```ts
const html = renderToStaticMarkup(await renderToReact(markdown))
```

## Client components

```tsx
'use client'
import { Markdown } from '@markupme/react'

<Markdown
  source={markdown}
  options={{ emoji: true }}
  render={{ anchors: true }}
  components={{ a: Link, h1: Title }}
  fallback={<Spinner />}
  className="markupme"
/>
```

Or with the hook:

```tsx
import { useMarkdown } from '@markupme/react'

function Preview({ source }: { source: string }) {
  return useMarkdown(source, { options: { gfm: true } })
}
```

Rendering is asynchronous (code block handlers can load a highlighter or WebAssembly), so `useMarkdown` keeps the result in state and fills it from an effect:

- The first render returns `null` (`<Markdown>` shows `fallback`). Effects do not run on the server, so `<Markdown>` renders only its fallback there. Use `renderToReact` for server rendering.
- `options` and `render` are compared by value, so inline objects do not cause re-renders. Handlers and plugins are read whenever the source or those values change; pass a new `processor` to switch handlers.
- `components` apply right away, without rendering again.
- Errors are thrown during render, so an error boundary can catch them.

## Highlighting and diagrams

```ts
import { diagramHandler } from '@markupme/diagrams'
import { highlightHandler } from '@markupme/highlight'

const diagrams = diagramHandler()
const content = await renderToReact(markdown, {
  render: { codeBlocks: [diagrams, highlightHandler({ skip: diagrams.langs })] },
})
```

Graphviz and Blueprint diagrams become inline SVG. Mermaid blocks become `<pre class="mermaid">` for Mermaid to render in the browser. Add the stylesheet from `@markupme/themes` (`@markupme/themes/markupme.css`) for the MarkupMe look.

## API

| Export | What it does |
| --- | --- |
| `renderToReact(source, options?)` | `Promise<ReactElement>` for SSR and Server Components. |
| `useMarkdown(source, options?)` | Hook. `ReactElement \| null`. |
| `<Markdown source … />` | Component on top of `useMarkdown`, with `fallback` and `className`. |
| `renderToTree(source, options?)` | The hast tree, diagnostics and title. |
| `treeToReact(tree, components?)` | hast to React elements. |
| `htmlToReact(html, components?)` | Trusted HTML string to React elements. |

Options: `options` (core `ProcessorOptions`), `render` (core `RenderOptions` without `format`), `components`, `processor` (a reusable `createProcessor` result).

## License

MIT
