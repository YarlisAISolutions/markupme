import { describe, expect, it } from 'vitest'
import {
  isLineClass,
  lineFromClasses,
  normalizeAnchors,
  previewOffsetForLine,
} from '../src/sync.js'

describe('lineFromClasses', () => {
  it('reads the source-line class', () => {
    expect(lineFromClasses(['markdown-alert', 'mm-srcline-12'])).toBe(12)
    expect(lineFromClasses(['mm-callout'])).toBeUndefined()
    expect(lineFromClasses(['mm-srcline-x', 'mm-srcline-0'])).toBeUndefined()
  })

  it('does not confuse highlighter classes with source lines', () => {
    expect(isLineClass('mm-srcline-3')).toBe(true)
    expect(isLineClass('mm-line-numbers')).toBe(false)
    expect(isLineClass('mm-line-highlight')).toBe(false)
    expect(isLineClass('mm-srcline-abc')).toBe(false)
  })
})

describe('normalizeAnchors', () => {
  it('sorts by line and drops duplicates and backwards offsets', () => {
    expect(
      normalizeAnchors([
        { line: 10, top: 300 },
        { line: 1, top: 0 },
        { line: 5, top: 120 },
        { line: 5, top: 130 },
        { line: 7, top: 50 },
      ]),
    ).toEqual([
      { line: 1, top: 0 },
      { line: 5, top: 120 },
      { line: 10, top: 300 },
    ])
  })
})

describe('previewOffsetForLine', () => {
  const anchors = [
    { line: 3, top: 100 },
    { line: 7, top: 300 },
    { line: 9, top: 500 },
  ]

  it('maps an anchor line exactly', () => {
    expect(previewOffsetForLine(3, anchors, 20, 2000)).toBe(100)
    expect(previewOffsetForLine(7, anchors, 20, 2000)).toBe(300)
  })

  it('interpolates between anchors', () => {
    expect(previewOffsetForLine(5, anchors, 20, 2000)).toBe(200)
    expect(previewOffsetForLine(8.5, anchors, 20, 2000)).toBe(450)
  })

  it('starts at 0 before the first anchor', () => {
    expect(previewOffsetForLine(1, anchors, 20, 2000)).toBe(0)
    expect(previewOffsetForLine(2, anchors, 20, 2000)).toBe(50)
  })

  it('runs towards the end after the last anchor', () => {
    expect(previewOffsetForLine(20, anchors, 20, 1000)).toBe(1000)
    expect(previewOffsetForLine(14.5, anchors, 20, 1000)).toBe(750)
    expect(previewOffsetForLine(30, anchors, 20, 1000)).toBe(1000)
  })

  it('returns 0 without anchors', () => {
    expect(previewOffsetForLine(10, [], 20, 1000)).toBe(0)
  })
})
