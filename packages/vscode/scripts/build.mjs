// Bundles the extension (Node, CommonJS) and the preview script (browser), then copies the
// browser assets the preview and HTML export need into media/.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))
const media = join(root, 'media')

rmSync(join(root, 'dist'), { recursive: true, force: true })
for (const f of ['preview.js', 'mermaid.min.js', 'katex'])
  rmSync(join(media, f), { recursive: true, force: true })
mkdirSync(media, { recursive: true })

await build({
  entryPoints: [join(root, 'src/extension.ts')],
  outfile: join(root, 'dist/extension.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
  minify: true,
  legalComments: 'none',
  logLevel: 'warning',
})

await build({
  entryPoints: [join(root, 'src/webview/main.ts')],
  outfile: join(media, 'preview.js'),
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  minify: true,
  logLevel: 'warning',
})

cpSync(
  join(dirname(require.resolve('mermaid/package.json')), 'dist', 'mermaid.min.js'),
  join(media, 'mermaid.min.js'),
)
const katex = join(dirname(require.resolve('katex/package.json')), 'dist')
mkdirSync(join(media, 'katex', 'fonts'), { recursive: true })
cpSync(join(katex, 'katex.min.css'), join(media, 'katex', 'katex.min.css'))
for (const f of readdirSync(join(katex, 'fonts')))
  cpSync(join(katex, 'fonts', f), join(media, 'katex', 'fonts', f))

// The extension must not load native modules (resvg comes only from @bpview/core/node).
const bundle = readFileSync(join(root, 'dist/extension.js'), 'utf8')
const native = bundle.match(/require\(\s*["'][^"']*\.node["']\s*\)/g)
if (native) throw new Error(`dist/extension.js requires native modules: ${native.join(', ')}`)
if (!existsSync(join(media, 'mermaid.min.js'))) throw new Error('mermaid.min.js was not copied')
console.log(`dist/extension.js ${(bundle.length / 1024 / 1024).toFixed(1)} MB`)
