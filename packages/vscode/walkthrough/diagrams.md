# Diagrams as code

Write a fenced block and the preview draws it:

````markdown
```mermaid
flowchart LR
  Write --> Preview --> Share
```
````

| Fence | Renderer | Where it runs |
| --- | --- | --- |
| `mermaid` | Mermaid | in the preview |
| `dot`, `graphviz` | Graphviz | in VS Code, to SVG |
| `ybp`, `blueprint` | Yarlis Blueprint | in VS Code, to SVG |

Snippets: type `mermaid`, `dot` or `ybp`. No CDN and no account. Kroki (PlantUML, C4, D2 and more) is opt-in with `markupme.diagrams.server`.
