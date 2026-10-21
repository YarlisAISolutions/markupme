/** Browser storage that never throws, plus the persisted settings shape. */

export const KEYS = {
  doc: 'markupme-studio:doc',
  name: 'markupme-studio:name',
  settings: 'markupme-studio:settings',
  theme: 'markupme-studio:theme',
} as const

export interface SafeStorage {
  /** False when storage is blocked (private mode, disabled site data). */
  readonly available: boolean
  get(key: string): string | null
  set(key: string, value: string): boolean
  remove(key: string): void
}

export function safeStorage(
  getStore: () => Storage | undefined = () => globalThis.localStorage,
): SafeStorage {
  let store: Storage | undefined
  try {
    store = getStore()
    const probe = '__markupme_probe__'
    store?.setItem(probe, '1')
    store?.removeItem(probe)
  } catch {
    store = undefined
  }
  return {
    available: store !== undefined,
    get(key) {
      try {
        return store?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    set(key, value) {
      try {
        if (!store) return false
        store.setItem(key, value)
        return true
      } catch {
        return false
      }
    },
    remove(key) {
      try {
        store?.removeItem(key)
      } catch {}
    },
  }
}

export type TocPosition = 'marker-only' | 'top' | 'after-title'
export type ThemeChoice = 'auto' | 'light' | 'dark'

export interface Settings {
  gfm: boolean
  math: boolean
  emoji: boolean
  tocPosition: TocPosition
  /** Line numbers in the editor gutter. */
  editorLineNumbers: boolean
  /** Line numbers on rendered code blocks. */
  codeLineNumbers: boolean
  anchors: boolean
  diagrams: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  gfm: true,
  math: false,
  emoji: false,
  tocPosition: 'marker-only',
  editorLineNumbers: true,
  codeLineNumbers: false,
  anchors: true,
  diagrams: true,
}

const TOC_POSITIONS: TocPosition[] = ['marker-only', 'top', 'after-title']

/** Reads settings JSON leniently: unknown keys are dropped, bad values fall back to defaults. */
export function parseSettings(raw: string | null): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS }
  if (!raw) return out
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return out
  }
  if (typeof data !== 'object' || data === null) return out
  const d = data as Record<string, unknown>
  for (const key of [
    'gfm',
    'math',
    'emoji',
    'editorLineNumbers',
    'codeLineNumbers',
    'anchors',
    'diagrams',
  ] as const) {
    const v = d[key]
    if (typeof v === 'boolean') out[key] = v
  }
  if (TOC_POSITIONS.includes(d.tocPosition as TocPosition))
    out.tocPosition = d.tocPosition as TocPosition
  return out
}

export function parseTheme(raw: string | null): ThemeChoice {
  return raw === 'light' || raw === 'dark' ? raw : 'auto'
}

/** The next theme for the toggle: auto → the opposite of the system → the other one → auto. */
export function nextTheme(current: ThemeChoice, systemDark: boolean): ThemeChoice {
  const opposite: ThemeChoice = systemDark ? 'light' : 'dark'
  const same: ThemeChoice = systemDark ? 'dark' : 'light'
  if (current === 'auto') return opposite
  if (current === opposite) return same
  return 'auto'
}
