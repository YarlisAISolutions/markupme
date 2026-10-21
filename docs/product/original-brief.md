/goal i want to create a new project from scratch up using this project as reference -       
inspired from https://github.com/markedjs/marked , and i still see it basic , ensure all       
advanced features are included. Create the cli for the features you have to make it advaned,   
so it is easily transform the markdown files into much better understanding and user intutive  
with best standards and pratices, and ehance it include the diagrams as included -             
https://github.com/YarlisAISolutions/blueprintview , see if we can include various switches as 
needed. And also take inspiration from this repo - https://github.com/markdown-it/markdown-it  
, and ensure to build vscode plugin, so i can release it, think deep and come up with a        
better plan. Here is some research - ehance it on top of this - # MASTER ENGINEERING PROMPT —  
Yarlis MarkForge                                                                               
                                                                                               
## Role and Mission                                                                            
                                                                                               
You are acting as a Principal Software Architect, Staff TypeScript Engineer, Compiler          
Engineer, Security Architect, Product Designer, DevOps Engineer, and Open-Source Maintainer.   
                                                                                               
Your mission is to design and implement **Yarlis MarkForge**, a production-grade,              
open-source-first Markdown processing and document engineering platform.                       
                                                                                               
Reference project:                                                                             
                                                                                               
https://github.com/markedjs/marked                                                             
                                                                                               
Primary objective:                                                                             
                                                                                               
Build a reusable, developer-first platform that combines the strongest capabilities of Marked, 
markdown-it, Remark, Micromark, React Markdown, Milkdown, modern documentation frameworks,     
and extensible developer tooling.                                                              
                                                                                               
Do not merely clone these libraries.                                                           
                                                                                               
Design a cohesive new product with independently valuable functionality, a clean public API,   
interoperability, strong performance, standards compliance, security, extensibility, and a     
polished developer experience.                                                                 
                                                                                               
The product must be suitable for use within multiple Yarlis products as well as by independent 
external developers.                                                                           
                                                                                               
Working product name: **MarkForge**                                                            
                                                                                               
Proposed package namespace: `@yarlis/markforge-*`                                              
                                                                                               
The final package namespace, branding, licensing, and domain must be verified before public    
release.                                                                                       
                                                                                               
---                                                                                            
                                                                                               
# 1. Non-negotiable Engineering Principles                                                     
                                                                                               
1. Open-source-first.                                                                          
2. Cloud-agnostic architecture.                                                                
3. Standards-first Markdown compatibility.                                                     
4. Reuse mature parsing libraries rather than rebuilding CommonMark unnecessarily.             
5. Modular monorepo with independently publishable packages.                                   
6. TypeScript strict mode.                                                                     
7. Secure-by-default HTML rendering.                                                           
8. Explicit, stable, versioned public APIs.                                                    
9. Plugin-driven extensibility.                                                                
10. Headless core with optional UI integrations.                                               
11. No mandatory SaaS dependencies for local Markdown processing.                              
12. Markdown source fidelity wherever supported.                                               
13. Deterministic processing and reproducible builds.                                          
14. Excellent CLI and local developer experience.                                              
15. Accessibility, performance, and observability from the beginning.                          
16. Cprehensive automated testing.                                                             
17. Backward-compatible evolution.                                                             
18. Honest capability claims backed by executable validation.                                  
19. No placeholder implementations represented as complete features.                           
20. No unsupported assumptions about the current repository.                                   
                                                                                               
Avoid unnecessary proprietary infrastructure, vendor-specific coupling, duplicated frameworks, 
excessive dependencies, and unnecessary abstraction.                                           
                                                                                               
---                                                                                            
                                                                                               
# 2. Repository Discovery and Analysis                                                         
                                                                                               
Before implementation:                                                                         
                                                                                               
- Inspect the repository structure.                                                            
- Determine whether this is a new project or existing codebase.                                
- Read README, package manifests, lockfiles, build configurations, architecture documentation, 
CI workflows, and existing tests.                                                              
- Identify reusable code, packages, standards, and naming conventions.                         
- Check dependencies, licenses, maintenance, and compatibility.                                
- Identify conflicting design decisions and document resolutions.                              
- Preserve working functionality if the repository already contains code.                      
                                                                                               
Create:                                                                                        
                                                                                               
`docs/research/competitive-analysis.md`                                                        
                                                                                               
`docs/architecture/architecture-decision-records/`                                             
                                                                                               
`docs/product/PRD.md`                                                                          
                                                                                               
`docs/product/BRD.md`                                                                          
                                                                                               
`docs/product/FRD.md`                                                                          
                                                                                               
`docs/product/NFR.md`                                                                          
                                                                                               
`docs/product/acceptance-criteria.md`                                                          
                                                                                               
`docs/implementation/implementation-plan.md`                                                   
                                                                                               
`docs/implementation/requirements-traceability.md`                                             
                                                                                               
Record requirements, technical decisions, alternatives, trade-offs, risks, dependencies, and   
measurable acceptance criteria.                                                                
                                                                                               
Do not introduce a new architecture without documenting why it is superior to alternatives.    
                                                                                               
---                                                                                            
                                                                                               
# 3. Competitive Research                                                                      
                                                                                               
Study the following projects:                                                                  
                                                                                               
### Parsing and processing                                                                     
                                                                                               
- markedjs/marked                                                                              
- markdown-it/markdown-it                                                                      
- remarkjs/remark                                                                              
- micromark/micromark                                                                          
- commonmark/commonmark.js                                                                     
- showdownjs/showdown                                                                          
- TanStack/markdown                                                                            
                                                                                               
### Editing                                                                                    
                                                                                               
- Milkdown/milkdown                                                                            
- ueberdosis/tiptap                                                                            
- ProseMirror                                                                                  
- CodeMirror 6                                                                                 
- facebook/lexical                                                                             
- MDXEditor                                                                                    
                                                                                               
### Rendering and documentation                                                                
                                                                                               
- remarkjs/react-markdown                                                                      
- MDX                                                                                          
- Docusaurus                                                                                   
- VitePress                                                                                    
- Nextra                                                                                       
- Astro Starlight                                                                              
                                                                                               
### Documentation conversion and diagrams                                                      
                                                                                               
- Pandoc                                                                                       
- Mermaid                                                                                      
- PlantUML                                                                                     
- Structurizr DSL                                                                              
- Shiki                                                                                        
- Prettier                                                                                     
- markdownlint                                                                                 
                                                                                               
For each competitor, investigate:                                                              
                                                                                               
- Architecture                                                                                 
- Programming model                                                                            
- Core capabilities                                                                            
- Plugin mechanisms                                                                            
- Public API design                                                                            
- Standards compliance                                                                         
- Browser compatibility                                                                        
- Runtime compatibility                                                                        
- Bundle size                                                                                  
- Performance                                                                                  
- Security model                                                                               
- Licensing                                                                                    
- Maintenance signals                                                                          
- Known constraints                                                                            
- Community ecosystem                                                                          
- Reusable design concepts                                                                     
                                                                                               
Produce a comparison matrix and feature-gap analysis.                                          
                                                                                               
Differentiate verified capabilities from assumptions and proposed enhancements.                
                                                                                               
Never copy proprietary code or misrepresent third-party licenses.                              
                                                                                               
---                                                                                            
                                                                                               
# 4. Product Modules                                                                           
                                                                                               
Design MarkForge as a collection of separate packages and applications.                        
                                                                                               
## Module A — Markdown Processing Engine                                                       
                                                                                               
Implement:                                                                                     
                                                                                               
- CommonMark-compatible parsing                                                                
- GitHub Flavored Markdown                                                                     
- Headings                                                                                     
- Paragraphs                                                                                   
- Blockquotes                                                                                  
- Nested lists                                                                                 
- Ordered/unordered lists                                                                      
- Task lists                                                                                   
- Fenced code blocks                                                                           
- Indented code blocks                                                                         
- Tables                                                                                       
- Links                                                                                        
- Images                                                                                       
- Autolinks                                                                                    
- Footnotes                                                                                    
- Strikethrough                                                                                
- Escaping                                                                                     
- Unicode support                                                                              
- Frontmatter through optional adapters                                                        
- Custom directives                                                                            
- Custom containers                                                                            
- GitHub-style alerts where enabled                                                            
- Heading IDs and configurable anchors                                                         
- Table of contents generation                                                                 
- Syntax diagnostics                                                                           
- Source position tracking                                                                     
- Streaming-friendly interfaces where feasible                                                 
                                                                                               
Use Remark/Unified/Micromark as the initial parsing foundation.                                
                                                                                               
Develop adapters rather than creating another CommonMark parser without compelling evidence.   
                                                                                               
Allow custom syntax through a controlled extension API.                                        
                                                                                               
## Module B — Canonical Document Model                                                         
                                                                                               
Create a normalized document representation.                                                   
                                                                                               
Requirements:                                                                                  
                                                                                               
- AST interoperability with mdast and unist                                                    
- Typed nodes                                                                                  
- Source locations                                                                             
- Stable semantic IDs where practical                                                          
- Metadata                                                                                     
- Document schema version                                                                      
- Typed custom extensions                                                                      
- Visitor APIs                                                                                 
- Traversal utilities                                                                          
- Node queries                                                                                 
- AST serialization                                                                            
- Transformations                                                                              
- Diffing                                                                                      
- Structural validation                                                                        
- Error diagnostics                                                                            
- Source maps where supported                                                                  
                                                                                               
Distinguish the canonical Markdown source, parsed AST, and editor-specific internal models.    
                                                                                               
Implement source-preserving transformations where possible.                                    
                                                                                               
When exact preservation is impossible, report the limitation and provide normalized            
serialization.                                                                                 
                                                                                               
Never silently discard unsupported constructs.                                                 
                                                                                               
## Module C — Rendering Engine                                                                 
                                                                                               
Support independent rendering adapters for:                                                    
                                                                                               
1. HTML                                                                                        
2. React                                                                                       
3. Plain text                                                                                  
4. JSON AST                                                                                    
5. Markdown                                                                                    
6. PDF                                                                                         
7. DOCX                                                                                        
8. MDX where safely supported                                                                  
9. Static documentation pages                                                                  
                                                                                               
Start with Markdown, HTML, React, and AST.                                                     
                                                                                               
Treat PDF/DOCX export as later-stage capabilities with separately tested adapters.             
                                                                                               
Provide:                                                                                       
                                                                                               
- Configurable themes                                                                          
- Custom renderers                                                                             
- Syntax highlighting                                                                          
- Code-copy controls                                                                           
- Line numbers                                                                                 
- Table rendering                                                                              
- Heading anchors                                                                              
- Responsive images                                                                            
- Link validation                                                                              
- Asset resolution                                                                             
- Accessibility semantics                                                                      
- Print-friendly styling                                                                       
- Dark/light mode                                                                              
- Server-side rendering                                                                        
- Client-side rendering                                                                        
                                                                                               
Rendering must support untrusted content safely.                                               
                                                                                               
MDX execution must be disabled for untrusted documents unless explicitly enabled in an         
appropriately isolated trust boundary.                                                         
                                                                                               
## Module D — Editing Experience                                                               
                                                                                               
Create a browser-based Markdown studio.                                                        
                                                                                               
Required editing modes:                                                                        
                                                                                               
- Source editor                                                                                
- Live preview                                                                                 
- Split-pane editor                                                                            
- Rich-text editor adapter                                                                     
- Read-only viewer                                                                             
                                                                                               
Use CodeMirror 6 for source editing.                                                           
                                                                                               
Evaluate Milkdown and Tiptap against explicit acceptance criteria before selecting a rich-text 
implementation.                                                                                
                                                                                               
Capabilities:                                                                                  
                                                                                               
- Syntax highlighting                                                                          
- Autocomplete                                                                                 
- Keyboard shortcuts                                                                           
- Find/replace                                                                                 
- Undo/redo                                                                                    
- Drag/drop                                                                                    
- Clipboard support                                                                            
- Image insertion                                                                              
- Table editing                                                                                
- Code blocks                                                                                  
- Headings and outlines                                                                        
- Keyboard navigation                                                                          
- Command palette                                                                              
- Document navigation                                                                          
- Focus mode                                                                                   
- Distraction-free editing                                                                     
- Responsive layouts                                                                           
- Accessible interactions                                                                      
- Local autosave                                                                               
- Export                                                                                       
- Import                                                                                       
- Preview synchronization                                                                      
                                                                                               
Support editor plugins and configurable toolbar commands.                                      
                                                                                               
Avoid forcing editor-specific data formats onto the processing core.                           
                                                                                               
## Module E — Diagram Integration                                                              
                                                                                               
Integrate diagrams as first-class document nodes or typed extensions.                          
                                                                                               
Support adapters for:                                                                          
                                                                                               
- Mermaid                                                                                      
- Flowcharts                                                                                   
- Sequence diagrams                                                                            
- State diagrams                                                                               
- Class diagrams                                                                               
- Entity-relationship diagrams                                                                 
- Gantt charts                                                                                 
- Architecture diagrams                                                                        
- C4 diagrams                                                                                  
- Structurizr DSL                                                                              
- PlantUML                                                                                     
- Graphviz/DOT                                                                                 
                                                                                               
Do not implement every diagram grammar from scratch.                                           
                                                                                               
Use upstream tools through adapters with explicit licensing, operational, and security         
boundaries.                                                                                    
                                                                                               
Features:                                                                                      
                                                                                               
- Syntax-aware code blocks                                                                     
- Live diagram preview                                                                         
- Diagram error reporting                                                                      
- Export to SVG/PNG where supported                                                            
- Deterministic rendering where possible                                                       
- Diagram caching                                                                              
- Source preservation                                                                          
- Diagram theming                                                                              
- CLI integration                                                                              
- Safe rendering isolation                                                                     
- Pluggable backend execution                                                                  
                                                                                               
Define a diagram-provider interface so future proprietary or custom renderers can be           
substituted without changes to the Markdown engine.                                            
                                                                                               
## Module F — Developer SDK                                                                    
                                                                                               
Publish independently consumable packages.                                                     
                                                                                               
Target APIs:                                                                                   
                                                                                               
```typescript                                                                                  
import {                                                                                       
  createProcessor,                                                                             
  parse,                                                                                       
  render,                                                                                      
  transform,                                                                                   
  serialize,                                                                                   
  validate,                                                                                    
} from "@yarlis/markforge-core";                                                               
                                                                                               
const doc = parse("# Hello MarkForge");                                                        
                                                                                               
const html = await render(doc, {                                                               
  format: "html",                                                                              
  sanitize: true,                                                                              
});                                                                                            
                                                                                               
const result = await transform(doc, {                                                          
  plugins: ["toc", "heading-anchors"],                                                         
});                                                                                            
                                                                                               
const output = serialize(result.document, {                                                    
  format: "markdown",                                                                          
});                                                                                            
```                                                                                            
                                                                                               
Treat these as proposed interface examples; refine final signatures through tests and API      
reviews.                                                                                       
                                                                                               
Support:                                                                                       
                                                                                               
- ESM                                                                                          
- TypeScript declarations                                                                      
- Tree shaking                                                                                 
- Browser use                                                                                  
- Node.js                                                                                      
- Bun                                                                                          
- Clearly documented runtime limitations                                                       
- Stable error contracts                                                                       
- Optional async processing                                                                    
- Plugin composition                                                                           
                                                                                               
Avoid global mutable plugin registration.                                                      
                                                                                               
Support isolated processor instances.                                                          
                                                                                               
## Module G — Command Line Interface                                                           
                                                                                               
});                                                                                            
```                                                                                            
                                                                                               
Treat these as proposed interface examples; refine final signatures through tests and API      
reviews.                                                                                       
                                                                                               
Support:                                                                                       
                                                                                               
- ESM                                                                                          
- TypeScript declarations                                                                      
- Tree shaking                                                                                 
- Browser use                                                                                  
- Node.js                                                                                      
- Bun                                                                                          
- Clearly documented runtime limitations                                                       
- Stable error contracts                                                                       
- Optional async processing                                                                    
- Plugin composition                                                                           
                                                                                               
Avoid global mutable plugin registration.                                                      
                                                                                               
Support isolated processor instances.                                                          
                                                                                               
## Module G — Command Line Interface                                                           
                                                                                               
Create:                                                                                        
                                                                                               
`markforge`                                                                                    
                                                                                               
CLI commands:                                                                                  
                                                                                               
```bash                                                                                        
markforge init                                                                                 
markforge parse README.md                                                                      
markforge render README.md --format html                                                       
markforge render README.md --format pdf                                                        
markforge render README.md --format docx                                                       
markforge render README.md --format ast                   