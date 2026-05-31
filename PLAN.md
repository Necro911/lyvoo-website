# Lyvoo Website — Plano de produto

## Visão
Website de conversão para a Lyvoo — healthtech portuguesa de prevenção personalizada.
Objetivo: converter visitantes em subscritores dos planos Essencial (€320/ano) ou Completo (€640/ano).

---

## Estrutura de página (implementada)

```
1. Navbar            — logo + links + CTA "Começar agora"
2. Hero              — dark, rings SVG, subheading, 2 CTAs
3. Trust bar         — 5 selos de confiança
4. Processo (intro)  — "Perceber. Agir. Medir."
5. Step 1            — Kit em casa (off-white)
6. Step 2            — Atlas de biomarcadores (dark, interativo)
7. Step 3            — Relatório médico integrado (white)
8. Step 4            — Plano nutricional (off-white + imagem real)
9. Step 5            — Reavaliação 6 meses (dark + gráfico)
10. App section      — dark, 2 phone mockups, 4 features
11. Porquê a Lyvoo   — white, stats + 4 pilares
12. Testemunhos      — dark, 1 feature + 4 cards
13. Planos           — off-white, Essencial + Completo
14. Módulos          — white, 9 add-ons
15. FAQ              — off-white, 8 perguntas acordeão
16. CTA final        — dark, prova social
17. Footer           — muito dark, logo + links
```

---

## Planos e preços

| Plano | Preço | Posição |
|-------|-------|---------|
| Lyvoo Essencial | €320/ano | Entry / Aquisição |
| Lyvoo Completo | €640/ano | Hero plan / Margem |

### Módulos add-on
| Módulo | Status preço |
|--------|-------------|
| Genética / Nutrigenética | Oculto (só "Saber mais") |
| Microbioma | Oculto |
| Hormonal Feminino | Oculto |
| Hormonal Masculino | Oculto |
| Energia & Fadiga | Oculto |
| Tiroide Expandida | Oculto |
| Consulta médica extra | Oculto |
| Consulta nutrição extra | Oculto |
| Vitamina D upgrade | Oculto |

---

## Decisões de produto tomadas
- Pagamento **anual único** (sem mensal)
- Preços dos módulos **ocultos** no website
- Testemunhos são **placeholders** — substituir por reais antes do lançamento
- FAQ de **8 perguntas** cobre as principais objeções de compra
- Logo oficial usado em header (46px) e footer (64px)
- Navbar mantém-se **dark** em scroll (não muda para branco)

---

## Comparação com concorrentes

| Feature | Lyvoo ✅ | Function Health | Syphox |
|---------|----------|-----------------|--------|
| Kit em casa | ✅ | ❌ (lab físico) | ✅ |
| Supervisor médico | ✅ | ✅ | ? |
| App | ✅ | ✅ | ✅ |
| Reavaliação 6 meses | ✅ | ✅ (2x/ano) | ? |
| Atlas biomarcadores | ✅ 44 params | ✅ 160+ | ? |
| Testemunhos reais | ⚠️ placeholder | ✅ | ? |
| Equipa médica visível | ⚠️ falta | ✅ | ? |
| FAQ | ✅ | ✅ | ? |
| Ancoragem de preço | ⚠️ falta | ✅ | ? |

---

## Stack técnica
- HTML5 + CSS3 + JavaScript vanilla (sem dependências)
- Fonts: Inter (Google Fonts)
- Servidor local: Python http.server :3456
- Ficheiro único: `index.html` (~144KB)
- Assets: `images/logo.png`, `images/plano-nutricional.jpg`
