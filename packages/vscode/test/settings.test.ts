import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  formatOptions,
  processorOptions,
  readSettings,
  renderOptions,
} from '../src/settings.js'

const from = (o: Record<string, unknown>) => readSettings((k) => o[k])

describe('settings', () => {
  it('uses defaults when nothing is set', () => {
    expect(from({})).toEqual(DEFAULT_SETTINGS)
  })

  it('reads valid values and drops invalid ones', () => {
    const s = from({
      'preview.theme': 'dark',
      'preview.sanitize': false,
      'markdown.math': true,
      'markdown.emoji': 'yes',
      'diagrams.providers': ['mermaid', 'kroki', 'mermaid', 3],
      'diagrams.server': ' https://kroki.io ',
      'toc.minDepth': 4,
      'toc.maxDepth': 2,
      'validate.rules': { 'single-h1': 'off', MM005: 'error', bad: 'loud' },
    })
    expect(s.theme).toBe('dark')
    expect(s.sanitize).toBe(false)
    expect(s.math).toBe(true)
    expect(s.emoji).toBe(false)
    expect(s.providers).toEqual(['mermaid'])
    expect(s.server).toBe('https://kroki.io')
    expect(s.toc).toEqual({ minDepth: 2, maxDepth: 4 })
    expect(s.rules).toEqual({ 'single-h1': 'off', MM005: 'error' })
    expect(from({ 'preview.theme': 'neon' }).theme).toBe('auto')
  })

  it('maps settings to processor and render options', () => {
    const s = from({ 'markdown.math': true, 'preview.sanitize': false })
    expect(processorOptions(s)).toEqual({
      math: true,
      emoji: false,
      toc: { minDepth: 2, maxDepth: 3 },
    })
    expect(formatOptions(s).toc).toBe(false)
    expect(renderOptions(s, { baseUrl: 'https://x/' })).toMatchObject({
      format: 'html',
      sanitize: false,
      anchors: true,
      baseUrl: 'https://x/',
    })
  })
})
