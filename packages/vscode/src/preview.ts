import { markupmeCss } from '@markupme/themes'
import * as vscode from 'vscode'
import { createNonce, previewPage } from './html.js'
import { type Pipeline, renderBody } from './pipeline.js'

const VIEW_TYPE = 'markupme.preview'
const DEBOUNCE_MS = 200

export const isMarkdown = (doc: vscode.TextDocument) => doc.languageId === 'markdown'

/** One MarkupMe preview panel that follows the active Markdown editor. */
export class PreviewManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined
  private document: vscode.TextDocument | undefined
  private renderId = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private latestHtml = ''
  private lastLine: number | undefined
  private readonly disposables: vscode.Disposable[] = []
  /** What the webview last reported (diagram and block counts, theme, scroll). */
  lastReport: Record<string, unknown> | undefined

  constructor(
    private readonly context: vscode.ExtensionContext,
    private pipeline: () => Pipeline,
  ) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === this.document) this.schedule()
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (
          this.panel &&
          editor &&
          isMarkdown(editor.document) &&
          editor.document !== this.document
        )
          void this.setDocument(editor.document)
      }),
      vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
        if (!this.panel?.visible || e.textEditor.document !== this.document) return
        const first = e.visibleRanges[0]
        if (!first) return
        this.lastLine = first.start.line + 1
        void this.panel.webview.postMessage({ type: 'scroll', line: this.lastLine })
      }),
    )
  }

  get mediaUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.context.extensionUri, 'media')
  }

  /** Opens (or reveals) the preview for the active Markdown editor. */
  async show(toSide: boolean): Promise<void> {
    const editor = vscode.window.activeTextEditor
    const doc = editor && isMarkdown(editor.document) ? editor.document : this.document
    if (!doc) {
      void vscode.window.showInformationMessage('MarkupMe: open a Markdown file to preview it.')
      return
    }
    const column = toSide
      ? vscode.ViewColumn.Beside
      : (editor?.viewColumn ?? vscode.ViewColumn.Active)
    if (this.panel) {
      this.panel.reveal(column, toSide)
      if (doc !== this.document) await this.setDocument(doc)
      return
    }
    this.panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      this.titleFor(doc),
      { viewColumn: column, preserveFocus: toSide },
      {
        enableScripts: true,
        enableFindWidget: true,
        retainContextWhenHidden: true,
        localResourceRoots: this.rootsFor(doc),
      },
    )
    this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'icon.png')
    this.panel.onDidDispose(() => {
      this.panel = undefined
      this.lastReport = undefined
      this.document = undefined
      if (this.timer) clearTimeout(this.timer)
    })
    this.panel.webview.onDidReceiveMessage((m: { type?: string; href?: string }) => {
      if (m.type === 'rendered') this.lastReport = m as Record<string, unknown>
      else if (m.type === 'ready' && this.latestHtml)
        void this.panel?.webview.postMessage({
          type: 'update',
          html: this.latestHtml,
          ...(this.lastLine ? { line: this.lastLine } : {}),
        })
      else if (m.type === 'link' && typeof m.href === 'string') void this.openLink(m.href)
    })
    if (editor?.document === doc) this.lastLine = (editor.visibleRanges[0]?.start.line ?? 0) + 1
    await this.setDocument(doc, true)
  }

  /** Re-renders the whole page, for example after a settings or color theme change. */
  async refresh(): Promise<void> {
    if (this.panel && this.document) await this.setDocument(this.document, true)
  }

  private titleFor(doc: vscode.TextDocument): string {
    const name = doc.uri.path.split('/').pop() || 'Untitled'
    return `Preview ${name}`
  }

  private rootsFor(doc: vscode.TextDocument): vscode.Uri[] {
    const roots = [this.mediaUri, ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri)]
    if (doc.uri.scheme !== 'untitled') roots.push(vscode.Uri.joinPath(doc.uri, '..'))
    return roots
  }

  private baseUrlFor(doc: vscode.TextDocument): string | undefined {
    if (!this.panel || doc.uri.scheme === 'untitled') return undefined
    const dir = vscode.Uri.joinPath(doc.uri, '..')
    return `${this.panel.webview.asWebviewUri(dir).toString().replace(/\/+$/, '')}/`
  }

  private async setDocument(doc: vscode.TextDocument, reload = false): Promise<void> {
    const panel = this.panel
    if (!panel) return
    const changed = doc !== this.document
    this.document = doc
    panel.title = this.titleFor(doc)
    if (changed || reload) {
      panel.webview.options = {
        enableScripts: true,
        localResourceRoots: this.rootsFor(doc),
      }
      const html = await this.renderHtml(doc)
      if (html === undefined || this.panel !== panel) return
      this.latestHtml = html
      const webview = panel.webview
      const media = this.mediaUri
      const s = this.pipeline().settings
      webview.html = previewPage({
        cspSource: webview.cspSource,
        nonce: createNonce(),
        css: markupmeCss,
        scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(media, 'preview.js')).toString(),
        mermaidUri: webview.asWebviewUri(vscode.Uri.joinPath(media, 'mermaid.min.js')).toString(),
        ...(s.math
          ? {
              katexCssUri: webview
                .asWebviewUri(vscode.Uri.joinPath(media, 'katex', 'katex.min.css'))
                .toString(),
            }
          : {}),
        body: html,
        theme: s.theme,
        title: this.titleFor(doc),
      })
    }
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.update(), DEBOUNCE_MS)
  }

  private async update(): Promise<void> {
    const doc = this.document
    const panel = this.panel
    if (!doc || !panel) return
    const html = await this.renderHtml(doc)
    if (html === undefined || doc !== this.document || panel !== this.panel) return
    this.latestHtml = html
    void panel.webview.postMessage({ type: 'update', html })
  }

  /** Renders the document; returns undefined when a newer render started meanwhile. */
  private async renderHtml(doc: vscode.TextDocument): Promise<string | undefined> {
    const id = ++this.renderId
    try {
      const baseUrl = this.baseUrlFor(doc)
      const r = await renderBody(this.pipeline(), doc.getText(), {
        preview: true,
        ...(baseUrl ? { baseUrl } : {}),
      })
      return id === this.renderId ? r.output : undefined
    } catch (error) {
      if (id !== this.renderId) return undefined
      const msg = String((error as Error).message ?? error).replace(
        /[&<>"']/g,
        (c) => `&#${c.charCodeAt(0)};`,
      )
      return `<div class="mm-diagram-error" role="alert"><strong>MarkupMe could not render this document</strong><pre>${msg}</pre></div>`
    }
  }

  private async openLink(href: string): Promise<void> {
    const doc = this.document
    if (/^(?:https?|mailto):/i.test(href)) {
      await vscode.env.openExternal(vscode.Uri.parse(href))
      return
    }
    const base = doc ? this.baseUrlFor(doc) : undefined
    if (!doc || !base || !href.startsWith(base)) return
    const [path = '', fragment] = href.slice(base.length).split('#')
    let rel = path
    try {
      rel = decodeURIComponent(path)
    } catch {
      // keep the raw path
    }
    const target = vscode.Uri.joinPath(doc.uri, '..', rel)
    const uri = fragment ? target.with({ fragment }) : target
    await vscode.commands.executeCommand('vscode.open', uri)
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    this.panel?.dispose()
    for (const d of this.disposables) d.dispose()
  }
}
