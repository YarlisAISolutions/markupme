/** The command registry and the fuzzy filter the palette uses. Pure: no DOM access. */

export interface Command {
  id: string
  title: string
  /** Group shown next to the title, e.g. "Format", "View". */
  group: string
  /** Display form of the shortcut, e.g. "Mod-B". */
  shortcut?: string
  /** Extra words that should match, e.g. "strong" for Bold. */
  keywords?: string[]
  /** Whether the command can run right now (e.g. editing is off in read-only mode). */
  enabled?: () => boolean
  run(): void | Promise<void>
}

export interface Registry {
  add(command: Command): void
  get(id: string): Command | undefined
  all(): Command[]
  run(id: string): Promise<boolean>
}

export function createRegistry(commands: Command[] = []): Registry {
  const byId = new Map<string, Command>()
  const add = (c: Command) => {
    if (byId.has(c.id)) throw new Error(`Duplicate command id "${c.id}"`)
    byId.set(c.id, c)
  }
  for (const c of commands) add(c)
  return {
    add,
    get: (id) => byId.get(id),
    all: () => [...byId.values()],
    async run(id) {
      const c = byId.get(id)
      if (!c || c.enabled?.() === false) return false
      await c.run()
      return true
    },
  }
}

/**
 * Scores `query` as a subsequence of `text` (case-insensitive). Higher is better; `null` means no
 * match. Consecutive characters and matches at word starts score more, so "cb" ranks
 * "Code block" above "Copy HTML to clipboard".
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase().replace(/\s+/g, '')
  if (!q) return 0
  const t = text.toLowerCase()
  const first = q[0] as string
  let best: number | null = null
  // Greedy matching from each occurrence of the first character; keep the best alignment.
  for (let start = t.indexOf(first); start !== -1; start = t.indexOf(first, start + 1)) {
    const s = scoreFrom(q, t, start)
    if (s !== null && (best === null || s > best)) best = s
  }
  return best
}

const WORD_BREAK = /[\s\-_/.(]/

function scoreFrom(q: string, t: string, start: number): number | null {
  let score = 0
  let ti = start
  let prev = -2
  for (const ch of q) {
    const found = t.indexOf(ch, ti)
    if (found === -1) return null
    score += 1
    if (found === prev + 1) score += 5
    if (found === 0 || WORD_BREAK.test(t[found - 1] ?? '')) score += 4
    score -= Math.min(found - ti, 5) * 0.1
    prev = found
    ti = found + 1
  }
  return score - start * 0.01
}

/** Filters and ranks commands for a query. An empty query keeps registry order. */
export function filterCommands(commands: Command[], query: string): Command[] {
  if (!query.trim()) return [...commands]
  const scored: { c: Command; s: number; i: number }[] = []
  commands.forEach((c, i) => {
    const fields = [c.title, `${c.group} ${c.title}`, ...(c.keywords ?? [])]
    let best: number | null = null
    for (const f of fields) {
      const s = fuzzyScore(query, f)
      if (s !== null && (best === null || s > best)) best = s
    }
    if (best !== null) scored.push({ c, s: best, i })
  })
  scored.sort((a, b) => b.s - a.s || a.i - b.i)
  return scored.map((x) => x.c)
}

/** Renders a shortcut like "Mod-Shift-P" for the platform: "⌘⇧P" on Apple, "Ctrl+Shift+P" elsewhere. */
export function formatShortcut(shortcut: string, apple: boolean): string {
  const parts = shortcut.split('-')
  if (apple) {
    const map: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃' }
    return parts.map((p) => map[p] ?? p.toUpperCase()).join('')
  }
  const map: Record<string, string> = { Mod: 'Ctrl' }
  return parts.map((p) => map[p] ?? (p.length === 1 ? p.toUpperCase() : p)).join('+')
}
