import type { Root as HastRoot } from 'hast'
import type { Literal, Root } from 'mdast'
import type { PluggableList } from 'unified'

/** TOML frontmatter (`+++`), produced by remark-frontmatter. */
export interface Toml extends Literal {
  type: 'toml'
}

declare module 'mdast' {
  interface RootContentMap {
    toml: Toml
  }
  interface FrontmatterContentMap {
    toml: Toml
  }
}

/** Bumped on a breaking change to {@link MarkupMeDocument}. New fields stay optional. */
export const SCHEMA_VERSION = 1

export type Severity = 'error' | 'warning' | 'info'

/** A problem found while parsing, validating or rendering. Stable shape: tools may depend on it. */
export interface Diagnostic {
  /** Stable code, e.g. `MM004`. */
  code: string
  /** Rule or subsystem name, e.g. `broken-fragment-link`. */
  rule: string
  severity: Severity
  message: string
  file?: string
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
}

/** The canonical document: the original source, its mdast tree (unist-compatible) and metadata. */
export interface MarkupMeDocument {
  type: 'markupme-document'
  schemaVersion: typeof SCHEMA_VERSION
  /** The Markdown source exactly as given. */
  source: string
  file?: string
  /** mdast root with source positions. Heading ids live in `data.hProperties.id`. */
  tree: Root
  /** Parsed frontmatter (YAML or TOML), when present and valid. */
  frontmatter?: Record<string, unknown>
  /** Diagnostics found while parsing. */
  diagnostics: Diagnostic[]
}

export interface TocOptions {
  /** Shallowest heading level to include. Default 2. */
  minDepth?: number
  /** Deepest heading level to include. Default 3. */
  maxDepth?: number
  /** Where to put it when the document has no `[[toc]]` / `<!-- toc -->` marker. Default 'marker-only'. */
  position?: 'marker-only' | 'top' | 'after-title'
  /** Heading text above the list in HTML output. Default 'Contents'. */
  title?: string
}

export interface ParseOptions {
  file?: string
}

/** Feature switches. Every switch has a safe default; all are independent. */
export interface ProcessorOptions {
  /** GitHub Flavored Markdown: tables, task lists, strikethrough, autolinks, footnotes. Default true. */
  gfm?: boolean
  /** YAML (`---`) and TOML (`+++`) frontmatter. Default true. */
  frontmatter?: boolean
  /** Generic directives (`:::note`, `::toc`, `:kbd[Ctrl]`). Default true. */
  directives?: boolean
  /** GitHub alerts (`> [!NOTE]`). Default true. */
  alerts?: boolean
  /** `$inline$` and `$$block$$` math rendered with KaTeX. Default false. */
  math?: boolean
  /** `:shortcode:` emoji. Default false. */
  emoji?: boolean
  /** GitHub-style heading ids, with `{#custom-id}` overrides. Default true. */
  headingIds?: boolean
  /** Table of contents for `[[toc]]` / `<!-- toc -->` markers (and `position`). Default true. */
  toc?: boolean | TocOptions
  /** Extra plugins, applied in order after the built-ins. */
  plugins?: MarkupMePlugin[]
}

export interface CodeBlock {
  /** Language from the fence info string, lower-cased. */
  lang: string | undefined
  /** Rest of the info string after the language. */
  meta: string | undefined
  code: string
  /** 0-based index among code blocks in the document. */
  index: number
  line?: number
}

/** Trusted HTML that replaces a fenced code block. It is inserted after sanitization. */
export interface CodeBlockResult {
  html: string
  diagnostics?: Diagnostic[]
}

/**
 * Turns a code block into trusted HTML (syntax highlighting, diagrams). Return `undefined` to pass.
 * Handlers run in order; the first result wins. Their output must be safe: it is not sanitized.
 */
export type CodeBlockHandler = (
  block: CodeBlock,
) => CodeBlockResult | undefined | Promise<CodeBlockResult | undefined>

export type RenderFormat = 'html' | 'markdown' | 'ast' | 'text'

export interface RenderOptions {
  format?: RenderFormat
  /** Sanitize HTML (strict GitHub schema). Default true. Turn off only for trusted documents. */
  sanitize?: boolean
  /** Allow raw HTML in the Markdown. Sanitized when `sanitize` is on. Default true. */
  allowHtml?: boolean
  /** Add `#` anchor links to headings. Default false. */
  anchors?: boolean
  /** Handlers for fenced code blocks (highlighting, diagrams). */
  codeBlocks?: CodeBlockHandler[]
  /** Add `loading="lazy"` and `decoding="async"` to images. Default true. */
  lazyImages?: boolean
  /** Open external links in a new tab with `rel="noopener noreferrer"`. Default false. */
  externalLinksNewTab?: boolean
  /** Base URL for relative links and images. */
  baseUrl?: string
  /** JSON indent for `ast`. Default 2. */
  indent?: number
}

export interface RenderResult {
  format: RenderFormat
  output: string
  diagnostics: Diagnostic[]
  /** Title from frontmatter `title`, else the first h1. */
  title?: string
}

export type RuleSetting = 'off' | Severity

export interface ValidateOptions {
  /** Override rule severities by rule name or code. */
  rules?: Record<string, RuleSetting>
  /**
   * Checks a relative link target (path without fragment). Supply it to enable local link checking;
   * the core stays free of filesystem access.
   */
  fileExists?: (path: string) => boolean
}

export interface RuleContext {
  doc: MarkupMeDocument
  options: ValidateOptions
  report(d: Omit<Diagnostic, 'rule' | 'code' | 'severity'> & { severity?: Severity }): void
}

export interface Rule {
  code: string
  name: string
  description: string
  severity: Severity
  check(ctx: RuleContext): void
}

export interface PluginContext {
  doc: MarkupMeDocument
  options: ProcessorOptions
  report(d: Diagnostic): void
}

/** A plugin can extend syntax, transform the tree, add lint rules and handle code blocks. */
export interface MarkupMePlugin {
  name: string
  /** unified/remark plugins added to the parser (syntax extensions and their transforms). */
  remarkPlugins?: PluggableList
  /** Transform the tree right after parsing. Keep it data-preserving: it feeds serialization. */
  parse?: (tree: Root, ctx: PluginContext) => void
  /** Presentation transform on a copy of the tree before HTML conversion. */
  render?: (tree: Root, ctx: PluginContext) => void | Promise<void>
  /** hast transform before sanitization. */
  rehype?: (tree: HastRoot, ctx: PluginContext) => void | Promise<void>
  rules?: Rule[]
  codeBlock?: CodeBlockHandler
}
