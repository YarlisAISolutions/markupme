/**
 * Markdown editing transforms as pure functions over a string and a selection, so they can be
 * tested without an editor. `editor.ts` applies the result as a CodeMirror transaction.
 */

export interface Selection {
  from: number
  to: number
}

export interface Edit {
  from: number
  to: number
  insert: string
  /** Selection after the edit, in document offsets after the change. */
  selection: Selection
}

/** Wraps the selection in a marker (`**`), or unwraps it when it is already wrapped. */
export function toggleWrap(doc: string, sel: Selection, marker: string, placeholder: string): Edit {
  const { from, to } = sel
  const m = marker.length
  const before = doc.slice(Math.max(0, from - m), from)
  const after = doc.slice(to, to + m)
  if (before === marker && after === marker) {
    const inner = doc.slice(from, to)
    return {
      from: from - m,
      to: to + m,
      insert: inner,
      selection: { from: from - m, to: to - m },
    }
  }
  const text = doc.slice(from, to)
  if (text.length > 2 * m && text.startsWith(marker) && text.endsWith(marker)) {
    const inner = text.slice(m, -m)
    return { from, to, insert: inner, selection: { from, to: from + inner.length } }
  }
  const inner = text || placeholder
  return {
    from,
    to,
    insert: `${marker}${inner}${marker}`,
    selection: { from: from + m, to: from + m + inner.length },
  }
}

function lineBounds(doc: string, pos: number): { start: number; end: number } {
  const start = doc.lastIndexOf('\n', pos - 1) + 1
  const nl = doc.indexOf('\n', pos)
  return { start, end: nl === -1 ? doc.length : nl }
}

/**
 * Cycles the heading level of the line at the cursor: text → `##` → `###` … `######` → text.
 * Level 1 is skipped because the page already has its h1.
 */
export function cycleHeading(doc: string, sel: Selection): Edit {
  const { start, end } = lineBounds(doc, sel.from)
  const line = doc.slice(start, end)
  const m = /^(#{1,6})\s+/.exec(line)
  const level = m?.[1]?.length ?? 0
  const body = m ? line.slice(m[0].length) : line
  const next = level === 0 ? 2 : level >= 6 ? 0 : level + 1
  const prefix = next === 0 ? '' : `${'#'.repeat(next)} `
  const insert = `${prefix}${body}`
  const caret = start + insert.length
  return { from: start, to: end, insert, selection: { from: caret, to: caret } }
}

/** Turns the selection into a link and selects the URL so it can be typed over. */
export function insertLink(doc: string, sel: Selection): Edit {
  const text = doc.slice(sel.from, sel.to) || 'link text'
  const url = 'https://'
  const insert = `[${text}](${url})`
  const urlStart = sel.from + text.length + 3
  return {
    from: sel.from,
    to: sel.to,
    insert,
    selection: { from: urlStart, to: urlStart + url.length },
  }
}

/** Prefixes every selected line with a task-list marker, or removes it when all have one. */
export function toggleTaskList(doc: string, sel: Selection): Edit {
  const start = lineBounds(doc, sel.from).start
  const end = lineBounds(doc, sel.to).end
  const lines = doc.slice(start, end).split('\n')
  const task = /^(\s*)[-*+] \[[ xX]\] /
  const allTasks = lines.every((l) => task.test(l) || l.trim() === '')
  const out = lines.map((l) => {
    if (allTasks) return l.replace(task, '$1')
    if (task.test(l)) return l
    const bullet = /^(\s*)[-*+] /.exec(l)
    if (bullet) return `${bullet[1]}- [ ] ${l.slice(bullet[0].length)}`
    return `- [ ] ${l}`
  })
  const insert = out.join('\n')
  const caret = start + insert.length
  return { from: start, to: end, insert, selection: { from: caret, to: caret } }
}

/**
 * Inserts a block on its own lines at the cursor (replacing the selection), with blank lines
 * around it. `cursor` is an offset inside `block` to put the caret at; default the end.
 */
export function insertBlock(doc: string, sel: Selection, block: string, cursor?: number): Edit {
  const before = doc.slice(0, sel.from)
  const after = doc.slice(sel.to)
  const lead =
    before === '' ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const trail = after.startsWith('\n\n')
    ? ''
    : after.startsWith('\n')
      ? '\n'
      : after === ''
        ? '\n'
        : '\n\n'
  const insert = `${lead}${block}${trail}`
  const caret = sel.from + lead.length + (cursor ?? block.length)
  return { from: sel.from, to: sel.to, insert, selection: { from: caret, to: caret } }
}

/** A fenced code block around the selection (or an empty one), caret on the language. */
export function codeBlock(doc: string, sel: Selection): Edit {
  const text = doc.slice(sel.from, sel.to)
  const block = `\`\`\`\n${text}\n\`\`\``
  return insertBlock(doc, sel, block, 3)
}

export const TABLE_TEMPLATE = `| Column A | Column B |
| -------- | -------- |
| Value    | Value    |`

export const MERMAID_TEMPLATE = `\`\`\`mermaid
flowchart LR
  A[Start] --> B{Decide}
  B -->|Yes| C[Do it]
  B -->|No| D[Skip]
\`\`\``

export const TOC_MARKER = '[[toc]]'
