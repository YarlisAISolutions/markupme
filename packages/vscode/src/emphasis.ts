/** Inline emphasis toggles (bold, italic, strikethrough, code). Kept free of `vscode` so it can be tested. */

export type Emphasis = 'bold' | 'italic' | 'strikethrough' | 'code'

export const MARKERS: Record<Emphasis, string> = {
  bold: '**',
  italic: '*',
  strikethrough: '~~',
  code: '`',
}

export interface ToggleResult {
  /** Offsets in the original text to replace. */
  start: number
  end: number
  text: string
  /** The selection after the edit, as offsets in the new text. */
  selectionStart: number
  selectionEnd: number
}

const WORD = /[\p{L}\p{N}_'-]/u

/** The word around `offset`, or an empty range when the cursor is not in a word. */
function wordAt(text: string, offset: number): [number, number] {
  let s = offset
  let e = offset
  while (s > 0 && WORD.test(text[s - 1] ?? '')) s--
  while (e < text.length && WORD.test(text[e] ?? '')) e++
  return [s, e]
}

/** How many `*` touch the range on one side. */
function stars(text: string, from: number, step: -1 | 1): number {
  let n = 0
  for (let i = from; text[i] === '*'; i += step) n++
  return n
}

/** `m` directly around the range. For italic, the `*` runs must be odd (`*` or `***`), not bold's `**`. */
function wrappedBy(text: string, start: number, end: number, m: string): boolean {
  if (text.slice(start - m.length, start) !== m || text.slice(end, end + m.length) !== m)
    return false
  if (m === '*') return stars(text, start - 1, -1) % 2 === 1 && stars(text, end, 1) % 2 === 1
  return true
}

/**
 * Adds or removes `kind` around the selection. An empty selection works on the word under the
 * cursor, or inserts an empty pair with the cursor between them. A selection that already
 * includes the markers, or sits just inside them, is unwrapped.
 */
export function toggleEmphasis(
  text: string,
  selStart: number,
  selEnd: number,
  kind: Emphasis,
): ToggleResult {
  const m = MARKERS[kind]
  let [start, end] = selStart <= selEnd ? [selStart, selEnd] : [selEnd, selStart]
  if (start === end) [start, end] = wordAt(text, start)

  const inner = text.slice(start, end)
  // Selection includes the markers: **word**
  if (
    inner.length >= 2 * m.length &&
    inner.startsWith(m) &&
    inner.endsWith(m) &&
    (m !== '*' || !inner.startsWith('**') || inner.startsWith('***'))
  ) {
    const body = inner.slice(m.length, inner.length - m.length)
    return { start, end, text: body, selectionStart: start, selectionEnd: start + body.length }
  }
  // Selection sits just inside the markers: **[word]**
  if (wrappedBy(text, start, end, m)) {
    return {
      start: start - m.length,
      end: end + m.length,
      text: inner,
      selectionStart: start - m.length,
      selectionEnd: end - m.length,
    }
  }
  return {
    start,
    end,
    text: `${m}${inner}${m}`,
    selectionStart: start + m.length,
    selectionEnd: end + m.length,
  }
}
