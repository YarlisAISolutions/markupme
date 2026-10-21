// Runs the end-to-end suite inside a real VS Code extension host (needs a display).
// Set VSCODE_EXECUTABLE to use an installed VS Code (or a fork); otherwise one is downloaded:
// VSCODE_VERSION picks it (for example 1.82.2, the oldest supported, or stable).
// Run `bun run build` first.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runTests } from '@vscode/test-electron'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const scratch = mkdtempSync(join(tmpdir(), 'markupme-e2e-'))
const code = await runTests({
  extensionDevelopmentPath: root,
  extensionTestsPath: join(root, 'test/e2e/suite.cjs'),
  ...(process.env.VSCODE_EXECUTABLE ? { vscodeExecutablePath: process.env.VSCODE_EXECUTABLE } : {}),
  ...(process.env.VSCODE_VERSION ? { version: process.env.VSCODE_VERSION } : {}),
  launchArgs: [
    '--disable-extensions',
    `--user-data-dir=${join(scratch, 'user')}`,
    `--extensions-dir=${join(scratch, 'extensions')}`,
    join(scratch, 'workspace'),
  ],
  extensionTestsEnv: { MARKUPME_E2E_DIR: join(scratch, 'workspace') },
})
process.exit(code)
