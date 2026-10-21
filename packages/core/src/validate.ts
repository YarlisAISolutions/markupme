import type { Definition, Heading, Image, Link, Nodes, Root } from 'mdast'
import { toString as mdToString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'
import type {
  Diagnostic,
  MarkupMeDocument,
  Rule,
  RuleContext,
  Severity,
  ValidateOptions,
} from './types.js'

function at(node: Nodes) {
  return { line: node.position?.start.line, column: node.position?.start.column }
}

function anchorsOf(tree: Root): Set<string> {
  const ids = new Set<string>()
  visit(tree, (node) => {
    const id = (node.data as { hProperties?: { id?: unknown } } | undefined)?.hProperties?.id
    if (typeof id === 'string') ids.add(id)
    if (node.type === 'footnoteDefinition') {
      ids.add(`fn-${node.identifier}`)
      ids.add(`user-content-fn-${node.identifier}`)
    }
    if (node.type === 'html') {
      for (const m of node.value.matchAll(/\b(?:id|name)\s*=\s*["']([^"']+)["']/g))
        if (m[1]) ids.add(m[1])
    }
  })
  return ids
}

/** Built-in rules. Codes are stable. */
export const RULES: Rule[] = [
  {
    code: 'MM001',
    name: 'heading-increment',
    description: 'Heading levels should only increase by one at a time.',
    severity: 'warning',
    check({ doc, report }) {
      let prev = 0
      visit(doc.tree, 'heading', (h: Heading) => {
        if (prev > 0 && h.depth > prev + 1)
          report({ message: `Heading level jumps from h${prev} to h${h.depth}`, ...at(h) })
        prev = h.depth
      })
    },
  },
  {
    code: 'MM002',
    name: 'single-h1',
    description: 'A document should have at most one level-1 heading.',
    severity: 'warning',
    check({ doc, report }) {
      let count = 0
      visit(doc.tree, 'heading', (h: Heading) => {
        if (h.depth === 1 && ++count > 1)
          report({ message: 'More than one level-1 heading', ...at(h) })
      })
    },
  },
  {
    code: 'MM004',
    name: 'broken-fragment-link',
    description: 'In-document links (#id) must point to an existing heading or anchor.',
    severity: 'error',
    check({ doc, report }) {
      const ids = anchorsOf(doc.tree)
      visit(doc.tree, 'link', (l: Link) => {
        if (!l.url.startsWith('#') || l.url === '#') return
        const id = decodeURIComponent(l.url.slice(1))
        if (!ids.has(id))
          report({ message: `Link target "#${id}" does not exist in this document`, ...at(l) })
      })
    },
  },
  {
    code: 'MM005',
    name: 'image-alt-text',
    description: 'Images need alternative text for screen readers.',
    severity: 'warning',
    check({ doc, report }) {
      visit(doc.tree, 'image', (img: Image) => {
        if (!img.alt?.trim()) report({ message: `Image "${img.url}" has no alt text`, ...at(img) })
      })
    },
  },
  {
    code: 'MM006',
    name: 'empty-link',
    description: 'Links need a destination and visible text.',
    severity: 'warning',
    check({ doc, report }) {
      visit(doc.tree, 'link', (l: Link) => {
        if (!l.url.trim()) report({ message: 'Link has no destination', ...at(l) })
        else if (!mdToString(l).trim() && !l.children.some((c) => c.type === 'image'))
          report({ message: `Link to "${l.url}" has no text`, ...at(l) })
      })
    },
  },
  {
    code: 'MM008',
    name: 'unused-definition',
    description: 'Link reference definitions should be used.',
    severity: 'info',
    check({ doc, report }) {
      const used = new Set<string>()
      visit(doc.tree, (n) => {
        if (n.type === 'linkReference' || n.type === 'imageReference') used.add(n.identifier)
      })
      visit(doc.tree, 'definition', (d: Definition) => {
        if (!used.has(d.identifier))
          report({ message: `Definition "[${d.label ?? d.identifier}]" is never used`, ...at(d) })
      })
    },
  },
  {
    code: 'MM012',
    name: 'missing-local-file',
    description: 'Relative links and images must point to files that exist (needs a file checker).',
    severity: 'error',
    check({ doc, options, report }) {
      const exists = options.fileExists
      if (!exists) return
      visit(doc.tree, (n) => {
        if (n.type !== 'link' && n.type !== 'image' && n.type !== 'definition') return
        const url = n.url
        if (!url || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(url)) return
        const path = decodeURIComponent(url.split('#')[0]?.split('?')[0] ?? '')
        if (path && !exists(path)) report({ message: `File not found: ${path}`, ...at(n) })
      })
    },
  },
  {
    code: 'MM013',
    name: 'code-block-language',
    description: 'Fenced code blocks should name their language.',
    severity: 'info',
    check({ doc, report }) {
      visit(doc.tree, 'code', (c) => {
        if (!c.lang) {
          const start = c.position?.start.offset
          const fenced =
            start !== undefined && /^\s*(?:```|~~~)/.test(doc.source.slice(start, start + 8))
          if (fenced) report({ message: 'Code block has no language', ...at(c) })
        }
      })
    },
  },
  {
    code: 'MM015',
    name: 'unsafe-url',
    description: 'Links must not use javascript:, vbscript: or data:text/html URLs.',
    severity: 'error',
    check({ doc, report }) {
      visit(doc.tree, (n) => {
        if (n.type !== 'link' && n.type !== 'image' && n.type !== 'definition') return
        if (/^\s*(?:javascript|vbscript|data:text\/html)/i.test(n.url))
          report({ message: `Unsafe URL scheme in "${n.url.slice(0, 40)}"`, ...at(n) })
      })
    },
  },
  {
    code: 'MM016',
    name: 'empty-heading',
    description: 'Headings need text.',
    severity: 'warning',
    check({ doc, report }) {
      visit(doc.tree, 'heading', (h: Heading) => {
        if (!mdToString(h).trim()) report({ message: 'Empty heading', ...at(h) })
      })
    },
  },
]

function settingFor(rule: Rule, options: ValidateOptions): Severity | 'off' {
  return options.rules?.[rule.name] ?? options.rules?.[rule.code] ?? rule.severity
}

/** Runs the rules (built-in plus plugin rules). Parse diagnostics are included. */
export function runRules(
  doc: MarkupMeDocument,
  rules: Rule[],
  options: ValidateOptions = {},
): Diagnostic[] {
  const out: Diagnostic[] = []
  for (const d of doc.diagnostics) {
    const setting = options.rules?.[d.rule] ?? options.rules?.[d.code]
    if (setting === 'off') continue
    out.push(setting ? { ...d, severity: setting } : d)
  }
  for (const rule of rules) {
    const severity = settingFor(rule, options)
    if (severity === 'off') continue
    const ctx: RuleContext = {
      doc,
      options,
      report(d) {
        out.push({
          code: rule.code,
          rule: rule.name,
          severity,
          ...d,
          ...(d.severity ? {} : { severity }),
          ...(doc.file ? { file: doc.file } : {}),
        })
      },
    }
    rule.check(ctx)
  }
  return out.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0))
}
