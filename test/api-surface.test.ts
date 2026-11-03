/**
 * The public API contract (MKP-3). Compares what the built packages export, and what the
 * `markupme` command accepts, with `api/exports.snapshot.json`, where every item is marked
 * `stable` or `experimental`. docs/api-stability.md explains the promise.
 *
 * - A stable item that disappears (removed or renamed) fails, naming the item, unless the major
 *   version went up since the snapshot was written.
 * - A new item fails until it is classified: run `bun run api:update` (after `bun run build`), which adds
 *   it as experimental, then mark it stable in the snapshot and the doc if it should be.
 * - Every snapshot item has a row in docs/api-stability.md with the same status.
 *
 * Runs after `turbo run test`, so the packages are built (`dist/`).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Command, Option } from 'commander'
import { describe, expect, it } from 'vitest'

type Status = 'stable' | 'experimental'
type Kind = 'value' | 'type'

interface CommandEntry {
  status: Status
  aliases: string[]
  arguments: string[]
  options: Record<string, { status: Status; default?: unknown }>
}

interface Snapshot {
  /** Major version of the packages when the snapshot was last written. */
  major: number
  packages: Record<string, Record<string, { status: Status; kind: Kind }>>
  cli: {
    commands: Record<string, CommandEntry>
    exitCodes: Record<string, number>
  }
  diagnosticCodes: string[]
  schemaVersion: number
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SNAPSHOT = join(root, 'api', 'exports.snapshot.json')
const DOC = join(root, 'docs', 'api-stability.md')
const PACKAGES = ['core', 'highlight', 'diagrams', 'themes', 'react', 'cli'] as const
const UPDATE = process.env.UPDATE_API_SNAPSHOT === '1'

/**
 * Exported names in a tsc-emitted declaration file, following `export * from` and
 * `export { … } from` into sibling files. Only top-level statements count, so names inside
 * `declare module` augmentations are left out.
 */
function declarationExports(file: string, seen = new Set<string>()): Map<string, Kind> {
  const names = new Map<string, Kind>()
  if (seen.has(file)) return names
  seen.add(file)
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i] as string
    if (!line.startsWith('export ')) continue
    if (/^export (type )?\{/.test(line))
      while (!line.includes('}') && i + 1 < lines.length) line += ` ${lines[++i]}`
    const star = /^export \* from '(\.[^']+)'/.exec(line)
    if (star) {
      const target = join(dirname(file), (star[1] as string).replace(/\.js$/, '.d.ts'))
      for (const [n, k] of declarationExports(target, seen)) names.set(n, k)
      continue
    }
    const list = /^export (type )?\{([^}]*)\}/.exec(line)
    if (list) {
      const allTypes = Boolean(list[1])
      for (const raw of (list[2] as string).split(',')) {
        const spec = raw.trim()
        if (!spec) continue
        const isType = allTypes || spec.startsWith('type ')
        const name = spec
          .replace(/^type /, '')
          .split(/\s+as\s+/)
          .pop() as string
        names.set(name, isType ? 'type' : 'value')
      }
      continue
    }
    const decl =
      /^export (?:declare )?(?:abstract )?(function|const|let|var|class|enum|namespace|interface|type) ([A-Za-z_$][\w$]*)/.exec(
        line,
      )
    if (decl)
      names.set(decl[2] as string, decl[1] === 'interface' || decl[1] === 'type' ? 'type' : 'value')
  }
  return names
}

async function packageExports(pkg: string): Promise<Map<string, Kind>> {
  const dist = join(root, 'packages', pkg, 'dist', 'index.js')
  if (!existsSync(dist)) throw new Error(`${dist} is missing: build first (bun run build)`)
  const names = declarationExports(join(root, 'packages', pkg, 'dist', 'index.d.ts'))
  // Runtime exports are the truth for values; the declarations add the types.
  const runtime = Object.keys(await import(dist))
  for (const n of runtime) names.set(n, 'value')
  for (const [n, k] of names) if (k === 'value' && !runtime.includes(n)) names.set(n, 'type')
  return names
}

function argumentName(a: { name(): string; required: boolean; variadic: boolean }): string {
  const name = `${a.name()}${a.variadic ? '...' : ''}`
  return a.required ? `<${name}>` : `[${name}]`
}

function commandEntry(c: Command, previous?: CommandEntry): CommandEntry {
  const options: CommandEntry['options'] = {}
  for (const o of c.options as Option[]) {
    const old = previous?.options[o.flags]
    options[o.flags] = {
      status: old?.status ?? 'experimental',
      ...(o.defaultValue !== undefined ? { default: o.defaultValue } : {}),
    }
  }
  return {
    status: previous?.status ?? 'experimental',
    aliases: c.aliases(),
    arguments: (
      c as unknown as { registeredArguments: Parameters<typeof argumentName>[0][] }
    ).registeredArguments.map(argumentName),
    options,
  }
}

async function current(previous: Snapshot | undefined) {
  const core = await import(join(root, 'packages', 'core', 'dist', 'index.js'))
  const cli = await import(join(root, 'packages', 'cli', 'dist', 'index.js'))
  const { program } = await import(join(root, 'packages', 'cli', 'dist', 'program.js'))
  const io = { out: () => {}, err: () => {}, cwd: root, env: {} }
  const top: Command = program(io, () => {})

  const packages: Snapshot['packages'] = {}
  for (const pkg of PACKAGES) {
    const name = `@markupme/${pkg}`
    const before = previous?.packages[name] ?? {}
    packages[name] = {}
    for (const [n, kind] of [...(await packageExports(pkg))].sort(([a], [b]) => (a < b ? -1 : 1)))
      packages[name][n] = { status: before[n]?.status ?? 'experimental', kind }
  }

  const commands: Snapshot['cli']['commands'] = {
    markupme: commandEntry(top, previous?.cli.commands.markupme),
  }
  for (const c of top.commands)
    commands[c.name()] = commandEntry(c, previous?.cli.commands[c.name()])

  return {
    major: Number(String(core.VERSION).split('.')[0]),
    packages,
    cli: { commands, exitCodes: { ...cli.EXIT } },
    diagnosticCodes: (core.RULES as { code: string }[]).map((r) => r.code).sort(),
    schemaVersion: core.SCHEMA_VERSION as number,
  } satisfies Snapshot
}

/** Every stable item, as `label → key`, for the "was it removed?" check. */
function stableItems(s: Snapshot): Map<string, string> {
  const items = new Map<string, string>()
  for (const [pkg, names] of Object.entries(s.packages))
    for (const [n, e] of Object.entries(names))
      if (e.status === 'stable') items.set(`export ${pkg} › ${n}`, `${pkg}#${n}`)
  for (const [name, c] of Object.entries(s.cli.commands)) {
    if (c.status === 'stable') items.set(`command \`markupme ${name}\``, `cmd:${name}`)
    for (const [flags, o] of Object.entries(c.options))
      if (o.status === 'stable')
        items.set(
          `flag \`${flags}\` of \`markupme ${name}\`${o.default === undefined ? '' : ` (default ${JSON.stringify(o.default)})`}`,
          `opt:${name}:${flags}:${JSON.stringify(o.default)}`,
        )
    for (const a of c.aliases)
      if (c.status === 'stable') items.set(`alias \`${a}\` of \`markupme ${name}\``, `alias:${a}`)
    if (c.status === 'stable')
      items.set(
        `arguments ${c.arguments.join(' ') || '(none)'} of \`markupme ${name}\``,
        `args:${name}:${c.arguments.join(' ')}`,
      )
  }
  for (const [k, v] of Object.entries(s.cli.exitCodes))
    items.set(`exit code ${k} = ${v}`, `exit:${k}:${v}`)
  for (const code of s.diagnosticCodes) items.set(`diagnostic code ${code}`, `diag:${code}`)
  items.set(`SCHEMA_VERSION = ${s.schemaVersion}`, `schema:${s.schemaVersion}`)
  return items
}

/** All keys an item (stable or not) may be found under, to tell "removed" from "changed status". */
function allKeys(s: Snapshot): Set<string> {
  const loose: Snapshot = structuredClone(s)
  for (const names of Object.values(loose.packages))
    for (const e of Object.values(names)) e.status = 'stable'
  for (const c of Object.values(loose.cli.commands)) {
    c.status = 'stable'
    for (const o of Object.values(c.options)) o.status = 'stable'
  }
  return new Set(stableItems(loose).values())
}

const previous: Snapshot | undefined = existsSync(SNAPSHOT)
  ? JSON.parse(readFileSync(SNAPSHOT, 'utf8'))
  : undefined

describe('public API surface', () => {
  it('keeps every stable export, command, flag, exit code and diagnostic code', async () => {
    const now = await current(previous)
    if (!previous) {
      writeFileSync(SNAPSHOT, `${JSON.stringify(now, null, 2)}\n`)
      throw new Error(`wrote ${SNAPSHOT}: classify the items as stable or experimental`)
    }
    const majorBump = now.major > previous.major
    const present = allKeys(now)
    const removed = [...stableItems(previous)]
      .filter(([, key]) => !present.has(key))
      .map(([label]) => label)
    if (removed.length > 0 && !majorBump)
      throw new Error(
        `stable API removed or renamed without a major version bump:\n${removed.map((r) => `  - ${r}`).join('\n')}\nPut it back, or bump the major version and run bun run api:update.`,
      )

    const known = allKeys(previous)
    const unclassified = [...allKeys(now)].filter((k) => !known.has(k))
    if (UPDATE) {
      writeFileSync(SNAPSHOT, `${JSON.stringify(now, null, 2)}\n`)
      return
    }
    expect(
      unclassified,
      'new or changed API is not in api/exports.snapshot.json: run bun run api:update (new items start as experimental), then classify them there and in docs/api-stability.md',
    ).toEqual([])
    const goneExperimental = [...known].filter((k) => !present.has(k))
    expect(
      goneExperimental,
      'experimental API was removed: run bun run api:update to record it',
    ).toEqual([])
  })

  it('docs/api-stability.md lists every export and command with its snapshot status', () => {
    expect(previous, 'api/exports.snapshot.json is missing').toBeDefined()
    const doc = readFileSync(DOC, 'utf8')
    const rows = new Map<string, string>()
    let section = ''
    for (const line of doc.split('\n')) {
      const heading = /^### `(@markupme\/[a-z]+|markupme)`/.exec(line)
      if (heading) section = heading[1] as string
      const row = /^\| `([^`]+)` \| (stable|experimental) \|/.exec(line)
      if (row && section) rows.set(`${section} ${row[1]}`, row[2] as string)
    }
    const problems: string[] = []
    for (const [pkg, names] of Object.entries((previous as Snapshot).packages))
      for (const [n, e] of Object.entries(names)) {
        const documented = rows.get(`${pkg} ${n}`)
        if (documented !== e.status)
          problems.push(
            `${pkg} › ${n}: snapshot says ${e.status}, doc says ${documented ?? 'nothing'}`,
          )
      }
    for (const [name, c] of Object.entries((previous as Snapshot).cli.commands)) {
      const documented = rows.get(`markupme ${name}`)
      if (documented !== c.status)
        problems.push(
          `markupme ${name}: snapshot says ${c.status}, doc says ${documented ?? 'nothing'}`,
        )
    }
    expect(problems).toEqual([])
  })
})
