import { createProcessor } from '@markupme/core'
import { describe, expect, it } from 'vitest'
import {
  lineFromClassName,
  nearestBlock,
  scrollTopForLine,
  sourceLinePlugin,
} from '../src/lines.js'

describe('source line classes', () => {
  it('tags blocks with their line and keeps existing classes', async () => {
    const p = createProcessor({ plugins: [sourceLinePlugin] })
    const md =
      '# Title\n\npara\n\n> [!NOTE]\n> note\n\n- a\n- b\n\n- [x] done\n\n| a |\n| - |\n| 1 |\n'
    const { output } = await p.render(md)
    expect(output).toContain('<h1 id="title"><span class="mm-line-1"></span>Title</h1>')
    expect(output).toContain('<p class="mm-line-3">para</p>')
    expect(output).toMatch(/class="markdown-alert markdown-alert-note mm-line-5"/)
    expect(output).toContain('<p class="mm-line-8"><span class="mm-line-8"></span>a</p>')
    expect(output).toContain(
      '<input type="checkbox" checked disabled> <span class="mm-line-11"></span>done',
    )
    expect(output).toContain('class="contains-task-list"')
    expect(output).toContain('class="task-list-item"')
    expect(output).toContain('<table class="mm-line-13">')
  })

  it('marks h2 headings and tight lists, which cannot carry classes themselves', async () => {
    const p = createProcessor({ plugins: [sourceLinePlugin] })
    const { output } = await p.render('## Two\n\n- a\n- b\n')
    expect(output).toContain('<h2 id="two"><span class="mm-line-1"></span>Two</h2>')
    expect(output).toContain('<li><span class="mm-line-3"></span>a</li>')
    expect(output).toContain('<li><span class="mm-line-4"></span>b</li>')
  })

  it('does not change the source document', () => {
    const p = createProcessor({ plugins: [sourceLinePlugin] })
    expect(p.serialize(p.parse('# A\n\ntext\n'))).toBe('# A\n\ntext\n')
  })

  it('reads lines back from class names', () => {
    expect(lineFromClassName('foo mm-line-12 bar')).toBe(12)
    expect(lineFromClassName('mm-line-x')).toBeUndefined()
    expect(lineFromClassName('mm-line-3')).toBe(3)
  })
})

describe('line → block mapping', () => {
  const blocks = [
    { line: 1, top: 0 },
    { line: 5, top: 100 },
    { line: 9, top: 300 },
  ]
  it('finds the nearest block at or above a line', () => {
    expect(nearestBlock([1, 5, 9], 0)).toBe(-1)
    expect(nearestBlock([1, 5, 9], 5)).toBe(1)
    expect(nearestBlock([1, 5, 9], 7)).toBe(1)
    expect(nearestBlock([1, 5, 9], 99)).toBe(2)
  })
  it('interpolates the scroll offset between blocks', () => {
    expect(scrollTopForLine([], 3)).toBeUndefined()
    expect(scrollTopForLine(blocks, 1)).toBe(0)
    expect(scrollTopForLine(blocks, 3)).toBe(50)
    expect(scrollTopForLine(blocks, 7)).toBe(200)
    expect(scrollTopForLine(blocks, 20)).toBe(300)
    expect(scrollTopForLine([{ line: 4, top: 40 }], 2)).toBe(0)
  })
})
