// Renders the MarkupMe mark (brand/mark.svg at the repo root) to the icon.png the Marketplace and
// Open VSX show. 256x256 so it stays sharp on high-density screens. Run with `bun run icon`.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, '..', '..', 'brand', 'mark.svg'), 'utf8')
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 256 } }).render().asPng()
writeFileSync(join(root, 'icon.png'), png)
console.log(`icon.png ${png.length} bytes`)
