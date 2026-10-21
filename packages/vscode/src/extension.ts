import { webcrypto } from 'node:crypto'
import { dirname } from 'node:path'
import { type MarkupMeDocument, stats } from '@markupme/core'
import * as vscode from 'vscode'
import { diagnosticRange, fileExistsFrom, severityIndex } from './diagnostics.js'
import { type Emphasis, MARKERS, toggleEmphasis } from './emphasis.js'
import { ASSETS_DIR, exportPage } from './export.js'
import { greeting, LAST_VERSION_KEY, WALKTHROUGH_ID } from './onboarding.js'
import { createPipeline, formatMarkdown, type Pipeline } from './pipeline.js'
import { isMarkdown, PreviewManager } from './preview.js'
import { applyTrust, readSettings, tocOptions } from './settings.js'
import { computeTocEdit } from './toc.js'

// VS Code before 1.90 runs extensions on Node 18, which has no global Web Crypto; the browser-safe
// packages (nonces, diagram cache keys) use it.
if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto })

const VALIDATE_DEBOUNCE_MS = 300

function colorTheme(): 'light' | 'dark' {
  const kind = vscode.window.activeColorTheme.kind
  return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast
    ? 'dark'
    : 'light'
}

function buildPipeline(): Pipeline {
  const config = vscode.workspace.getConfiguration('markupme')
  return createPipeline(
    applyTrust(
      readSettings((key) => config.get(key)),
      vscode.workspace.isTrusted,
    ),
    colorTheme(),
  )
}

const fullRange = (doc: vscode.TextDocument) =>
  new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length))

export function activate(context: vscode.ExtensionContext): void {
  let pipeline = buildPipeline()
  const current = () => pipeline
  const preview = new PreviewManager(context, current)
  const diagnostics = vscode.languages.createDiagnosticCollection('markupme')
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  status.command = 'markupme.openPreview'
  status.tooltip = 'Open MarkupMe preview'
  context.subscriptions.push(preview, diagnostics, status)

  // Parsed documents, shared by diagnostics and the word count.
  const parsed = new Map<string, { version: number; doc: MarkupMeDocument }>()
  const parse = (d: vscode.TextDocument): MarkupMeDocument => {
    const key = d.uri.toString()
    const hit = parsed.get(key)
    if (hit && hit.version === d.version) return hit.doc
    const doc = pipeline.processor.parse(d.getText())
    parsed.set(key, { version: d.version, doc })
    return doc
  }

  // Diagnostics
  const validate = (d: vscode.TextDocument) => {
    // Skip read-only views such as git diffs, which would duplicate the file's problems.
    if (!isMarkdown(d) || (d.uri.scheme !== 'file' && d.uri.scheme !== 'untitled')) return
    if (!pipeline.settings.validateEnable) {
      diagnostics.delete(d.uri)
      return
    }
    const found = pipeline.processor.validate(parse(d), {
      rules: pipeline.settings.rules,
      ...(d.uri.scheme === 'file' ? { fileExists: fileExistsFrom(dirname(d.uri.fsPath)) } : {}),
    })
    diagnostics.set(
      d.uri,
      found.map((f) => {
        const r = diagnosticRange(f, (l) => d.lineAt(l).text.length, d.lineCount)
        const item = new vscode.Diagnostic(
          new vscode.Range(r.startLine, r.startCharacter, r.endLine, r.endCharacter),
          f.message,
          severityIndex(f.severity) as vscode.DiagnosticSeverity,
        )
        item.code = f.code
        item.source = 'markupme'
        return item
      }),
    )
  }
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const scheduleValidate = (d: vscode.TextDocument) => {
    const key = d.uri.toString()
    clearTimeout(timers.get(key))
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key)
        validate(d)
        if (vscode.window.activeTextEditor?.document === d) updateStatus()
      }, VALIDATE_DEBOUNCE_MS),
    )
  }

  // Status bar
  const updateStatus = () => {
    const d = vscode.window.activeTextEditor?.document
    if (!d || !isMarkdown(d)) {
      status.hide()
      return
    }
    const words = stats(parse(d).tree).words
    status.text = `$(book) MarkupMe: ${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`
    status.show()
  }

  // Formatting
  const formatEdits = (d: vscode.TextDocument): vscode.TextEdit[] => {
    const text = d.getText()
    const formatted = formatMarkdown(pipeline, text)
    return formatted === text ? [] : [vscode.TextEdit.replace(fullRange(d), formatted)]
  }
  let formatter: vscode.Disposable | undefined
  const syncFormatter = () => {
    if (pipeline.settings.formatEnable && !formatter)
      formatter = vscode.languages.registerDocumentFormattingEditProvider(
        { language: 'markdown' },
        { provideDocumentFormattingEdits: formatEdits },
      )
    else if (!pipeline.settings.formatEnable && formatter) {
      formatter.dispose()
      formatter = undefined
    }
  }
  syncFormatter()
  context.subscriptions.push({ dispose: () => formatter?.dispose() })

  const activeMarkdown = (): vscode.TextEditor | undefined => {
    const e = vscode.window.activeTextEditor
    if (e && isMarkdown(e.document)) return e
    void vscode.window.showInformationMessage('MarkupMe: open a Markdown file first.')
    return undefined
  }

  const toggle = async (kind: Emphasis) => {
    const e = activeMarkdown()
    if (!e) return
    const d = e.document
    const text = d.getText()
    const results = e.selections.map((sel) =>
      toggleEmphasis(text, d.offsetAt(sel.start), d.offsetAt(sel.end), kind),
    )
    // Apply from the end so earlier offsets stay valid, then map the selections into the new text.
    const ok = await e.edit((b) => {
      for (const r of [...results].sort((a, z) => z.start - a.start))
        b.replace(new vscode.Range(d.positionAt(r.start), d.positionAt(r.end)), r.text)
    })
    if (!ok) return
    const shiftBefore = (pos: number) =>
      results.reduce((n, r) => (r.end <= pos ? n + r.text.length - (r.end - r.start) : n), 0)
    e.selections = results.map((r) => {
      const shift = shiftBefore(r.start)
      return new vscode.Selection(
        d.positionAt(r.selectionStart + shift),
        d.positionAt(r.selectionEnd + shift),
      )
    })
  }

  const commandName = (kind: Emphasis) =>
    `markupme.toggle${kind.charAt(0).toUpperCase()}${kind.slice(1)}`

  context.subscriptions.push(
    ...(Object.keys(MARKERS) as Emphasis[]).map((kind) =>
      vscode.commands.registerCommand(commandName(kind), () => toggle(kind)),
    ),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      pipeline = buildPipeline()
      parsed.clear()
      void preview.refresh()
    }),
    vscode.commands.registerCommand('markupme.showWalkthrough', () =>
      vscode.commands.executeCommand('workbench.action.openWalkthrough', WALKTHROUGH_ID, false),
    ),
    vscode.commands.registerCommand('markupme.openPreview', () => preview.show(false)),
    vscode.commands.registerCommand('markupme.openPreviewToSide', () => preview.show(true)),
    // Not contributed to the palette: lets tests read what the preview rendered.
    vscode.commands.registerCommand('markupme.previewState', () => preview.lastReport),
    vscode.commands.registerCommand('markupme.formatDocument', async () => {
      const e = activeMarkdown()
      if (!e) return
      const edits = formatEdits(e.document)
      if (edits.length === 0) return
      const we = new vscode.WorkspaceEdit()
      we.set(e.document.uri, edits)
      await vscode.workspace.applyEdit(we)
    }),
    vscode.commands.registerCommand('markupme.insertToc', async () => {
      const e = activeMarkdown()
      if (!e) return
      const d = e.document
      const result = computeTocEdit(
        d.getText(),
        pipeline.formatProcessor,
        tocOptions(pipeline.settings),
      )
      if (result.kind === 'empty') {
        void vscode.window.showInformationMessage(
          `MarkupMe: no h${pipeline.settings.toc.minDepth}–h${pipeline.settings.toc.maxDepth} headings to list.`,
        )
        return
      }
      if (result.kind === 'unchanged') {
        void vscode.window.setStatusBarMessage('MarkupMe: table of contents is up to date', 3000)
        return
      }
      const { start, end, text } = result.edit
      await e.edit((b) => b.replace(new vscode.Range(d.positionAt(start), d.positionAt(end)), text))
    }),
    // An optional target URI skips the save dialog (keybindings, tasks and tests).
    vscode.commands.registerCommand('markupme.exportHtml', async (to?: unknown) => {
      const e = activeMarkdown()
      if (!e) return
      const d = e.document
      const name = (d.uri.path.split('/').pop() ?? 'document').replace(
        /\.(?:md|markdown|mdx?)$/i,
        '',
      )
      const folder =
        d.uri.scheme === 'untitled'
          ? (vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(process.cwd()))
          : vscode.Uri.joinPath(d.uri, '..')
      const given = to instanceof vscode.Uri ? to : undefined
      const target =
        given ??
        (await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.joinPath(folder, `${name}.html`),
          filters: { HTML: ['html', 'htm'] },
          title: 'Export to HTML',
        }))
      if (!target) return
      const page = await exportPage(pipeline, d.getText(), {
        ...(d.uri.scheme === 'file' ? { file: d.uri.fsPath } : {}),
        fallbackTitle: name,
      })
      const fs = vscode.workspace.fs
      await fs.writeFile(target, new TextEncoder().encode(page.html))
      const assets = vscode.Uri.joinPath(target, '..', ASSETS_DIR)
      const media = vscode.Uri.joinPath(context.extensionUri, 'media')
      if (page.needs.mermaid)
        await fs.copy(
          vscode.Uri.joinPath(media, 'mermaid.min.js'),
          vscode.Uri.joinPath(assets, 'mermaid.min.js'),
          { overwrite: true },
        )
      if (page.needs.math)
        await fs.copy(vscode.Uri.joinPath(media, 'katex'), vscode.Uri.joinPath(assets, 'katex'), {
          overwrite: true,
        })
      if (given) return
      const open = await vscode.window.showInformationMessage(
        `MarkupMe: exported ${target.path.split('/').pop()}`,
        'Open in Browser',
      )
      if (open) await vscode.env.openExternal(target)
    }),
    vscode.workspace.onDidOpenTextDocument(validate),
    vscode.workspace.onDidChangeTextDocument((ev) => {
      if (isMarkdown(ev.document)) scheduleValidate(ev.document)
    }),
    vscode.workspace.onDidSaveTextDocument(validate),
    vscode.workspace.onDidCloseTextDocument((d) => {
      diagnostics.delete(d.uri)
      parsed.delete(d.uri.toString())
    }),
    vscode.window.onDidChangeActiveTextEditor(updateStatus),
    vscode.window.onDidChangeActiveColorTheme(() => {
      pipeline = buildPipeline()
      parsed.clear()
      void preview.refresh()
    }),
    vscode.workspace.onDidChangeConfiguration((ev) => {
      if (!ev.affectsConfiguration('markupme')) return
      pipeline = buildPipeline()
      parsed.clear()
      syncFormatter()
      for (const d of vscode.workspace.textDocuments) validate(d)
      updateStatus()
      void preview.refresh()
    }),
    {
      dispose: () => {
        for (const t of timers.values()) clearTimeout(t)
      },
    },
  )

  for (const d of vscode.workspace.textDocuments) validate(d)
  updateStatus()
  void greet(context)
}

/** Opens the walkthrough on the first run and mentions feature releases once. */
async function greet(context: vscode.ExtensionContext): Promise<void> {
  if (context.extensionMode === vscode.ExtensionMode.Test) return
  const current = String(context.extension.packageJSON.version ?? '')
  const previous = context.globalState.get<string>(LAST_VERSION_KEY)
  const whatsNew = vscode.workspace
    .getConfiguration('markupme')
    .get<boolean>('notifications.whatsNew', true)
  const kind = greeting(previous, current, whatsNew)
  await context.globalState.update(LAST_VERSION_KEY, current)
  if (kind === 'welcome') {
    await vscode.commands.executeCommand('workbench.action.openWalkthrough', WALKTHROUGH_ID, false)
  } else if (kind === 'whatsNew') {
    const notes = 'Release Notes'
    const pick = await vscode.window.showInformationMessage(
      `MarkupMe ${current} is installed. See what's new.`,
      notes,
    )
    if (pick === notes)
      await vscode.env.openExternal(
        vscode.Uri.parse(
          'https://github.com/YarlisAISolutions/markupme/blob/main/packages/vscode/CHANGELOG.md',
        ),
      )
  }
}

export function deactivate(): void {}
