import type { Root } from 'mdast'
import { toString as mdToString } from 'mdast-util-to-string'
import { parseDocument, tocOptions } from './parse.js'
import { insertToc } from './plugins/toc.js'
import { renderHtml } from './render/html.js'
import { renderText } from './render/text.js'
import { type SerializeOptions, serialize as serializeDoc } from './serialize.js'
import type {
  Diagnostic,
  MarkupMeDocument,
  MarkupMePlugin,
  ParseOptions,
  ProcessorOptions,
  RenderOptions,
  RenderResult,
  Rule,
  TocOptions,
  ValidateOptions,
} from './types.js'
import { stripPositions } from './util.js'
import { RULES, runRules } from './validate.js'

export type BuiltinTransform = 'toc' | 'normalize'

export interface TransformOptions {
  /** Built-in transforms by name, or plugins. Applied in order. */
  plugins?: (BuiltinTransform | MarkupMePlugin)[]
  toc?: TocOptions
}

export interface TransformResult {
  document: MarkupMeDocument
  diagnostics: Diagnostic[]
}

export interface Processor {
  readonly options: Readonly<ProcessorOptions>
  parse(source: string, opts?: ParseOptions): MarkupMeDocument
  transform(doc: MarkupMeDocument, opts?: TransformOptions): TransformResult
  render(input: MarkupMeDocument | string, opts?: RenderOptions): Promise<RenderResult>
  serialize(input: MarkupMeDocument | Root, opts?: SerializeOptions): string
  validate(input: MarkupMeDocument | string, opts?: ValidateOptions): Diagnostic[]
  /** Checks whether serializing and re-parsing keeps the tree. Reports what would change. */
  roundTrip(doc: MarkupMeDocument): {
    lossless: boolean
    markdown: string
    diagnostics: Diagnostic[]
  }
  /** The rules `validate` runs (built-in plus plugin rules). */
  rules(): Rule[]
}

function titleOf(doc: MarkupMeDocument): string | undefined {
  const t = doc.frontmatter?.title
  if (typeof t === 'string' && t.trim()) return t.trim()
  const h1 = doc.tree.children.find((n) => n.type === 'heading' && n.depth === 1)
  return h1 ? mdToString(h1) : undefined
}

/**
 * Creates an isolated processor. Options and plugins are fixed at creation; there is no global
 * registry, so two processors never affect each other.
 */
export function createProcessor(options: ProcessorOptions = {}): Processor {
  const opts: ProcessorOptions = Object.freeze({
    ...options,
    plugins: [...(options.plugins ?? [])],
  })
  const toDoc = (input: MarkupMeDocument | string) =>
    typeof input === 'string' ? parseDocument(input, opts) : input

  const processor: Processor = {
    options: opts,
    parse: (source, parseOpts) => parseDocument(source, opts, parseOpts),
    transform(doc, t = {}) {
      const next: MarkupMeDocument = {
        ...doc,
        tree: structuredClone(doc.tree),
        diagnostics: [...doc.diagnostics],
      }
      const diagnostics: Diagnostic[] = []
      const report = (d: Diagnostic) => diagnostics.push(d)
      for (const step of t.plugins ?? []) {
        if (step === 'toc') {
          if (!insertToc(next.tree, { position: 'after-title', ...tocOptions(opts), ...t.toc }))
            report({
              code: 'MM030',
              rule: 'toc',
              severity: 'info',
              message: 'No place found for a table of contents',
            })
        } else if (step === 'normalize') {
          const reparsed = parseDocument(
            serializeDoc(next, opts),
            opts,
            next.file ? { file: next.file } : {},
          )
          next.tree = reparsed.tree
        } else step.parse?.(next.tree, { doc: next, options: opts, report })
      }
      next.diagnostics.push(...diagnostics)
      return { document: next, diagnostics }
    },
    async render(input, r = {}) {
      const doc = toDoc(input)
      const format = r.format ?? 'html'
      const diagnostics: Diagnostic[] = [...doc.diagnostics]
      let output: string
      switch (format) {
        case 'html':
          output = await renderHtml(doc, opts, r, diagnostics)
          break
        case 'markdown':
          output = serializeDoc(doc, opts)
          break
        case 'ast':
          output = serializeDoc(doc, opts, { format: 'json', indent: r.indent ?? 2 })
          break
        case 'text':
          output = renderText(doc.tree)
          break
        default:
          throw new MarkupMeError('MM_FORMAT', `Unsupported render format "${String(format)}"`)
      }
      const title = titleOf(doc)
      return { format, output, diagnostics, ...(title ? { title } : {}) }
    },
    serialize: (input, s) => serializeDoc(input, opts, s),
    validate(input, v = {}) {
      return runRules(toDoc(input), processor.rules(), v)
    },
    roundTrip(doc) {
      const markdown = serializeDoc(doc, opts)
      const again = parseDocument(markdown, opts)
      const a = JSON.stringify(stripPositions(doc.tree))
      const b = JSON.stringify(stripPositions(again.tree))
      const lossless = a === b
      const diagnostics: Diagnostic[] = lossless
        ? []
        : [
            {
              code: 'MM031',
              rule: 'round-trip',
              severity: 'info',
              message:
                'Serialization normalizes this document (markers, spacing or escapes change); content is kept',
            },
          ]
      return { lossless, markdown, diagnostics }
    },
    rules: () => [...RULES, ...(opts.plugins ?? []).flatMap((p) => p.rules ?? [])],
  }
  return processor
}

/** Stable error with a code. */
export class MarkupMeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'MarkupMeError'
  }
}

let shared: Processor | undefined
const defaults = () => {
  shared ??= createProcessor()
  return shared
}

/** Parses with default options. */
export const parse = (source: string, opts?: ParseOptions) => defaults().parse(source, opts)
/** Renders with default options (HTML, sanitized). */
export const render = (input: MarkupMeDocument | string, opts?: RenderOptions) =>
  defaults().render(input, opts)
export const transform = (doc: MarkupMeDocument, opts?: TransformOptions) =>
  defaults().transform(doc, opts)
export const serialize = (input: MarkupMeDocument | Root, opts?: SerializeOptions) =>
  defaults().serialize(input, opts)
export const validate = (input: MarkupMeDocument | string, opts?: ValidateOptions) =>
  defaults().validate(input, opts)
