import type { Processor, ProcessorOptions, RenderOptions } from '@markupme/core'
import type { Root } from 'hast'
import type { Components } from 'hast-util-to-jsx-runtime'
import {
  createElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Fragment } from 'react/jsx-runtime'
import { renderToTree, treeToReact } from './tree.js'

/** Replace any HTML element with your own component: `{ a: MyLink, h1: MyHeading }`. */
export type MarkdownComponents = Partial<Components>

export interface MarkdownOptions {
  /** Parser features (GFM, frontmatter, math, emoji, TOC …). Ignored when `processor` is given. */
  options?: ProcessorOptions
  /** Render options. HTML is sanitized unless `sanitize: false`; `codeBlocks` adds handlers. */
  render?: Omit<RenderOptions, 'format'>
  /** Element overrides. */
  components?: MarkdownComponents
  /** A processor to reuse (created with `createProcessor`). */
  processor?: Processor
}

/**
 * Renders Markdown to a React element. Use it on the server: in a React Server Component
 * (`return await renderToReact(source)`) or before `renderToString` / `renderToStaticMarkup`.
 */
export async function renderToReact(
  source: string,
  o: MarkdownOptions = {},
): Promise<ReactElement> {
  const { tree } = await renderToTree(source, o)
  return treeToReact(tree, o.components)
}

/** A stable key for options: values compared by content, functions by position only. */
function optionsKey(o: MarkdownOptions): string {
  return JSON.stringify([o.options ?? null, o.render ?? null], (_k, v) =>
    typeof v === 'function' ? 'fn' : v,
  )
}

/**
 * Renders Markdown in a client component. Rendering is asynchronous (code block handlers may
 * load highlighters or WebAssembly), so the first render returns `null` and the element follows
 * after an effect; on the server (no effects) it stays `null` — use {@link renderToReact} there.
 *
 * `options` and `render` are compared by value, so inline objects are fine. Handlers and plugins
 * are read when the source or those values change; pass a new `processor` (or change a value) to
 * re-render with different handlers. `components` apply immediately. Errors are thrown during
 * render, so an error boundary can catch them.
 */
export function useMarkdown(source: string, o: MarkdownOptions = {}): ReactElement | null {
  const [state, setState] = useState<{ tree: Root } | { error: unknown } | null>(null)
  const latest = useRef(o)
  latest.current = o
  const key = optionsKey(o)
  const processor = o.processor
  useEffect(() => {
    let cancelled = false
    // `key` and `processor` are dependencies: options are read from the ref when they change.
    void key
    void processor
    renderToTree(source, latest.current).then(
      (r) => {
        if (!cancelled) setState({ tree: r.tree })
      },
      (error: unknown) => {
        if (!cancelled) setState({ error })
      },
    )
    return () => {
      cancelled = true
    }
  }, [source, key, processor])
  if (state && 'error' in state) throw state.error
  const tree = state?.tree
  const components = o.components
  return useMemo(() => (tree ? treeToReact(tree, components) : null), [tree, components])
}

export interface MarkdownProps extends MarkdownOptions {
  /** Markdown source. */
  source: string
  /** Shown until the first render finishes (and during server rendering). Default nothing. */
  fallback?: ReactNode
  /** When set, wraps the output in a `<div>` with this class (for example `markupme`). */
  className?: string
}

/**
 * `<Markdown source={md} options={{ math: true }} components={{ a: Link }} />`. A client
 * component built on {@link useMarkdown}; for server rendering use {@link renderToReact}.
 */
export function Markdown({
  source,
  fallback = null,
  className,
  ...o
}: MarkdownProps): ReactElement {
  const element = useMarkdown(source, o)
  const content = element ?? createElement(Fragment, null, fallback)
  return className ? createElement('div', { className }, content) : content
}
