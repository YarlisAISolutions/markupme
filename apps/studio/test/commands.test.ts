import { describe, expect, it } from 'vitest'
import {
  type Command,
  createRegistry,
  filterCommands,
  formatShortcut,
  fuzzyScore,
} from '../src/commands.js'

const cmd = (id: string, title: string, extra: Partial<Command> = {}): Command => ({
  id,
  title,
  group: 'Test',
  run: () => {},
  ...extra,
})

describe('fuzzyScore', () => {
  it('matches subsequences case-insensitively', () => {
    expect(fuzzyScore('bld', 'Bold')).not.toBeNull()
    expect(fuzzyScore('BOLD', 'bold')).not.toBeNull()
    expect(fuzzyScore('xyz', 'Bold')).toBeNull()
  })

  it('treats an empty query as a neutral match', () => {
    expect(fuzzyScore('', 'Anything')).toBe(0)
    expect(fuzzyScore('   ', 'Anything')).toBe(0)
  })

  it('prefers word starts and consecutive runs', () => {
    const wordStart = fuzzyScore('cb', 'Code block') as number
    const scattered = fuzzyScore('cb', 'Copy HTML to clipboard') as number
    expect(wordStart).toBeGreaterThan(scattered)
    expect(fuzzyScore('tab', 'Insert table') as number).toBeGreaterThan(
      fuzzyScore('tab', 'Toggle a box') as number,
    )
  })

  it('ignores spaces in the query', () => {
    expect(fuzzyScore('code block', 'Code block')).not.toBeNull()
  })
})

describe('filterCommands', () => {
  const list = [
    cmd('a', 'Bold', { keywords: ['strong'] }),
    cmd('b', 'Italic'),
    cmd('c', 'Code block'),
    cmd('d', 'Copy HTML to clipboard'),
  ]

  it('keeps registry order for an empty query', () => {
    expect(filterCommands(list, '').map((c) => c.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ranks the best match first', () => {
    expect(filterCommands(list, 'cb')[0]?.id).toBe('c')
    expect(filterCommands(list, 'ital').map((c) => c.id)).toEqual(['b'])
  })

  it('matches keywords and the group', () => {
    expect(filterCommands(list, 'strong').map((c) => c.id)).toEqual(['a'])
    expect(filterCommands(list, 'test bold')[0]?.id).toBe('a')
  })

  it('returns nothing when nothing matches', () => {
    expect(filterCommands(list, 'qqq')).toEqual([])
  })
})

describe('createRegistry', () => {
  it('runs enabled commands and skips disabled ones', async () => {
    const calls: string[] = []
    let on = false
    const r = createRegistry([
      cmd('x', 'X', { run: () => void calls.push('x') }),
      cmd('y', 'Y', { run: () => void calls.push('y'), enabled: () => on }),
    ])
    expect(await r.run('x')).toBe(true)
    expect(await r.run('y')).toBe(false)
    on = true
    expect(await r.run('y')).toBe(true)
    expect(await r.run('missing')).toBe(false)
    expect(calls).toEqual(['x', 'y'])
  })

  it('rejects duplicate ids', () => {
    const r = createRegistry([cmd('x', 'X')])
    expect(() => r.add(cmd('x', 'Again'))).toThrow(/Duplicate/)
    expect(r.all()).toHaveLength(1)
    expect(r.get('x')?.title).toBe('X')
  })
})

describe('formatShortcut', () => {
  it('uses symbols on Apple platforms', () => {
    expect(formatShortcut('Mod-Shift-P', true)).toBe('⌘⇧P')
    expect(formatShortcut('Mod-Alt-1', true)).toBe('⌘⌥1')
  })

  it('uses Ctrl elsewhere', () => {
    expect(formatShortcut('Mod-K', false)).toBe('Ctrl+K')
    expect(formatShortcut('Mod-Shift-Z', false)).toBe('Ctrl+Shift+Z')
  })
})
