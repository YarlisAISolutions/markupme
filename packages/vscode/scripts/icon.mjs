// Renders icon.svg to the 128x128 icon.png the Marketplace needs. Run with `bun run icon`.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'icon.svg'), 'utf8')
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 128 } }).render().asPng()
writeFileSync(join(root, 'icon.png'), png)
console.log(`icon.png ${png.length} bytes`)
