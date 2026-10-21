import type { Heading, Root } from 'mdast'
import remarkStringify, { type Options as StringifyOptions } from 'remark-stringify'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { syntaxPlugins } from './parse.js'
import type { MarkupMeDocument, ProcessorOptions } from './types.js'

type Handle = NonNullable<NonNullable<StringifyOptions['handlers']>['toc']>

export type SerializeFormat = 'markdown' | 'json'

export interface SerializeOptions {
  format?: SerializeFormat
  /** List bullet. Default '-'. */
  bullet?: '-' | '*' | '+'
  /** Emphasis marker. Default '_'. */
  emphasis?: '_' | '*'
  /** Code fence character. Default '`'. */
  fence?: '`' | '~'
  /** JSON indent. Default 2. */
  indent?: number
}

/** A generated TOC is written between markers, so `markupme toc --write` can refresh it in place. */
const toc: Handle = (node, _parent, state, info) => {
  const body = state.containerFlow(node, info)
  return `<!-- toc -->\n\n${body}\n\n<!-- tocstop -->`
}

/** Puts custom `{#id}` heading ids back as text on a copy of the tree. */
function restoreCustomIds(tree: Root): Root {
  const copy = structuredClone(tree)
  visit(copy, 'heading', (node: Heading) => {
    const custom = (node.data as { customId?: string } | undefined)?.customId
    if (custom) node.children.push({ type: 'text', value: ` {#${custom}}` })
  })
  return copy
}

export function serializeMarkdown(tree: Root, opts: ProcessorOptions, s: SerializeOptions = {}) {
  const settings: StringifyOptions = {
    bullet: s.bullet ?? '-',
    emphasis: s.emphasis ?? '_',
    strong: '*',
    fence: s.fence ?? '`',
    fences: true,
    rule: '-',
    listItemIndent: 'one',
    handlers: { toc },
  }
  const processor = unified().use(remarkStringify, settings).use(syntaxPlugins(opts))
  return unescapeSafe(processor.stringify(restoreCustomIds(tree)))
}

/**
 * The directive extension escapes every `:` and the alert marker `[!NOTE]`. A colon not followed by
 * a letter can't start a directive, and alert markers must stay literal for GitHub, so both are
 * written back unescaped.
 */
function unescapeSafe(markdown: string): string {
  return markdown
    .replace(/\\:(?![A-Za-z])/g, ':')
    .replace(/^((?:> ?)+)\\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gim, '$1[!$2]')
}

export function serialize(
  input: MarkupMeDocument | Root,
  opts: ProcessorOptions,
  s: SerializeOptions = {},
): string {
  const tree = 'tree' in input ? input.tree : input
  if ((s.format ?? 'markdown') === 'json') {
    const payload = 'tree' in input ? { ...input, source: undefined } : tree
    return `${JSON.stringify(payload, null, s.indent ?? 2)}\n`
  }
  return serializeMarkdown(tree, opts, s)
}
