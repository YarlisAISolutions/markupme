# ADR 0005: Diagram provider interface

- Status: Accepted
- Date: 2026-10-20

## Context

The brief asks for Mermaid (flowchart, sequence, state, class, ER, Gantt, C4), Graphviz, PlantUML, Structurizr, C4 and Yarlis Blueprint, without writing diagram grammars ourselves, and with room for future or proprietary renderers. The tools differ a lot: Blueprint is a pure JavaScript library, Graphviz is C (available as WebAssembly), Mermaid needs a browser DOM to measure text, and PlantUML and Structurizr are Java.

## Decision

`@markupme/diagrams` defines one interface and wraps every renderer behind it:

```ts
interface DiagramProvider {
  id: string
  langs: string[]                 // fence languages
  mode: 'server' | 'client'
  remote?: boolean                // needs the network
  render(req: { lang; source; theme }): Promise<{ kind: 'svg'; svg } | { kind: 'client'; html }>
}
```

Built-in providers:

| Provider | Languages | Mode | Backend |
| -------- | --------- | ---- | ------- |
| `blueprint` | `ybp`, `blueprint`, `blueprint-yaml` | server | `@bpview/core` (`renderSourceToSvg`) |
| `graphviz` | `dot`, `graphviz` | server | `@hpcc-js/wasm-graphviz` (WebAssembly, no system binary) |
| `mermaid` | `mermaid` | client | `<pre class="mermaid">` rendered by the page runtime ([ADR 0006](0006-mermaid-client-side.md)) |
| `kroki` | `plantuml`, `puml`, `c4plantuml`, `c4`, `structurizr`, `d2`, and others in `KROKI_TYPES` | server, remote | A Kroki server; opt-in only |

`diagramHandler({ providers, theme, cacheSize })` turns providers into a `CodeBlockHandler` for the core. It:

- picks the first provider that claims the fence language;
- passes every SVG through `sanitizeSvg` before use;
- wraps output in `<figure class="mm-diagram mm-diagram-<id>" role="group" aria-label="<id> diagram">`;
- turns a failure into an inline error box plus an `MM040` diagnostic, never a crash;
- caches by SHA-256 of provider id, theme, language and source (default 200 entries).

Defaults are blueprint, graphviz and mermaid: nothing touches the network unless a Kroki server is configured.

## Alternatives

| Option | Why not |
| ------ | ------- |
| Hard-code each diagram type in the core | Couples the browser-safe core to heavy dependencies; no way to add renderers. |
| Kroki for everything | Every diagram goes over the network, which leaks private source and fails offline. |
| Run PlantUML/Structurizr through a local Java process | Needs Java on every machine. Can be added later as another provider. |
| Render Mermaid on the server with jsdom | Mermaid's layout needs real text measurement; results are unreliable. |

## Consequences

- A new renderer is a new provider; the Markdown engine does not change. The SDK guide shows a custom provider.
- Server SVG is deterministic for Blueprint (tested: `renders Blueprint to deterministic SVG`). Graphviz and Kroki output depend on their versions.
- Mermaid pages need JavaScript in the viewer's browser. Static SVG for Mermaid needs headless Chromium (`markupme diagram -o`, optional `playwright`).
- Diagram theming today is the `theme` value passed to providers and Mermaid's light/dark switch; providers may ignore it.
- PNG export is not built. SVG only.
