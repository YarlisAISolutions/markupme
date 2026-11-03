// The stable exports of @markupme/core that no behaviour test exercises on its own (MKP-3).
// docs/api-stability.md links here. Removing one of these turns `bun run type-check` red (the
// import fails) and `test/api-surface.test.ts` red (the export is gone from the snapshot).
import type { Heading } from 'mdast'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  ALERT_TITLES,
  ALERT_TYPES,
  type AlertType,
  type BuiltinTransform,
  buildToc,
  CALLOUTS,
  CONTAINERS,
  type CodeBlock,
  type CodeBlockHandler,
  type CodeBlockResult,
  type Diagnostic,
  type DocumentStats,
  formatDiagnostic,
  headingId,
  insertToc,
  LEAF_DIRECTIVES,
  type MarkupMeDocument,
  MarkupMeError,
  type MarkupMePlugin,
  markupmeSchema,
  type OutlineItem,
  type ParseOptions,
  type PluginContext,
  type Processor,
  type ProcessorOptions,
  parse,
  type RenderFormat,
  type RenderOptions,
  type RenderResult,
  RULES,
  type Rule,
  type RuleContext,
  type RuleSetting,
  type SerializeFormat,
  type SerializeOptions,
  type Severity,
  stripPositions,
  TEXT_DIRECTIVES,
  type TocNode,
  type TocOptions,
  type Toml,
  type TransformOptions,
  type TransformResult,
  type ValidateOptions,
  visit,
} from '../src/index.js'

describe('stable core exports', () => {
  it('alert constants list the five GitHub alert types with titles', () => {
    expect([...ALERT_TYPES]).toEqual(['note', 'tip', 'important', 'warning', 'caution'])
    for (const t of ALERT_TYPES) expect(ALERT_TITLES[t]).toMatch(/^[A-Z]/)
  })

  it('directive constants name the built-in directives', () => {
    expect(CALLOUTS.length).toBeGreaterThan(0)
    expect(CONTAINERS).toContain('details')
    expect(TEXT_DIRECTIVES).toContain('kbd')
    expect(LEAF_DIRECTIVES).toContain('toc')
  })

  it('buildToc, insertToc and headingId work on a parsed tree', () => {
    const doc = parse('# Title\n\n[[toc]]\n\n## One\n\n## Two\n')
    const first = doc.tree.children.find((n) => n.type === 'heading') as Heading
    expect(headingId(first)).toBe('title')
    expect(buildToc(doc.tree).type).toBeTruthy()
    expect(typeof insertToc(doc.tree)).toBe('boolean')
  })

  it('formatDiagnostic prints file, line, code and message', () => {
    const d: Diagnostic = {
      code: 'MM004',
      rule: 'broken-link',
      severity: 'error',
      message: 'nope',
      file: 'a.md',
      line: 3,
    }
    const text = formatDiagnostic(d)
    for (const part of ['a.md', '3', 'MM004', 'nope']) expect(text).toContain(part)
  })

  it('MarkupMeError carries a code', () => {
    const e = new MarkupMeError('MM999', 'boom')
    expect(e).toBeInstanceOf(Error)
    expect(e.code).toBe('MM999')
  })

  it('RULES have stable MM codes and markupmeSchema is a sanitize schema', () => {
    for (const r of RULES) expect(r.code).toMatch(/^MM\d{3}$/)
    expect(markupmeSchema.tagNames).toContain('p')
  })

  it('stripPositions and visit walk the tree', () => {
    const doc = parse('# A\n\ntext\n')
    expect(JSON.stringify(stripPositions(doc.tree))).not.toContain('"position"')
    const types: string[] = []
    visit(doc.tree, (node) => {
      types.push(node.type)
    })
    expect(types).toContain('heading')
  })

  it('exports the stable types', () => {
    expectTypeOf<AlertType>().toEqualTypeOf<(typeof ALERT_TYPES)[number]>()
    expectTypeOf<BuiltinTransform>().not.toBeAny()
    expectTypeOf<CodeBlock>().toBeObject()
    expectTypeOf<CodeBlockHandler>().toBeFunction()
    expectTypeOf<CodeBlockResult>().toBeObject()
    expectTypeOf<DocumentStats>().toBeObject()
    expectTypeOf<MarkupMeDocument>().toHaveProperty('schemaVersion')
    expectTypeOf<MarkupMePlugin>().toBeObject()
    expectTypeOf<OutlineItem>().toHaveProperty('id')
    expectTypeOf<ParseOptions>().toBeObject()
    expectTypeOf<PluginContext>().toHaveProperty('doc')
    expectTypeOf<Processor>().toHaveProperty('render')
    expectTypeOf<ProcessorOptions>().toBeObject()
    expectTypeOf<RenderFormat>().toEqualTypeOf<'html' | 'markdown' | 'ast' | 'text'>()
    expectTypeOf<RenderOptions>().toBeObject()
    expectTypeOf<RenderResult>().toBeObject()
    expectTypeOf<Rule>().toHaveProperty('code')
    expectTypeOf<RuleContext>().toBeObject()
    expectTypeOf<RuleSetting>().toEqualTypeOf<'off' | Severity>()
    expectTypeOf<SerializeFormat>().not.toBeAny()
    expectTypeOf<SerializeOptions>().toBeObject()
    expectTypeOf<Severity>().toEqualTypeOf<'error' | 'warning' | 'info'>()
    expectTypeOf<TocNode>().toBeObject()
    expectTypeOf<TocOptions>().toBeObject()
    expectTypeOf<Toml>().toHaveProperty('type')
    expectTypeOf<TransformOptions>().not.toBeAny()
    expectTypeOf<TransformResult>().not.toBeAny()
    expectTypeOf<ValidateOptions>().toBeObject()
  })
})
