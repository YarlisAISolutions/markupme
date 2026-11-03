/**
 * The hast-level helpers behind `<Markdown>`, `useMarkdown` and `renderToReact`. Exported from
 * `@markupme/react/experimental` only: they tie callers to the hast version, so their shape may
 * change in a minor release. See docs/api-stability.md.
 */
import { createProcessor, type Diagnostic } from '@markupme/core'
import type { Root } from 'hast'
import { fromHtml } from 'hast-util-from-html'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import type { ReactElement } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import type { MarkdownComponents, MarkdownOptions } from './index.js'

export interface MarkdownTree {
  /** hast of the rendered (and, by default, sanitized) HTML. */
  tree: Root
  diagnostics: Diagnostic[]
  title?: string
}

/**
 * Renders Markdown to a hast tree: core renders (and sanitizes) HTML, which is parsed back with
 * `hast-util-from-html`. Code block handlers (highlighting, diagrams) are trusted, as in core.
 */
export async function renderToTree(source: string, o: MarkdownOptions = {}): Promise<MarkdownTree> {
  const processor = o.processor ?? createProcessor(o.options)
  const result = await processor.render(source, { ...o.render, format: 'html' })
  return {
    tree: fromHtml(result.output, { fragment: true }),
    diagnostics: result.diagnostics,
    ...(result.title ? { title: result.title } : {}),
  }
}

/** Turns a hast tree into React elements, with component overrides. */
export function treeToReact(tree: Root, components?: MarkdownComponents): ReactElement {
  return toJsxRuntime(tree, {
    Fragment,
    jsx,
    jsxs,
    ...(components ? { components } : {}),
    ignoreInvalidStyle: true,
  }) as ReactElement
}

/** Turns an HTML string (for example from `@markupme/core`'s `render`) into React elements. */
export function htmlToReact(html: string, components?: MarkdownComponents): ReactElement {
  return treeToReact(fromHtml(html, { fragment: true }), components)
}
