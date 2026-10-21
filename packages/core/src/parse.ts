import type { Root } from 'mdast'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { type PluggableList, unified } from 'unified'
import { annotateAlerts } from './plugins/alerts.js'
import { normalizeDirectives } from './plugins/directives.js'
import { readFrontmatter } from './plugins/frontmatter.js'
import { addHeadingIds } from './plugins/headings.js'
import { insertToc } from './plugins/toc.js'
import {
  type Diagnostic,
  type MarkupMeDocument,
  type ParseOptions,
  type PluginContext,
  type ProcessorOptions,
  SCHEMA_VERSION,
  type TocOptions,
} from './types.js'

/** Syntax extensions shared by the parser and the serializer, so round trips keep every construct. */
export function syntaxPlugins(opts: ProcessorOptions): PluggableList {
  const list: PluggableList = []
  if (opts.gfm !== false) list.push(remarkGfm)
  if (opts.frontmatter !== false) list.push([remarkFrontmatter, ['yaml', 'toml']])
  if (opts.directives !== false) list.push(remarkDirective)
  if (opts.math === true) list.push(remarkMath)
  for (const p of opts.plugins ?? []) if (p.remarkPlugins) list.push(...p.remarkPlugins)
  return list
}

export function tocOptions(opts: ProcessorOptions): TocOptions | undefined {
  if (opts.toc === false) return undefined
  return opts.toc === true || opts.toc === undefined ? {} : opts.toc
}

export function parseDocument(
  source: string,
  opts: ProcessorOptions,
  parseOpts: ParseOptions = {},
): MarkupMeDocument {
  const processor = unified().use(remarkParse).use(syntaxPlugins(opts))
  const tree = processor.runSync(processor.parse(source)) as Root
  const diagnostics: Diagnostic[] = []
  const file = parseOpts.file
  const report = (d: Diagnostic) => diagnostics.push(file ? { ...d, file } : d)

  const doc: MarkupMeDocument = {
    type: 'markupme-document',
    schemaVersion: SCHEMA_VERSION,
    source,
    tree,
    diagnostics,
    ...(file ? { file } : {}),
  }
  if (opts.frontmatter !== false) {
    const fm = readFrontmatter(tree, report)
    if (fm) doc.frontmatter = fm
  }
  if (opts.directives !== false) normalizeDirectives(tree, report)
  if (opts.alerts !== false) annotateAlerts(tree)
  if (opts.headingIds !== false) addHeadingIds(tree, report)
  const toc = tocOptions(opts)
  if (toc) insertToc(tree, toc)

  const ctx: PluginContext = { doc, options: opts, report }
  for (const p of opts.plugins ?? []) p.parse?.(tree, ctx)
  return doc
}
