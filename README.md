# Lyvoo — Arquitetura

> Documentação técnica para programadores. Atualizada em 17-Jun-2026.

---

## Visão geral

O Lyvoo é um serviço de análises de saúde personalizadas. A infraestrutura divide-se em duas camadas:

| Camada | Tecnologia | Hosting |
|--------|------------|---------|
| Frontend (site estático) | HTML + CSS + JS vanilla; Firebase SDK 10.12.2 via ES modules | GitHub Pages (lyvoo.pt) |
| Backend | Firebase Auth, Firestore, Cloud Functions (Node 22), Stripe | Firebase project `lyvoo-9d54b` (região `europe-west1`) |

O frontend não tem processo de build — os ficheiros HTML são servidos diretamente pelo GitHub Pages. O backend (regras Firestore, índices, Cloud Functions) é gerido por um GitHub Actions workflow com aprovação manual antes do deploy.

---

## Estrutura de páginas

### Páginas PT (raiz do repositório)

| Ficheiro | Propósito |
|----------|-----------|
| `index.html` | Landing page principal |
| `login.html` | Autenticação (Google popup) |
| `registar.html` | Registo de novo utilizador |
| `dashboard.html` | Painel do cliente (resultados, plano, consultas) |
| `admin.html` | Painel de administração (gestão de clientes) |
| `contacto.html` | Formulário de contacto (EmailJS) |
| `privacidade.html` | Política de privacidade |
| `termos.html` | Termos e condições |
| `404.html` | Página de erro |

### Espelho EN

`en/` — réplica em inglês das páginas principais: `index.html`, `login.html`, `register.html`, `privacy.html`, `terms.html`, `contact.html`, `404.html`.

### Páginas de módulos

`modulos/` (PT) e `en/modulos/` (EN) — uma página por análise disponível (cardio-avancado, consulta-medica, consulta-nutricao, dst-ist, fertilidade, genetica, hepatite-b, hormonal-feminino, hormonal-masculino, intolerancias-alimentares, microbioma, stress, tiroide-completo, vitaminas).

### Ficheiros-chave

| Ficheiro | Propósito |
|----------|-----------|
| `lyvoo-firebase.js` | Inicialização Firebase (App, Auth, Firestore, App Check); importado por todas as páginas autenticadas |
| `functions/index.js` | Todas as Cloud Functions |
| `firestore.rules` | Regras de segurança Firestore |
| `firestore.indexes.json` | Índices compostos Firestore |
| `.github/workflows/firebase-deploy.yml` | Pipeline CI/CD |
| `test/firestore.rules.test.mjs` | 16 testes de regras Firestore |
| `functions/test/functions.test.js` | 10 testes de Cloud Functions |

---

## Modelo de dados — coleções Firestore

| Coleção | Documento | O que guarda |
|---------|-----------|--------------|
| `users/{uid}` | Um doc por utilizador | Perfil (nome, email, telefone), `estado` (1-7), `estadoLabel`, `clienteId` (C0001…), `seq`, `plano`, `planoValidoAte`, `cicloAtual`, `stripeSessionId`, `arquivado`, timestamps. Contém subcoleção `analises/` (resultados de biomarcadores por ciclo, incluindo `score` desde DA-02). `prioridades` (array, reservado — DA-05): campos `categoria`, `prioridade`, `texto`, `followUpData`, `metaValor`, `automatizado`, `visivelCliente`; bloqueado por field-lock (só admin escreve); UI de edição chega em DA-07, render no dashboard em DA-08. |
| `chats/{uid}` | Um doc por utilizador | Metadados do chat (lido/não lido, timestamp). Contém subcoleção `mensagens/` (cada mensagem do chat entre cliente e admin). |
| `agendamentosNutri/{agId}` | Um doc por marcação | PII: nome, email, `uid`, `data`, `hora`, `tipo` (nutricao / reavaliacao), `estado` (agendada / confirmada / realizada / cancelada), link de videochamada. Legível apenas pelo próprio utilizador e por admins. |
| `busySlots/{data}` | Um doc por data (ex.: `2026-06-17`) | `{ data, horas: [...] }` — espelho sem PII das horas ocupadas; atualizado pelo trigger `syncBusySlots`. Legível por qualquer utilizador autenticado (para mostrar disponibilidade no calendário). |
| `waitlist` | Docs automáticos | Endereços de email submetidos na lista de espera. |
| `counters/users` | Documento único | `{ seq: N }` — contador atómico para atribuição sequencial de `clienteId`. |
| `webhookErrors` | Docs automáticos | Registo durável de erros críticos do webhook Stripe (pagamento sem uid, utilizador inexistente, erro de processamento). Campo `resolvido: false` para reconciliação manual. |
| `eliminacoesRGPD/{uid}` | Um doc por eliminação | Registo de auditoria sem PII: `uid`, `eliminadoEm`, `porAdmin`, `agendamentosApagados`. Não contém dados pessoais — serve como prova de conformidade RGPD. |

---

## Ciclo de vida do utilizador — estados 1-7

O campo `estado` (número) e `estadoLabel` (string) no documento `users/{uid}` definem em que fase do programa o cliente se encontra.

| Estado | Label (exato) | Descrição |
|--------|---------------|-----------|
| 1 | `Sem plano ativo` | Utilizador registado mas ainda não comprou o Plano Base. O painel está bloqueado. |
| 2 | `Kit a caminho` | Pagamento confirmado via Stripe. Kit de recolha enviado. Ciclo inicial em curso. |
| 3 | `Laboratório a processar` | Kit recebido pelo laboratório; análises em processamento. |
| 4 | `Resultados disponíveis` | Relatório e biomarcadores prontos. Admin notifica o cliente por email. |
| 5 | `Reavaliação · Kit a caminho` | Novo ciclo de reavaliação iniciado (6 em 6 meses). Novo kit enviado. Resultados do ciclo anterior mantidos acessíveis. |
| 6 | `Reavaliação · Laboratório a processar` | Kit de reavaliação recebido pelo laboratório. |
| 7 | `Reavaliação · Resultados disponíveis` | Resultados do ciclo de reavaliação prontos. Admin notifica o cliente. |

**Transições automáticas:** apenas 1→2, via Stripe webhook (ver abaixo).  
**Transições manuais:** 2→3→4 e 5→6→7 são feitas pelo admin no `admin.html` (campo "Estado do programa").  
**Reavaliação:** ao iniciar um novo ciclo (botão "Iniciar novo ciclo" no admin), o admin arquiva os resultados do ciclo atual e passa o cliente para o estado 5.  
**Estados de resultados:** 4 e 7 são semanticamente equivalentes — ambos desbloqueiam a vista de resultados no dashboard e enviam notificação ao cliente.

---

## Fluxo de pagamento Stripe

```
Cliente clica "Comprar"
        │
        ▼
Stripe Checkout (session com client_reference_id = uid do Firebase Auth)
        │
        ▼  checkout.session.completed
stripeWebhook (onRequest, europe-west1)
        │
        ├─ Verifica assinatura HMAC (STRIPE_WEBHOOK_SECRET)
        │   └─ Falha → HTTP 400, log ERROR com { alert: 'stripe-webhook' }
        │
        ├─ Verifica client_reference_id
        │   └─ Ausente → webhookErrors/ + HTTP 200 (ok sem uid)
        │
        ├─ Transação atómica Firestore (read → check → write):
        │   ├─ Utilizador não existe → webhookErrors/ + HTTP 200
        │   ├─ estado > 1 (já tinha plano) → ignorado, log INFO, HTTP 200
        │   └─ estado == 1 → atualiza para estado 2 ("Kit a caminho"),
        │                     define stripeSessionId, cicloAtual=1,
        │                     planoValidoAte = +1 ano → HTTP 200
        │
        └─ Erro de processamento → webhookErrors/ + HTTP 500
                                    (Stripe re-tenta automaticamente)
```

**Idempotência:** a transação verifica `estadoAtual > 1` antes de escrever. Reenvios do Stripe para o mesmo evento são ignorados sem efeito colateral.

**Segredos:** `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` armazenados no Secret Manager do GCP, referenciados via `defineSecret`.

---

## Cloud Functions

Todas as funções estão em `functions/index.js`, região `europe-west1`, runtime Node 22.

| Função | Trigger | Propósito |
|--------|---------|-----------|
| `stripeWebhook` | `onRequest` (HTTP público) | Recebe eventos Stripe, verifica assinatura, avança estado 1→2 em transação atómica. Logs estruturados + `webhookErrors/` para erros críticos. |
| `syncBusySlots` | `onDocumentWritten` em `agendamentosNutri/{agId}` | Mantém `busySlots/{data}` sincronizado sempre que uma marcação é criada, alterada ou cancelada. Remove PII do que o cliente pode ler. |
| `backfillBusySlots` | `onCall` (admin only) | Reconstrói `busySlots/` a partir de todos os agendamentos existentes. Usar uma única vez após o primeiro deploy se já existirem marcações. |
| `assignClienteId` | `onDocumentCreated` em `users/{uid}` | Atribui `clienteId` sequencial e persistente (C0001, C0002…) via contador atómico em `counters/users`. Garante `arquivado: false` no doc inicial. |
| `eliminarUtilizadorRGPD` | `onCall` (admin only) | Apaga em cascata: agendamentos → chat + mensagens → perfil + análises → conta Auth. Escreve registo de auditoria sem PII em `eliminacoesRGPD/`. Recusa eliminar contas admin. |

---

## Modelo de segurança

### Field-lock em `users/{uid}`

Os clientes não podem modificar campos sensíveis do próprio documento: `estado`, `estadoLabel`, `stripeSessionId`, `planoValidoAte`, `cicloAtual`, `clienteId`, `seq`, `arquivado`. Impede auto-escalação de pagamento (um cliente não pode escrever `estado: 2` sem pagar).

### Admin por custom claims

O acesso de administrador é concedido exclusivamente via custom claim `{ admin: true }` na conta Firebase Auth. Não existe fallback por email. As regras Firestore e as Cloud Functions verificam `request.auth.token.admin === true`.

### App Check (reCAPTCHA v3)

`lyvoo-firebase.js` inicializa App Check com `ReCaptchaV3Provider`. Em produção (lyvoo.pt), todos os pedidos ao Firestore e Auth requerem token App Check válido.

Em `localhost`/`127.0.0.1`, o SDK usa `FIREBASE_APPCHECK_DEBUG_TOKEN`: primeiro tenta `localStorage.getItem('APPCHECK_DEBUG_TOKEN')`, depois gera um token temporário (`= true`) e imprime-o na consola. Para desenvolvimento estável, fixar um UUID em `localStorage.APPCHECK_DEBUG_TOKEN` e registá-lo na Firebase Console → App Check → Manage debug tokens.

### PII dos agendamentos

`agendamentosNutri/{agId}` só é legível pelo dono (`request.auth.uid == resource.data.uid`) ou por admins. O calendário de disponibilidade usa `busySlots/` (apenas horas, sem PII), mantido automaticamente pelo trigger `syncBusySlots`.

### CSP e headers

Todas as páginas HTML têm meta tags `Content-Security-Policy` e `Referrer-Policy`. A CSP permite ligações apenas às origens necessárias (gstatic, Firebase, reCAPTCHA, EmailJS, CDNs explícitos).

---

## CI/CD

Pipeline em `.github/workflows/firebase-deploy.yml`, ativado em pushes ao `master` ou PRs que toquem em `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `functions/**`, `test/**`, `package.json`.

| Job | Quando corre | O que faz |
|-----|-------------|-----------|
| `validate` | Sempre (push + PR) | Instala dependências; syntax-check; ESLint + Prettier; valida `firestore.indexes.json`; corre 16 testes de regras Firestore (emulador); corre 10 testes de Cloud Functions (emuladores Firestore + Auth). |
| `deploy` | Após `validate` passar, com aprovação manual | Deploy de `firestore.rules`, `firestore.indexes.json` e `functions/` para o projeto `lyvoo-9d54b` via service account CI. |

**26 testes no total:** 16 de regras (`@firebase/rules-unit-testing`) + 10 de functions (`firebase-functions-test` + emuladores).

O frontend (HTML estático) é servido pelo GitHub Pages e não é gerido por este workflow.

---

## Desenvolvimento local

### Pré-requisitos

- Node.js 22
- Java 21+ (exigido pelo emulador do firebase-tools)
- `npm ci` na raiz e em `functions/`

### Comandos

```bash
# Na raiz do repositório

# Testes de regras Firestore (usa emulador Firestore)
npm run test:rules

# Lint (ESLint)
npm run lint

# Verificar formatação (Prettier)
npm run format
```

```bash
# Em functions/ (não tem script "test" autónomo — os testes correm via firebase-tools)
# O CI corre: firebase emulators:exec --only firestore,auth "node --test functions/test/functions.test.js"
```

Para correr **todos os testes** como o CI (regras + functions), usar os comandos do workflow em `.github/workflows/firebase-deploy.yml`.

### Debug de App Check em localhost

```js
// Na consola do browser (antes de carregar a app):
localStorage.setItem('APPCHECK_DEBUG_TOKEN', '<uuid-registado-na-firebase-console>');
```

Sem este passo, o SDK gera um novo token a cada limpeza de storage — registar esse token na Firebase Console → App Check → Manage debug tokens.
