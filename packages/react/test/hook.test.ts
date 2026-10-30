// @vitest-environment happy-dom
import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Markdown, useMarkdown } from '../src/index.js'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let cleanup: (() => void) | undefined
afterEach(() => cleanup?.())

function mount(element: ReturnType<typeof createElement>) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(element))
  cleanup = () => {
    act(() => root.unmount())
    container.remove()
  }
  return container
}

const Em = (p: { children?: unknown }) =>
  createElement('i', { className: 'em' }, p.children as never)

let setSource: (s: string) => void = () => {}
let renders = 0
function App() {
  const [source, set] = useState('first')
  setSource = set
  renders++
  return useMarkdown(source, { options: { emoji: true }, render: { anchors: false } })
}

describe('<Markdown> and useMarkdown in the browser', () => {
  it('renders after the first effect, with component overrides', async () => {
    const container = mount(
      createElement(Markdown, {
        source: '# Hi\n\nSome *text*.',
        fallback: 'Loading',
        components: { em: Em },
      }),
    )
    expect(container.innerHTML).toBe('Loading')
    await vi.waitFor(() => expect(container.querySelector('h1')?.textContent).toBe('Hi'))
    expect(container.querySelector('i.em')?.textContent).toBe('text')
  })

  it('re-renders when the source changes, with inline options', async () => {
    renders = 0
    const container = mount(createElement(App))
    await vi.waitFor(() => expect(container.textContent).toBe('first'))
    await act(async () => setSource('second :tada:'))
    await vi.waitFor(() => expect(container.textContent).toBe('second 🎉'))
    const settled = renders
    await new Promise((r) => setTimeout(r, 50))
    expect(renders).toBe(settled)
  })
})
