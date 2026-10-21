// End-to-end checks that run inside the VS Code extension host (see scripts/e2e.mjs).
const assert = require('node:assert/strict')
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const vscode = require('vscode')

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(what, check, timeout = 15000) {
  const end = Date.now() + timeout
  for (;;) {
    const value = await check()
    if (value) return value
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await wait(100)
  }
}

const SOURCE = [
  '# Title',
  '',
  'See [missing](./missing.md) and [here](./other.md).',
  '',
  '## One',
  '',
  '```dot',
  'digraph { a -> b }',
  '```',
  '',
  '* starred bullet',
  '',
  '```mermaid',
  'graph TD; A-->B',
  '```',
  '',
  '# Second',
  '',
  ...Array.from({ length: 80 }, (_, i) => `Filler paragraph ${i + 1}.\n`),
].join('\n')

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (error) {
    console.log(`  FAIL ${name}: ${error.stack || error}`)
    throw error
  }
}

exports.run = async () => {
  const dir = process.env.MARKUPME_E2E_DIR
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'doc.md')
  writeFileSync(file, SOURCE)
  writeFileSync(join(dir, 'other.md'), '# Other\n')

  const ext = vscode.extensions.getExtension('yarlis.markupme-vscode')
  assert.ok(ext, 'extension is installed')
  const doc = await vscode.workspace.openTextDocument(file)
  await vscode.window.showTextDocument(doc)
  await until('activation', () => ext.isActive)

  await test('commands are registered', async () => {
    const all = await vscode.commands.getCommands(true)
    for (const c of [
      'markupme.openPreview',
      'markupme.openPreviewToSide',
      'markupme.exportHtml',
      'markupme.insertToc',
      'markupme.formatDocument',
      'markupme.toggleBold',
      'markupme.toggleItalic',
      'markupme.toggleStrikethrough',
      'markupme.toggleCode',
      'markupme.showWalkthrough',
    ])
      assert.ok(all.includes(c), c)
  })

  await test('diagnostics come from processor.validate', async () => {
    const diags = await until('diagnostics', () => {
      const d = vscode.languages.getDiagnostics(doc.uri)
      return d.length >= 2 ? d : undefined
    })
    const codes = diags.map((d) => `${d.source}:${d.code}`)
    assert.ok(codes.includes('markupme:MM002'), `single-h1 in ${codes}`)
    assert.ok(codes.includes('markupme:MM012'), `missing-local-file in ${codes}`)
    const missing = diags.filter((d) => d.code === 'MM012')
    assert.equal(missing.length, 1, 'other.md exists, missing.md does not')
    assert.equal(missing[0].range.start.line, 2)
  })

  await test('settings change rule severities', async () => {
    const config = vscode.workspace.getConfiguration('markupme')
    await config.update('validate.rules', { 'single-h1': 'off' }, vscode.ConfigurationTarget.Global)
    await until('rule off', () =>
      vscode.languages.getDiagnostics(doc.uri).every((d) => d.code !== 'MM002'),
    )
    await config.update('validate.rules', undefined, vscode.ConfigurationTarget.Global)
  })

  await test('insert TOC is one undoable edit that keeps the rest', async () => {
    await vscode.commands.executeCommand('markupme.insertToc')
    const text = doc.getText()
    assert.ok(text.startsWith('# Title\n\n<!-- toc -->\n\n- [One](#one)\n\n<!-- tocstop -->\n\n'))
    assert.ok(text.includes('* starred bullet'), 'rest of the document is not reformatted')
    await vscode.commands.executeCommand('markupme.insertToc')
    assert.equal(doc.getText(), text, 'second run changes nothing')
    await vscode.commands.executeCommand('undo')
    assert.equal(doc.getText(), SOURCE)
  })

  await test('format document normalizes', async () => {
    await vscode.commands.executeCommand('markupme.formatDocument')
    assert.ok(doc.getText().includes('- starred bullet'))
    await vscode.commands.executeCommand('undo')
    assert.equal(doc.getText(), SOURCE)
  })

  await test('formatter is not registered unless enabled', async () => {
    const edits = await vscode.commands.executeCommand(
      'vscode.executeFormatDocumentProvider',
      doc.uri,
      { tabSize: 2, insertSpaces: true },
    )
    assert.ok(!edits || edits.length === 0)
    const config = vscode.workspace.getConfiguration('markupme')
    await config.update('format.enable', true, vscode.ConfigurationTarget.Global)
    const after = await until('formatter', async () => {
      const e = await vscode.commands.executeCommand(
        'vscode.executeFormatDocumentProvider',
        doc.uri,
        { tabSize: 2, insertSpaces: true },
      )
      return e && e.length > 0 ? e : undefined
    })
    // VS Code shrinks provider edits to minimal ones, so apply them and check the result.
    const we = new vscode.WorkspaceEdit()
    we.set(doc.uri, after)
    await vscode.workspace.applyEdit(we)
    assert.ok(doc.getText().includes('- starred bullet'))
    await vscode.commands.executeCommand('undo')
    assert.equal(doc.getText(), SOURCE)
    await config.update('format.enable', undefined, vscode.ConfigurationTarget.Global)
  })

  await test('toggle bold wraps the word under the cursor and toggles back', async () => {
    const scratch = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: 'make this bold\n',
    })
    const editor = await vscode.window.showTextDocument(scratch)
    editor.selection = new vscode.Selection(0, 6, 0, 6)
    await vscode.commands.executeCommand('markupme.toggleBold')
    assert.equal(scratch.getText(), 'make **this** bold\n')
    assert.equal(scratch.getText(editor.selection), 'this')
    await vscode.commands.executeCommand('markupme.toggleBold')
    assert.equal(scratch.getText(), 'make this bold\n')
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
  })

  await test('manifest contributes snippets, a walkthrough, a config schema and trust limits', async () => {
    const pkg = ext.packageJSON
    assert.equal(pkg.contributes.walkthroughs[0].id, 'markupme.gettingStarted')
    for (const step of pkg.contributes.walkthroughs[0].steps)
      assert.ok(existsSync(join(ext.extensionPath, step.media.markdown)), step.media.markdown)
    const snippets = JSON.parse(
      readFileSync(join(ext.extensionPath, pkg.contributes.snippets[0].path), 'utf8'),
    )
    assert.ok(snippets['Mermaid diagram'])
    assert.ok(existsSync(join(ext.extensionPath, pkg.contributes.jsonValidation[0].url)))
    assert.deepEqual(pkg.capabilities.untrustedWorkspaces.restrictedConfigurations, [
      'markupme.preview.sanitize',
      'markupme.diagrams.server',
    ])
  })

  await test('export writes a standalone page and copies Mermaid', async () => {
    await vscode.window.showTextDocument(doc)
    const out = join(dir, 'out', 'doc.html')
    mkdirSync(join(dir, 'out'), { recursive: true })
    await vscode.commands.executeCommand('markupme.exportHtml', vscode.Uri.file(out))
    const html = readFileSync(out, 'utf8')
    assert.ok(html.startsWith('<!doctype html>'))
    assert.ok(html.includes('<title>Title</title>'))
    assert.ok(html.includes('mm-diagram-graphviz'))
    assert.ok(html.includes('"assets/mermaid.min.js"'))
    assert.ok(existsSync(join(dir, 'out', 'assets', 'mermaid.min.js')))
  })

  await test('preview opens to the side as a MarkupMe webview', async () => {
    await vscode.window.showTextDocument(doc)
    await vscode.commands.executeCommand('markupme.openPreviewToSide')
    const tab = await until('preview tab', () =>
      vscode.window.tabGroups.all
        .flatMap((g) => g.tabs)
        .find(
          (t) =>
            t.input instanceof vscode.TabInputWebview &&
            t.input.viewType.includes('markupme.preview'),
        ),
    )
    assert.equal(tab.label, 'Preview doc.md')
    // Graphviz renders in the extension host; Mermaid renders in the webview under the CSP.
    const state = await until('rendered preview', async () => {
      const s = await vscode.commands.executeCommand('markupme.previewState')
      return s && s.diagrams >= 1 && s.mermaid >= 1 ? s : undefined
    })
    console.log('       preview state', JSON.stringify(state))
    assert.deepEqual(state.blocks.slice(0, 6), [1, 3, 5, 11, 17, 19])
    assert.ok(state.theme === 'light' || state.theme === 'dark')
    // Live update and scroll sync must not throw while the panel is open.
    const editor = vscode.window.visibleTextEditors.find((e) => e.document === doc)
    await editor.edit((b) => b.insert(new vscode.Position(doc.lineCount - 1, 0), '\nMore text\n'))
    editor.revealRange(new vscode.Range(60, 0, 60, 0), vscode.TextEditorRevealType.AtTop)
    const scrolled = await until('scroll sync', async () => {
      const s = await vscode.commands.executeCommand('markupme.previewState')
      return s && s.scrollY > state.scrollY + 200 ? s : undefined
    })
    console.log('       after scroll', JSON.stringify(scrolled))
    await vscode.commands.executeCommand('undo')
  })
}
