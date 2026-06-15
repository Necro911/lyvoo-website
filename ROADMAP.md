# Lyvoo — Roadmap de produção

Plano de implementação ordenado por ROI a partir da auditoria de produção (Jun 2026).
Executar **um item de cada vez**, de cima para baixo. Marcar `[x]` quando concluído.

**Legenda** — Dificuldade: Trivial · Fácil · Média · Difícil · | Tempo: estimativa de dev ·
Risco: prob. de partir produção · Benefício: Baixo · Médio · Alto · Crítico

> A Tier 1 (Segurança) e parte da Tier 2 foram concluídas em Jun 2026 — ficam marcadas `[x]`
> para registo. Ver detalhes em `memory/lyvoo-auth-appcheck.md`.

---

## Próximos 3 (maior ROI)

1. **C3** — ESLint/Prettier
2. **D6** — Consistência de fuso/datas dos agendamentos
3. **F3** — Header/footer partilhados (ver nota de risco abaixo)

> ✅ B1 (Node 22), P1 (paginação), D4 (perfil), B3 (webhook), F4 (SEO), S7 (CSP),
> B2 (CI/CD ativo), D5 (eliminação RGPD em cascata), P4 (lazy-load) e F2
> (a11y — lang toggle + menu mobile) concluídos a 15-Jun-2026.
>
> ⚠️ **F3 (header/footer partilhados)** — adiado: o nav tem JS acoplado ao DOM
> (scroll/`on-light`/menu mobile) e o footer tem anchors específicas da página
> (`#equipa`, `index.html#planos`). Extrair via fetch+injeção exigiria
> reordenar scripts em 48 ficheiros e validar cada página — fazer como tarefa
> dedicada (fase 1: só footer), não de seguida a outra tarefa.
> ✅ **Testes** no CI (`validate`): **16 de regras** (`@firebase/rules-unit-testing`)
> + **10 de functions** (webhook Stripe assinado/idempotente/400, cascata RGPD,
> `assignClienteId` sequencial/idempotente, `syncBusySlots` criar/cancelar/apagar
> slot), via `firebase-functions-test` + emuladores firestore/auth. **26 testes
> no total**, todos verdes no CI.

---

## 1. 🔴 Segurança

| ☑ | ID | Tarefa | Dif. | Tempo | Risco | Benefício | Ficheiros |
|---|----|--------|------|-------|-------|-----------|-----------|
| x | S1 | Field-lock `users/{uid}` (anti auto-escalação de pagamento) | Média | — | — | Crítico | `firestore.rules` |
| x | S2 | PII de `agendamentosNutri` → owner/admin + espelho `busySlots` | Difícil | — | — | Alto | `firestore.rules`, `functions/index.js`, `dashboard.html` |
| x | S3 | Validação da `waitlist` (removido `update:if true`) | Fácil | — | — | Médio | `firestore.rules` |
| x | S4 | Webhook Stripe atómico (idempotente) | Média | — | — | Alto | `functions/index.js` |
| x | S5 | Admin por custom-claims-only (sem fallback de email) | Fácil | — | — | Médio | `firestore.rules`, `functions/index.js`, `admin.html`, `login.html` |
| x | S6 | App Check Enforced (reCAPTCHA v3 nova) | Média | — | — | Alto | `lyvoo-firebase.js` |
| x | S7 | CSP + Referrer-Policy via `<meta>` nas 44 páginas — done 15-Jun (testado no preview: Firebase/AppCheck/fontes/EmailJS ok). Headers-only (X-Frame-Options/Permissions-Policy/CSP report-only) p/ quando houver CDN à frente | Média | — | Médio | Médio | todas as `*.html` |
| ☐ | S8 | Fixar versão do Firebase SDK / avaliar SRI ou self-host | Fácil | 2h | Baixo | Baixo | `lyvoo-firebase.js`, `*.html` |

## 2. 🟠 Integridade de dados

| ☑ | ID | Tarefa | Dif. | Tempo | Risco | Benefício | Ficheiros |
|---|----|--------|------|-------|-------|-----------|-----------|
| x | D1 | Idempotência do pagamento (transação) | — | — | — | Alto | `functions/index.js` |
| x | D2/D3 | Consistência `busySlots` via trigger + backfill | — | — | — | Médio | `functions/index.js` |
| x | D4 | Validar tipos/tamanhos dos campos do perfil nas regras — done 15-Jun | Fácil | — | — | Médio | `firestore.rules` |
| x | D5 | Eliminação RGPD em cascata via Cloud Function (admin-only) + auditoria — done 15-Jun (validado em dados sintéticos) | Média | — | Médio | Médio | `functions/index.js`, `admin.html`, `firestore.rules` |
| ☐ | D6 | Consistência de fuso/datas dos agendamentos + edge cases | Fácil | 2h | Baixo | Baixo | `dashboard.html`, `functions/index.js` |

## 3. 🏗️ Arquitetura de backend

| ☑ | ID | Tarefa | Dif. | Tempo | Risco | Benefício | Ficheiros |
|---|----|--------|------|-------|-------|-----------|-----------|
| x | B1 | Upgrade Node 20→22 + firebase-functions 7 / admin 13 — deployed em `nodejs22` (15-Jun) | Média | — | — | Alto | `functions/package.json` |
| x | B2 | CI/CD — GitHub Action (valida sempre + deploy com aprovação). Ativo: secret + environment `production` configurados 15-Jun | Média | — | Baixo | Médio | `.github/workflows/firebase-deploy.yml` |
| x | B3 | Logs estruturados + webhookErrors + alerta — done 15-Jun | Fácil | — | — | Médio | `functions/index.js`, `firestore.rules` |
| ☐ | B4 | Min-instances/região p/ cold-start do webhook (se necessário) | Fácil | 1-2h | Baixo | Baixo | `functions/index.js` |

## 4. ⚡ Performance

| ☑ | ID | Tarefa | Dif. | Tempo | Risco | Benefício | Ficheiros |
|---|----|--------|------|-------|-------|-----------|-----------|
| x | P1 | Paginação + clienteId persistente (CF) + stats por agregação — done 15-Jun | Média | — | — | Alto | `admin.html`, `functions/index.js`, `firestore.rules`, `firestore.indexes.json` |
| ☐ | P2 | Pipeline de build/minify (HTML/CSS/JS) | Média | 1d | Médio | Médio | repo + tooling |
| ☐ | P3 | Bundle/tree-shake do Firebase SDK | Média | 4-6h | Médio | Médio | `lyvoo-firebase.js`, `*.html` |
| x | P4 | Lazy-load das imagens abaixo do fold (`footer-logo`, `plano-nutricional.jpg`) — done 15-Jun. Logos do nav (above-the-fold) ficam eager de propósito. Conversão p/ formatos modernos (webp/avif) não feita — sem ferramenta de imagem disponível no ambiente | Fácil | — | — | Médio | `*.html`, `en/*.html`, `modulos/*.html`, `en/modulos/*.html` |
| ☐ | P5 | Reduzir CSS/JS render-blocking (defer, critical CSS) | Fácil | 2-3h | Baixo | Baixo | `*.html` |

## 5. 🎨 Frontend

| ☑ | ID | Tarefa | Dif. | Tempo | Risco | Benefício | Ficheiros |
|---|----|--------|------|-------|-------|-----------|-----------|
| ☐ | F1 | Resolver duplicação PT/EN com templating/build | Difícil | 2-3d | Médio | Médio | `*.html` + `en/*.html` + tooling |
| x | F2 | Acessibilidade WCAG — done 15-Jun (parcial): toggle de idioma `PT/EN` deixou de ser link morto `href="#"` (agora `<span aria-current="page">` + `aria-label` descritivo no idioma alternativo); botão de menu mobile com `aria-expanded`/`aria-controls` sincronizados. Labels/alt/lang/focus-visible já estavam OK na auditoria. Pendente: `<main>`/skip-link (estrutural, melhor junto com F3) | Média | — | Baixo | Médio | `*.html`, `en/*.html`, `modulos/*.html`, `en/modulos/*.html` |
| ☐ | F3 | Extrair header/footer/nav partilhados | Média | 4-6h | Baixo | Médio | `*.html` |
| x | F4 | SEO — canonical + hreflang (PT↔EN) + JSON-LD nas 8 páginas principais — done 15-Jun (OG/sitemap/robots já existiam; falta hreflang nos /modulos) | Fácil | — | — | Médio | `*.html`, `en/*.html` |
| ☐ | F5 | Polir UX de formulários (validação inline) | Fácil | 2-3h | Baixo | Baixo | `contacto.html`, `registar.html` |

## 6. 🧹 Limpeza de código

| ☑ | ID | Tarefa | Dif. | Tempo | Risco | Benefício | Ficheiros |
|---|----|--------|------|-------|-------|-----------|-----------|
| x | C0 | `.gitignore` robusto + remover scratch + reconciliar preço | — | — | — | Baixo | `.gitignore` |
| ☐ | C1 | Extrair JS/CSS inline para ficheiros próprios | Média | 1d | Médio | Médio | `*.html` |
| ☐ | C2 | Remover código morto + consolidar duplicação (depende de F1/F3) | Média | 4-6h | Baixo | Baixo | `*.html` |
| ☐ | C3 | Setup ESLint + Prettier (e lint nas functions) | Fácil | 2-3h | Baixo | Médio | repo, `functions/` |
| ☐ | C4 | Documentar arquitetura (estados 1-7, fluxo Stripe, coleções) | Fácil | 2-3h | Baixo | Médio | `README.md`/`CLAUDE.md` |

---

## Ordem de execução (one-at-a-time)

```
☑ B1  Node 22 + libs            → FEITO (nodejs22, 15-Jun)
☑ P1  Paginar loadUsers         → FEITO (paginação + clienteId + stats agregadas, 15-Jun)
☑ D4  Validar campos perfil     → FEITO (15-Jun)
☑ B3  Logs/alerta webhook       → FEITO (15-Jun)
☑ F4  SEO básico                → FEITO (canonical+hreflang+JSON-LD, 15-Jun)
☑ B2  CI/CD deploy              → FEITO (workflow + setup GitHub, 15-Jun)
☑ S7  CSP + headers             → FEITO (CSP meta nas 44 páginas, testado, 15-Jun)
☐ C3  ESLint/Prettier           → qualidade contínua
☑ D5  Eliminação RGPD auto      → FEITO (cascata + auditoria, 15-Jun)
☐ P4/P5 imagens + render        → velocidade percebida
☐ F2  Acessibilidade            → inclusão + SEO
☐ F3  Header/footer partilhado  → base para F1
☐ F1  Templating PT/EN          → mata a dívida estrutural
☐ C1/C2 extrair inline + dead   → arrumação final
☐ P2/P3 build/minify + bundle   → otimização final
☐ C4  Documentação              → onboarding
```
