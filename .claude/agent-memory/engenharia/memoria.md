# Engenharia — Memória

## Projeto: int-03-site-institucional (R.A.F.O institutional landing page)

### Status
- Task 6 (Hero section): DONE
- Task 7 (Services section): DONE (wired into index.astro)
- Task 8 (Differentiator section): DONE
- Total tasks: 17
- Completed: 3 (Logo), 5 (WhatsAppButton), 6 (Hero), 7 (Services), 8 (Differentiator)

### Decisões Técnicas Registradas

**Stack**: Astro + TypeScript + CSS
- All components use `.astro` format
- Component props passed via interface + destructuring pattern
- SVG logos stored inline in components (not external assets)
- WhatsApp button uses absolute URL with international format (wa.me)

**Componentes Reutilizáveis**
- `Logo.astro`: Full and compact variants, dark/light theme support
- `WhatsAppButton.astro`: Accepts `label` prop, opens wa.me link in new tab
- `Hero.astro`: Self-contained, imports Logo + WhatsAppButton, no props
- `Services.astro`: List of services with icons (Task 7, wired to index.astro)
- `Differentiator.astro`: Differentiator message, dark background, centered layout (Task 8)

**Padrões de Layout**
- Hero uses flexbox column, center aligned, semantic `<header>` element
- Responsive typography via CSS `clamp()` for font-size
- Consistent spacing and max-widths for text containers

### Texto Aprovado pelo Marketing (não parafrasear)

**Hero Title** (EXATO):
"Mais visibilidade no Google, atendimento que nunca dorme no WhatsApp, e um site que fecha negócio."

**Hero Subtitle** (EXATO):
"A gente cuida da sua presença online de ponta a ponta: Google Negócio, site e automação de atendimento, tudo sob medida pro seu negócio."

**WhatsApp Button Label** (EXATO):
"Falar no WhatsApp agora"

**Differentiator Text** (EXATO):
"Diferente da maioria, cuidamos da sua presença online como um todo: Google, site e WhatsApp conectados entre si, não serviços soltos que você precisa juntar sozinho."

### Regra de Escrita
Nenhum travessão duplo (--) ou em-dash em nenhum texto. Usar vírgula ou ponto.

### Próximas Tarefas
- Task 12: Integração final de todas as seções na página index.astro
- Outras tarefas 7-11: Componentes intermediários (Carousel, etc.)

### Referências
- Brief: `.superpowers/sdd/task-6-brief.md`
- Report: `.superpowers/sdd/task-6-report.md`
