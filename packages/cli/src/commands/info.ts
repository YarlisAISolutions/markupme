import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { diff, outline, RULES, stats, VERSION } from '@markupme/core'
import { CONFIG_FILE, DEFAULT_CONFIG, loadConfig } from '../config.js'
import { CliError, EXIT } from '../exit.js'
import { display, expandInputs, readInput } from '../files.js'
import { type FeatureFlagValues, flagsToConfig } from '../flags.js'
import type { Io } from '../io.js'
import { createPipeline, mergeConfig } from '../pipeline.js'

const SAMPLE = `---
title: Welcome to MarkupMe
---

# Welcome to MarkupMe

[[toc]]

## Write

Markdown with **GitHub extras**: tables, task lists, footnotes[^1] and alerts.

> [!TIP]
> Run \`markupme serve\` for a live preview.

## Draw

\`\`\`mermaid
flowchart LR
  Write --> Render --> Share
\`\`\`

## Check

- [x] \`markupme validate\` finds broken links and skipped headings
- [ ] \`markupme build . -o site\` makes a static site

[^1]: Footnotes link both ways.
`

export function runInit(io: Io, flags: { force?: boolean; sample?: boolean }): number {
  const path = join(io.cwd, CONFIG_FILE)
  if (existsSync(path) && !flags.force)
    throw new CliError(`${CONFIG_FILE} already exists (use --force to overwrite)`, EXIT.USAGE)
  writeFileSync(
    path,
    `${JSON.stringify({ $schema: 'https://github.com/YarlisAISolutions/markupme', ...DEFAULT_CONFIG, site: { name: 'Docs', exclude: [] } }, null, 2)}\n`,
  )
  io.err(`created ${CONFIG_FILE}`)
  if (flags.sample !== false) {
    const docs = join(io.cwd, 'docs')
    const file = join(docs, 'welcome.md')
    if (!existsSync(file)) {
      mkdirSync(docs, { recursive: true })
      writeFileSync(file, SAMPLE)
      io.err('created docs/welcome.md')
    }
  }
  io.err('next: markupme serve docs')
  return EXIT.OK
}

function pipelineFor(io: Io, flags: FeatureFlagValues, cmd?: import('commander').Command) {
  return createPipeline(
    mergeConfig(DEFAULT_CONFIG, loadConfig(io.cwd, flags.config), flagsToConfig(flags, cmd)),
  )
}

export function runParse(
  io: Io,
  file: string | undefined,
  flags: FeatureFlagValues & { outline?: boolean; positions?: boolean },
  cmd?: import('commander').Command,
): number {
  const [path] = expandInputs(io.cwd, [file ?? '-'])
  const { processor } = pipelineFor(io, flags, cmd)
  const doc = processor.parse(readInput(path as string), { file: display(io.cwd, path as string) })
  if (flags.outline) {
    const lines: string[] = []
    const walk = (items: ReturnType<typeof outline>) => {
      for (const i of items) {
        lines.push(
          `${'  '.repeat(i.depth - 1)}- ${i.text} (#${i.id}${i.line ? `, line ${i.line}` : ''})`,
        )
        walk(i.children)
      }
    }
    walk(outline(doc.tree))
    io.out(lines.join('\n'))
    return EXIT.OK
  }
  const json = processor.serialize(doc, { format: 'json' })
  io.out(
    (flags.positions === false
      ? JSON.stringify(
          JSON.parse(json, (k, v) => (k === 'position' ? undefined : v)),
          null,
          2,
        )
      : json
    ).replace(/\n$/, ''),
  )
  return EXIT.OK
}

export function runStats(
  io: Io,
  inputs: string[],
  flags: FeatureFlagValues & { json?: boolean },
  cmd?: import('commander').Command,
): number {
  const files = expandInputs(io.cwd, inputs.length > 0 ? inputs : ['-'])
  const { processor } = pipelineFor(io, flags, cmd)
  const rows = files.map((f) => ({
    file: display(io.cwd, f),
    ...stats(processor.parse(readInput(f)).tree),
  }))
  if (flags.json) io.out(JSON.stringify(rows.length === 1 ? rows[0] : rows, null, 2))
  else
    for (const r of rows) {
      io.out(
        `${r.file}\n  ${r.words} words, ~${r.readingMinutes} min read, ${r.headings} headings, ${r.links} links, ${r.images} images, ${r.tables} tables, ${r.codeBlocks} code blocks, ${r.footnotes} footnotes`,
      )
      if (r.tasks.total) io.out(`  tasks: ${r.tasks.done}/${r.tasks.total} done`)
      const langs = Object.entries(r.languages)
        .map(([l, n]) => `${l}×${n}`)
        .join(', ')
      if (langs) io.out(`  code: ${langs}`)
    }
  return EXIT.OK
}

export function runDiff(
  io: Io,
  a: string,
  b: string,
  flags: FeatureFlagValues & { json?: boolean },
  cmd?: import('commander').Command,
): number {
  const [fa, fb] = expandInputs(io.cwd, [a, b])
  const { processor } = pipelineFor(io, flags, cmd)
  const changes = diff(
    processor.parse(readInput(fa as string)).tree,
    processor.parse(readInput(fb as string)).tree,
  )
  if (flags.json) io.out(JSON.stringify(changes, null, 2))
  else if (changes.length === 0) io.err('no structural changes')
  else
    for (const c of changes) {
      const sign = c.kind === 'added' ? '+' : c.kind === 'removed' ? '-' : '~'
      io.out(
        `${sign} ${c.type}${c.line ? ` (line ${c.line})` : ''}: ${c.kind === 'changed' ? `${c.before} → ${c.after}` : (c.after ?? c.before)}`,
      )
    }
  return changes.length === 0 ? EXIT.OK : EXIT.INVALID
}

type Status = 'built' | 'opt-in' | 'planned'

export const CAPABILITIES: { area: string; feature: string; status: Status; note?: string }[] = [
  { area: 'syntax', feature: 'CommonMark', status: 'built' },
  {
    area: 'syntax',
    feature: 'GFM tables, task lists, strikethrough, autolinks, footnotes',
    status: 'built',
  },
  { area: 'syntax', feature: 'YAML / TOML frontmatter', status: 'built' },
  { area: 'syntax', feature: 'GitHub alerts (> [!NOTE])', status: 'built' },
  {
    area: 'syntax',
    feature: 'Directives (:::callouts, :::details, ::toc, :kbd[], :abbr[], :badge[])',
    status: 'built',
  },
  { area: 'syntax', feature: 'Heading ids with {#custom-id}', status: 'built' },
  { area: 'syntax', feature: 'Math (KaTeX)', status: 'opt-in', note: '--math' },
  { area: 'syntax', feature: 'Emoji shortcodes', status: 'opt-in', note: '--emoji' },
  { area: 'output', feature: 'HTML (sanitized by default)', status: 'built' },
  {
    area: 'output',
    feature: 'Standalone HTML page (themes, dark mode, print CSS)',
    status: 'built',
  },
  { area: 'output', feature: 'Markdown (normalized, round-trip checked)', status: 'built' },
  { area: 'output', feature: 'JSON AST (mdast + schemaVersion)', status: 'built' },
  { area: 'output', feature: 'Plain text', status: 'built' },
  {
    area: 'output',
    feature: 'React elements (@markupme/react)',
    status: 'planned',
    note: 'in progress, Phase 1',
  },
  { area: 'output', feature: 'Static documentation site (markupme build)', status: 'built' },
  {
    area: 'output',
    feature: 'PDF',
    status: 'planned',
    note: 'print the standalone HTML meanwhile',
  },
  { area: 'output', feature: 'DOCX', status: 'planned' },
  { area: 'output', feature: 'MDX', status: 'planned' },
  {
    area: 'diagrams',
    feature: 'Mermaid (flowchart, sequence, state, class, ER, gantt, C4 …)',
    status: 'built',
    note: 'rendered in the browser; SVG export needs playwright',
  },
  { area: 'diagrams', feature: 'Yarlis Blueprint (ybp)', status: 'built' },
  { area: 'diagrams', feature: 'Graphviz DOT (WebAssembly)', status: 'built' },
  {
    area: 'diagrams',
    feature: 'PlantUML, C4-PlantUML, Structurizr, D2 … via Kroki',
    status: 'opt-in',
    note: '--diagram-server <url>',
  },
  { area: 'tools', feature: 'Lint rules with stable codes', status: 'built' },
  { area: 'tools', feature: 'Formatter', status: 'built' },
  { area: 'tools', feature: 'TOC insert / refresh', status: 'built' },
  { area: 'tools', feature: 'Live preview server with render API', status: 'built' },
  { area: 'tools', feature: 'Structural diff', status: 'built' },
  {
    area: 'editor',
    feature: 'Web studio (CodeMirror 6, split preview)',
    status: 'planned',
    note: 'in progress, Phase 1',
  },
  { area: 'editor', feature: 'VS Code extension', status: 'planned', note: 'in progress, Phase 1' },
  { area: 'editor', feature: 'Rich-text (WYSIWYG) editing', status: 'planned' },
]

export function runCapabilities(io: Io, flags: { json?: boolean }): number {
  if (flags.json) {
    io.out(
      JSON.stringify(
        {
          name: 'markupme',
          version: VERSION,
          capabilities: CAPABILITIES,
          rules: RULES.map((r) => ({
            code: r.code,
            name: r.name,
            severity: r.severity,
            description: r.description,
          })),
        },
        null,
        2,
      ),
    )
    return EXIT.OK
  }
  io.out(`markupme ${VERSION}`)
  let area = ''
  for (const c of CAPABILITIES) {
    if (c.area !== area) {
      area = c.area
      io.out(`\n${area}`)
    }
    const mark = c.status === 'built' ? '✓' : c.status === 'opt-in' ? '+' : '·'
    io.out(
      `  ${mark} ${c.feature}${c.status !== 'built' ? ` [${c.status}${c.note ? `: ${c.note}` : ''}]` : c.note ? ` (${c.note})` : ''}`,
    )
  }
  io.out('\nrules')
  for (const r of RULES) io.out(`  ${r.code} ${r.name} (${r.severity}): ${r.description}`)
  return EXIT.OK
}
