import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { Compartment, EditorSelection, EditorState, type Extension } from '@codemirror/state'
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import type { Edit, Selection } from './format.js'

const highlightStyle = HighlightStyle.define([
  { tag: t.heading, color: 'var(--st-syn-heading)', fontWeight: '600' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: 'var(--st-syn-link)' },
  { tag: t.monospace, color: 'var(--st-syn-code)' },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator], color: 'var(--st-syn-meta)' },
  { tag: t.quote, color: 'var(--st-syn-quote)' },
  { tag: t.list, color: 'var(--st-syn-meta)' },
  { tag: [t.keyword, t.atom], color: 'var(--st-syn-keyword)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--st-syn-string)' },
  { tag: t.comment, color: 'var(--st-muted)', fontStyle: 'italic' },
])

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--st-fg)',
    backgroundColor: 'var(--st-bg)',
    fontSize: '14px',
  },
  '.cm-scroller': {
    fontFamily: 'var(--mm-mono)',
    lineHeight: '1.6',
  },
  '.cm-content': { padding: '16px 0', caretColor: 'var(--st-fg)' },
  '.cm-line': { padding: '0 20px 0 12px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--st-fg)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { backgroundColor: 'var(--st-selection)' },
  '.cm-activeLine': { backgroundColor: 'var(--st-active-line)' },
  '.cm-gutters': {
    backgroundColor: 'var(--st-bg)',
    color: 'var(--st-muted)',
    border: 'none',
    borderRight: '1px solid var(--st-border-muted)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'var(--st-active-line)', color: 'var(--st-fg)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 14px', minWidth: '32px' },
  '.cm-selectionMatch': { backgroundColor: 'var(--st-match)' },
  '.cm-searchMatch': { backgroundColor: 'var(--st-match)', outline: '1px solid var(--st-border)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--st-selection)' },
  '.cm-panels': {
    backgroundColor: 'var(--st-subtle)',
    color: 'var(--st-fg)',
    borderColor: 'var(--st-border)',
  },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--st-border)' },
  '.cm-panel.cm-search': { padding: '8px 12px', fontFamily: 'var(--mm-font)', fontSize: '13px' },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': { font: 'inherit', fontSize: '13px' },
  '.cm-textfield': {
    color: 'var(--st-fg)',
    backgroundColor: 'var(--st-bg)',
    border: '1px solid var(--st-border)',
    borderRadius: '6px',
    padding: '3px 6px',
  },
  '.cm-button': {
    color: 'var(--st-fg)',
    backgroundImage: 'none',
    backgroundColor: 'var(--st-bg)',
    border: '1px solid var(--st-border)',
    borderRadius: '6px',
    padding: '3px 10px',
  },
  '.cm-tooltip': {
    color: 'var(--st-fg)',
    backgroundColor: 'var(--st-bg)',
    border: '1px solid var(--st-border)',
    borderRadius: '6px',
    boxShadow: 'var(--st-shadow)',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--st-accent)',
    color: 'var(--st-on-accent)',
  },
})

const FENCE_LANGS = [
  ['ts', 'TypeScript'],
  ['js', 'JavaScript'],
  ['json', 'JSON'],
  ['bash', 'Shell'],
  ['python', 'Python'],
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['yaml', 'YAML'],
  ['sql', 'SQL'],
  ['mermaid', 'Mermaid diagram'],
  ['dot', 'Graphviz diagram'],
  ['ybp', 'Yarlis Blueprint diagram'],
] as const

/** Completes the language after an opening code fence. */
function fenceLanguages(ctx: CompletionContext): CompletionResult | null {
  const line = ctx.state.doc.lineAt(ctx.pos)
  const before = line.text.slice(0, ctx.pos - line.from)
  const m = /^\s*(`{3,}|~{3,})([\w+-]*)$/.exec(before)
  if (!m) return null
  const word = m[2] ?? ''
  if (!word && !ctx.explicit) return null
  return {
    from: ctx.pos - word.length,
    options: FENCE_LANGS.map(([label, detail]) => ({ label, detail, type: 'keyword' })),
    validFor: /^[\w+-]*$/,
  }
}

const readOnlyExtension: Extension = [EditorState.readOnly.of(true), EditorView.editable.of(false)]

export interface EditorOptions {
  parent: HTMLElement
  doc: string
  lineNumbers: boolean
  onChange(text: string): void
  onCursor(line: number, col: number): void
  onScroll(): void
  onDropFile(file: File): void
}

export class Editor {
  readonly view: EditorView
  private gutter = new Compartment()
  private readonly = new Compartment()
  private lineNumbersOn: boolean
  private readOnlyOn = false
  private readonly options: EditorOptions

  constructor(o: EditorOptions) {
    this.options = o
    this.lineNumbersOn = o.lineNumbers
    this.view = new EditorView({ parent: o.parent, state: this.createState(o.doc) })
  }

  private createState(doc: string): EditorState {
    const o = this.options
    const extensions: Extension[] = [
      this.gutter.of(this.lineNumbersOn ? lineNumbers() : []),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(highlightStyle),
      bracketMatching(),
      closeBrackets(),
      autocompletion({ override: [fenceLanguages], icons: false }),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
      ]),
      markdown(),
      EditorView.lineWrapping,
      editorTheme,
      this.readonly.of(this.readOnlyOn ? readOnlyExtension : []),
      EditorView.contentAttributes.of({
        'aria-label': 'Markdown source',
        tabindex: '0',
        'aria-multiline': 'true',
        spellcheck: 'true',
      }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) o.onChange(u.state.doc.toString())
        if (u.docChanged || u.selectionSet) {
          const head = u.state.selection.main.head
          const line = u.state.doc.lineAt(head)
          o.onCursor(line.number, head - line.from + 1)
        }
      }),
      EditorView.domEventHandlers({
        scroll: () => o.onScroll(),
        dragover: (e) => {
          if (e.dataTransfer?.types.includes('Files')) {
            e.preventDefault()
            return true
          }
          return false
        },
        drop: (e) => {
          const file = e.dataTransfer?.files[0]
          if (!file) return false
          e.preventDefault()
          o.onDropFile(file)
          return true
        },
      }),
    ]
    return EditorState.create({ doc, extensions })
  }

  getText(): string {
    return this.view.state.doc.toString()
  }

  /** Replaces the whole document. `resetHistory` starts a fresh undo history (New/Open). */
  setText(text: string, opts: { resetHistory?: boolean } = {}): void {
    if (opts.resetHistory) {
      this.view.setState(this.createState(text))
      this.options.onChange(text)
      this.options.onCursor(1, 1)
      return
    }
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: text },
      selection: { anchor: 0 },
    })
  }

  setLineNumbers(on: boolean): void {
    this.lineNumbersOn = on
    this.view.dispatch({ effects: this.gutter.reconfigure(on ? lineNumbers() : []) })
  }

  setReadOnly(on: boolean): void {
    this.readOnlyOn = on
    this.view.dispatch({ effects: this.readonly.reconfigure(on ? readOnlyExtension : []) })
  }

  get isReadOnly(): boolean {
    return this.view.state.readOnly
  }

  /** Applies a pure edit from `format.ts` to the main selection. */
  apply(fn: (doc: string, sel: Selection) => Edit): void {
    if (this.isReadOnly) return
    const { state } = this.view
    const range = state.selection.main
    const edit = fn(state.doc.toString(), { from: range.from, to: range.to })
    this.view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
      selection: EditorSelection.single(edit.selection.from, edit.selection.to),
      scrollIntoView: true,
      userEvent: 'input',
    })
    this.view.focus()
  }

  /** Moves the cursor to a 1-based line and scrolls it to the top. */
  goToLine(line: number, focus = true): void {
    const doc = this.view.state.doc
    const l = doc.line(Math.min(Math.max(line, 1), doc.lines))
    this.view.dispatch({
      selection: { anchor: l.from },
      effects: EditorView.scrollIntoView(l.from, { y: 'start', yMargin: 8 }),
    })
    if (focus) this.view.focus()
  }

  /** The (fractional) source line at the top of the visible editor area. */
  topLine(): number {
    const v = this.view
    const top = v.scrollDOM.scrollTop
    const block = v.lineBlockAtHeight(top)
    const line = v.state.doc.lineAt(block.from).number
    const frac = block.height > 0 ? (top - block.top) / block.height : 0
    return line + Math.min(Math.max(frac, 0), 1)
  }

  get lineCount(): number {
    return this.view.state.doc.lines
  }

  focus(): void {
    this.view.focus()
  }
}
