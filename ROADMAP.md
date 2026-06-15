# Lyvoo — Roadmap de produção

Plano de implementação ordenado por ROI a partir da auditoria de produção (Jun 2026).
Executar **um item de cada vez**, de cima para baixo. Marcar `[x]` quando concluído.

**Legenda** — Dificuldade: Trivial · Fácil · Média · Difícil · | Tempo: estimativa de dev ·
Risco: prob. de partir produção · Benefício: Baixo · Médio · Alto · Crítico

> A Tier 1 (Segurança) e parte da Tier 2 foram concluídas em Jun 2026 — ficam marcadas `[x]`
> para registo. Ver detalhes em `memory/lyvoo-auth-appcheck.md`.

---

## Próximos 3 (maior ROI)

1. **P1** — Paginar `loadUsers()` no admin
2. **D4** — Validar campos do perfil nas regras
3. **B3** — Logs estruturados + alerta de falha no webhook Stripe

> ✅ B1 concluído a 15-Jun-2026 (functions em `nodejs22`).

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
| ☐ | S7 | CSP + headers de segurança (via `<meta http-equiv>`) | Média | 3-5h | Médio | Médio | todas as `*.html` |
| ☐ | S8 | Fixar versão do Firebase SDK / avaliar SRI ou self-host | Fácil | 2h | Baixo | Baixo | `lyvoo-firebase.js`, `*.html` |

## 2. 🟠 Integridade de dados

| ☑ | ID | Tarefa | Dif. | Tempo | Risco | Benefício | Ficheiros |
|---|----|--------|------|-------|-------|-----------|-----------|
| x | D1 | Idempotência do pagamento (transação) | — | — | — | Alto | `functions/index.js` |
| x | D2/D3 | Consistência `busySlots` via trigger + backfill | — | — | — | Médio | `functions/index.js` |
| ☐ | D4 | Validar tipos/tamanhos dos campos editáveis do perfil nas regras | Fácil | 2-3h | Baixo | Médio | `firestore.rules` |
| ☐ | D5 | Automatizar eliminação RGPD (hoje manual) | Média | 4-6h | Médio | Médio | `functions/index.js`, `dashboard.html`, `firestore.rules` |
| ☐ | D6 | Consistência de fuso/datas dos agendamentos + edge cases | Fácil | 2h | Baixo | Baixo | `dashboard.html`, `functions/index.js` |

## 3. 🏗️ Arquitetura de backend

| ☑ | ID | Tarefa | Dif. | Tempo | Risco | Benefício | Ficheiros |
|---|----|--------|------|-------|-------|-----------|-----------|
| x | B1 | Upgrade Node 20→22 + firebase-functions 7 / admin 13 — deployed em `nodejs22` (15-Jun) | Média | — | — | Alto | `functions/package.json` |
| ☐ | B2 | CI/CD — GitHub Action para deploy de rules/functions | Média | 4-6h | Baixo | Médio | `.github/workflows/`, `firebase.json` |
| ☐ | B3 | Observabilidade — logs estruturados + alerta de falha no webhook | Fácil | 2-3h | Baixo | Médio | `functions/index.js` |
| ☐ | B4 | Min-instances/região p/ cold-start do webhook (se necessário) | Fácil | 1-2h | Baixo | Baixo | `functions/index.js` |

## 4. ⚡ Performance

| ☑ | ID | Tarefa | Dif. | Tempo | Risco | Benefício | Ficheiros |
|---|----|--------|------|-------|-------|-----------|-----------|
| ☐ | P1 | Paginar/limitar `loadUsers()` (hoje sem limite) | Média | 3-5h | Baixo | Alto | `admin.html` |
| ☐ | P2 | Pipeline de build/minify (HTML/CSS/JS) | Média | 1d | Médio | Médio | repo + tooling |
| ☐ | P3 | Bundle/tree-shake do Firebase SDK | Média | 4-6h | Médio | Médio | `lyvoo-firebase.js`, `*.html` |
| ☐ | P4 | Otimizar imagens (formatos modernos, lazy-load) | Fácil | 2-4h | Baixo | Médio | `assets/`, `*.html` |
| ☐ | P5 | Reduzir CSS/JS render-blocking (defer, critical CSS) | Fácil | 2-3h | Baixo | Baixo | `*.html` |

## 5. 🎨 Frontend

| ☑ | ID | Tarefa | Dif. | Tempo | Risco | Benefício | Ficheiros |
|---|----|--------|------|-------|-------|-----------|-----------|
| ☐ | F1 | Resolver duplicação PT/EN com templating/build | Difícil | 2-3d | Médio | Médio | `*.html` + `en/*.html` + tooling |
| ☐ | F2 | Acessibilidade WCAG (aria, foco, teclado) | Média | 1d | Baixo | Médio | `*.html` |
| ☐ | F3 | Extrair header/footer/nav partilhados | Média | 4-6h | Baixo | Médio | `*.html` |
| ☐ | F4 | SEO — meta tags, Open Graph, JSON-LD, sitemap | Fácil | 3-4h | Baixo | Médio | `*.html`, `sitemap.xml` |
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
☐ P1  Paginar loadUsers         → escala do admin
☐ D4  Validar campos perfil     → fecha o flanco do field-lock
☐ B3  Logs/alerta webhook       → visibilidade de pagamentos
☐ F4  SEO básico                → ROI de lançamento
☐ B2  CI/CD deploy              → segurança operacional
☐ S7  CSP + headers             → hardening extra
☐ C3  ESLint/Prettier           → qualidade contínua
☐ D5  Eliminação RGPD auto      → compliance
☐ P4/P5 imagens + render        → velocidade percebida
☐ F2  Acessibilidade            → inclusão + SEO
☐ F3  Header/footer partilhado  → base para F1
☐ F1  Templating PT/EN          → mata a dívida estrutural
☐ C1/C2 extrair inline + dead   → arrumação final
☐ P2/P3 build/minify + bundle   → otimização final
☐ C4  Documentação              → onboarding
```
