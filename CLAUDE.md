# CLAUDE.md — Lyvoo

Authoritative guide for Claude Code sessions on this repo. Reverse-engineered from the code, not a template. Keep it accurate: if you change an architectural fact, update this file.

---

## 1. Project Overview

- **Lyvoo** is a personalised **preventive-health** service: at-home blood collection → lab analysis → integrated medical report + nutrition plan → 6-monthly reassessment.
- **This repo is the public website + the Firebase backend that powers it.** It is a **static site** (no build step) plus serverless Cloud Functions, Firestore, Auth and Stripe.
- **Bilingual**: Portuguese is canonical (repo root), English is a 1:1 mirror under `en/`.
- **Users**: prospective customers (marketing pages), authenticated clients (dashboard), and admins (admin panel).
- **Current phase**: **pre-launch** — pricing and login are hidden and CTAs point to a waitlist (see `prelaunch.js`, §4).

---

## 2. Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Plain **HTML + CSS + vanilla JS**. **No framework, no bundler, no build.** Inline `<style>`/`<script>` per page. |
| Fonts | **Inter** (Google Fonts), weights 300–900 |
| Backend | **Firebase**: Auth, Firestore, Cloud Functions (gen 2, **Node 22**, region `europe-west1`) |
| Functions deps | `firebase-admin` ^13, `firebase-functions` ^7, `stripe` ^16 |
| Payments | **Stripe** (Checkout + webhook) |
| Bot/abuse | **Firebase App Check** (reCAPTCHA v3, **enforced** in prod) |
| Email (contact/waitlist) | **EmailJS** (client-side) |
| Hosting | **GitHub Pages** at `lyvoo.pt` (apex via `CNAME`, `.nojekyll`) |
| Firebase project | `lyvoo-9d54b` (see `.firebaserc`) |
| CI/CD | **GitHub Actions** (`.github/workflows/firebase-deploy.yml`) — backend only |
| Tooling | ESLint 9 (flat config), Prettier 3, `@firebase/rules-unit-testing`, `firebase-functions-test` |

There is **no** Next.js/React/TypeScript/Tailwind/Prisma/Supabase. Don't introduce them.

---

## 3. Project Structure

```
/                      PT pages (canonical) — index, login, registar, dashboard, admin,
                       contacto, ciencia, como-funciona, equipa, privacidade, termos, 404
/en/                   EN mirror — index, login, register, dashboard?, contact, science,
                       how-it-works, team, privacy, terms, 404  (filenames differ per lang)
/modulos/              PT add-on test pages (14): genetica, microbioma, vitaminas, …
/en/modulos/           EN mirror of the 14 module pages
/images/               logo.png, og-image.png, como-funciona-1.png, plano-nutricional.jpg
/functions/            Cloud Functions (index.js), its own package.json + tests
/test/                 firestore.rules.test.mjs (security-rules tests)
/.github/workflows/    firebase-deploy.yml (validate + manual-approval deploy)

Shared client scripts (loaded via <script src> on most pages):
  lyvoo-firebase.js    Firebase init (App, Auth, Firestore, App Check). Imported ONLY by
                       authenticated pages: login, registar/register, dashboard, admin,
                       contacto/contact (8 pages).
  prelaunch.js         Pre-launch kill-switch (see §4). Loaded on ~48 pages.
  mobile-nav.js        Injects hamburger + mobile menu on SECONDARY pages from <ul.nav-links>.
                       index.html / en/index.html have their OWN dedicated mobile menu and
                       do NOT rely on this.
  mobile-nav.css       Styles for the injected mobile menu.
  scroll-top.js        "Back to top" button (appears after 400px scroll).
  cookie-banner.js     Consent banner; exposes window.LyvooCookies.abrirDefinicoes().

Config / ops:
  firebase.json, .firebaserc, firestore.rules, firestore.indexes.json
  package.json (root: test/lint tooling), functions/package.json (runtime deps)
  eslint.config.js, .prettierrc.json, .prettierignore
  sitemap.xml, robots.txt, CNAME, .nojekyll
  README.md (architecture), ROADMAP.md (production roadmap)
  sync-check.py         Dev helper: diffs PT index.html vs en/index.html sections.
  set-admin-claims.js + serviceAccountkey.json  → GITIGNORED, local-only admin scripts.
                        Never commit; never assume they're in the repo.
```

There is **no `/components`, `/lib`, `/hooks`, `/styles`, `/utils`** — this is intentional. Each HTML page is self-contained with inline CSS/JS.

---

## 4. Architecture

### Routing
- **File-based**: every page is a real `.html` file. URLs map 1:1 to files. No router.
- Language switch = link to the sibling file (`index.html` ↔ `en/index.html`). Filenames are localised (`registar.html` ↔ `en/register.html`, `como-funciona.html` ↔ `en/how-it-works.html`).
- In-page sections use anchors (`index.html#atlas`, `#faq`, `#planos`, `#equipa`).

### Client/server boundary
- **Marketing pages** (index, módulos, como-funciona, ciencia, etc.) are pure static — no Firebase.
- **Authenticated pages** (login, registar, dashboard, admin, contacto) import `lyvoo-firebase.js` (Firebase ES-module SDK 10.12.2 from gstatic CDN) and talk to Firestore/Auth/Functions directly from the browser, gated by **Firestore security rules + App Check**.
- **Stripe** Checkout `client_reference_id` = Firebase `uid`; the `stripeWebhook` function advances the user state server-side.

### State management
- **No state library.** Client state = DOM + Firestore live reads. The dashboard renders from `users/{uid}` and subcollections.

### Cloud Functions (`functions/index.js`, all `europe-west1`, Node 22)
| Function | Trigger | Purpose |
|---|---|---|
| `stripeWebhook` | onRequest (HTTP) | Verify Stripe HMAC, advance `estado` 1→2 in an atomic txn; errors → `webhookErrors/`. Secrets via `defineSecret` (GCP Secret Manager). |
| `syncBusySlots` | onDocumentWritten `agendamentosNutri/{agId}` | Maintain PII-free `busySlots/{data}` mirror. |
| `backfillBusySlots` | onCall (admin) | One-time rebuild of `busySlots/`. |
| `assignClienteId` | onDocumentCreated `users/{uid}` | Sequential `clienteId` (C0001…) via atomic `counters/users`. |
| `eliminarUtilizadorRGPD` | onCall (admin) | Cascading GDPR delete + audit log `eliminacoesRGPD/`. Refuses to delete admins. |

### Firestore data model (key collections)
- `users/{uid}` — profile + `estado` (1–7) + `clienteId` + subcollection `analises/`. **Sensitive fields are field-locked** (estado, plano, stripeSessionId, planoValidoAte, cicloAtual, clienteId, seq, arquivado) — clients cannot self-escalate.
- `chats/{uid}` (+ `mensagens/`), `agendamentosNutri/{agId}` (PII; owner/admin only), `busySlots/{data}` (PII-free public mirror), `waitlist`, `counters/users`, `webhookErrors`, `eliminacoesRGPD/{uid}`.

### User lifecycle (`estado` 1–7)
1 Sem plano · 2 Kit a caminho · 3 Laboratório a processar · 4 Resultados disponíveis · 5–7 = reassessment mirror of 2–4. Only **1→2 is automatic** (Stripe webhook); the rest are manual in `admin.html`.

### Authentication
- Firebase Auth. **Google sign-in uses `signInWithPopup`** (not redirect) on desktop AND mobile — GitHub Pages can't serve the redirect handler.
- **Admin = custom claim `{admin:true}` only** (no email fallback). Set locally via the gitignored `set-admin-claims.js`.

---

## 5. UI & Design System

**Design tokens are duplicated inline in each page's `:root`.** Always reuse these exact values:

```css
--teal:#0B525A  --teal-light:#0D7A87  --cyan:#3DD9E8  --violet:#8B5CF6  --purple:#9B6FD4
--bg:#FFFFFF  --surface:#F6F8F9  --border:#E3E8EA
--ink:#0B1215  --ink-2:#3A4A50  --ink-3:#7A8F96
/* redesigned pages also add: --dark:#070B0D  --dark-2:#0B0A18 */
```

- **Signature gradient** (use for accents/`.grad-text`): `linear-gradient(120deg, var(--cyan) 0%, var(--violet) 55%, var(--purple) 100%)`, clipped to text.
- **Typography**: Inter. Headings heavy (800–850), tight letter-spacing (≈ -0.04em), `clamp()` for fluid sizing. Body 14–17px, line-height ~1.7.
- **Layering / "moments of pause"**: alternate **dark sections** (radial cyan/violet glows on near-black) with **light sections** (`#fff` / `--surface`). Status colours: success `#4ADE80`, warning `#FBBF24`, danger `#EF4444`.
- **Visual language**: glassmorphism (translucent fills + `backdrop-filter: blur`), large soft shadows, inline **SVG** for charts/rings/illustrations, score rings, longitudinal line charts. Premium/Apple-WHOOP feel — **subtle** motion, not flashy.
- **Animation**: scroll-reveal via a per-page `IntersectionObserver` toggling `.fade` → `.fade.in` (+ `.fade-d1/d2/d3` stagger). **Always honour `@media (prefers-reduced-motion: reduce)`.**
- **Responsive**: mobile-first matters. Breakpoints in use: **960 / 860 / 768 / 760 / 680 / 600 / 560 / 640**. Index mobile uses **swipeable carousels** (CSS `scroll-snap` + IntersectionObserver for dots/slide-in); secondary pages collapse nav links into the injected hamburger.
- **Icons**: inline stroke SVGs (Feather-style), `stroke-width` ~1.8–2.4.

---

## 6. Coding Standards

- **HTML/CSS/JS are NOT linted or formatted by tooling** (`.prettierignore` excludes `*.html`; ESLint only covers `functions` + `test`). Match the surrounding file's existing style by hand.
- **Each page owns its CSS/JS inline.** There is no global stylesheet. The two `index.html` files use a denser/semi-minified inline style; secondary pages use readable multi-line CSS — follow whichever the file you're editing already uses.
- **PT is the source of truth.** Make a change in the PT file first, then mirror it byte-for-byte (translated) into the EN sibling. Use `python sync-check.py` to diff index sections.
- **CSS classes are page-scoped by convention** via prefixes: `ba-*` (biomarker atlas), `bm-*` (decision engine), `yr-*` (longitudinal timeline), `glp-*` (GLP section), `cmp-*` (problem comparison), `mod-*` (modules carousel), `tst-*` (testimonials), `cf-*`/`hw-*` (how-it-works), `lf-*` (light footer), `hc-*`/`app-*` (hero/app mockups). Reuse the right prefix; don't invent collisions.
- **Functions code** (`functions/`, `test/`): CommonJS, ESLint flat config, Prettier (`singleQuote`, `printWidth:100`, `trailingComma:es5`). `no-unused-vars` warns; prefix intentional unused with `_`.
- **Security headers**: every HTML page carries a `Content-Security-Policy` + `Referrer-Policy` meta. When adding a new external origin (script/font/connect/frame), you MUST extend the CSP allowlist or it breaks silently. Google popup auth needs `https://*.google.com` (not just `www.`) in `script-src`/`frame-src`, and `https://*.firebaseapp.com` in `frame-src`.

---

## 7. Development Workflow

```bash
# Root tooling (Firestore-rules tests, lint, format) — needs Node 22 + Java 21+
npm ci                  # root dev deps
npm run test:rules      # 16 rules tests via Firestore emulator
npm run lint            # eslint functions test
npm run format          # prettier --check functions test

# Cloud Functions
cd functions && npm ci
node --check functions/index.js                              # syntax
firebase emulators:exec --only firestore,auth \
  "node --test functions/test/functions.test.js"             # 10 functions tests
```

- **Frontend has no dev server / build / test.** To preview, open the HTML directly or use the Claude Preview MCP. There are **no automated frontend tests** — verify UI changes visually (desktop + mobile, PT + EN) and check the console for errors.
- **Deploy**:
  - **Frontend** → push to `master`; **GitHub Pages auto-serves** `lyvoo.pt` (~1–2 min). No pipeline.
  - **Backend** (rules/indexes/functions) → push triggers `firebase-deploy.yml`: `validate` always runs; `deploy` runs **only after manual approval** (GitHub Environment `production`). 26 tests total (16 rules + 10 functions).
- **Total**: there is no staging environment; `master` = production for both layers.

---

## 8. Environment Variables / Secrets

- **No `.env` and no client-side env injection** (static site). The Firebase web config in `lyvoo-firebase.js` is public by design (apiKey etc. are not secrets; security is enforced by rules + App Check).
- **Server secrets** live in **GCP Secret Manager**, referenced in functions via `defineSecret`:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- **App Check debug token** (local dev only): `localStorage.APPCHECK_DEBUG_TOKEN` = a UUID registered in Firebase Console → App Check → Manage debug tokens. Never hardcode it (file is served publicly).
- **CI**: `FIREBASE_SERVICE_ACCOUNT` (GitHub Actions secret) holds the deploy SA JSON.
- Gitignored & local-only: `serviceAccountkey.json`, `set-admin-claims.js`, `.env*`, any `*firebase-adminsdk*.json` / `serviceAccount*.json`.

---

## 9. Key Dependencies (why)

- `firebase-functions` / `firebase-admin` — Cloud Functions runtime + privileged Firestore/Auth access.
- `stripe` — webhook signature verification + Checkout.
- `@firebase/rules-unit-testing` — emulator tests proving the security model (field-lock, admin-only, PII isolation).
- `firebase-functions-test` — unit-testing the functions.
- ESLint + `eslint-config-prettier` + `globals` + Prettier — quality gate for the **backend** code only.
- Root `firebase` / `firebase-admin` devDeps exist for tests + the local admin script; keep them.
- **No runtime npm deps ship to the browser** — the static site loads the Firebase SDK from the gstatic CDN as ES modules.

---

## 10. Known Technical Debt

- **Massive inline-CSS duplication** across ~50 HTML files: design tokens, nav, footer, `.fade` reveal, and the whole mobile menu pattern are copy-pasted per page. A change to shared chrome must be repeated everywhere (PT + EN). This is the single biggest debt; a shared CSS/partials system was deliberately deferred (see ROADMAP.md, items F1/F3).
- **PT/EN drift risk**: two copies of every page must be hand-synced. `sync-check.py` only covers the index pages.
- **`index.html` / `en/index.html` are very large** (~200–230 KB each) single files with semi-minified CSS — slow to edit, easy to corrupt. Edit with exact-match, verify brace balance after CSS removals.
- **Dead-CSS accumulation**: removed sections leave orphan inline rules behind. Periodically prune (done Jun 2026; a small intertwined set remains — see git history).
- ROADMAP.md tracks deferred structural/DX items (F1, F3, C1, C2, P2, P3) explicitly parked post-launch — not user-facing.

---

## 11. Performance Notes

- Render-blocking **inline CSS** on the two big index pages is the main weight; keep dead CSS out.
- Scroll work uses **IntersectionObserver** (not scroll listeners) and `scroll-top.js` uses a passive scroll listener — keep that pattern; don't add heavy scroll handlers.
- Carousels use CSS `scroll-snap` + observers (GPU-friendly). `will-change` is used sparingly on animated cards — don't over-apply.
- Firebase SDK loads from CDN (cached across pages). Don't bundle it.
- No image optimisation pipeline; only 4 raster assets in `/images`. Prefer inline SVG for new visuals (crisp, themeable, no extra request).

---

## 12. Future Development Guidelines (project-specific rules)

1. **Static-first**: never add a framework, bundler, or build step. New pages = new self-contained `.html`.
2. **PT canonical → mirror to EN**: every visible change ships in both languages, in the same commit. Localised filenames; keep `hreflang`/`canonical`/lang-toggle links correct.
3. **Reuse the design tokens and signature gradient verbatim.** Match the existing class-prefix for the section you touch; don't invent parallel systems.
4. **Respect the prelaunch kill-switch**: don't hardcode prices or expose login/registration flows in a way that bypasses `prelaunch.js`. Structured pricing must use `.hero-price-wrap`/`.sp-price-wrap` and program prices must read `€NNN/ano|year` so the masker catches them. (`.hero-price-wrap` is referenced by `prelaunch.js` — never delete it as "unused".)
5. **CSP discipline**: adding any external origin requires updating the page's CSP meta, or it fails silently.
6. **Honour the security model**: never relax Firestore field-locks; admin = custom claim only; keep `agendamentosNutri` PII owner/admin-only with the `busySlots` mirror for public reads.
7. **Accessibility/motion**: keep `prefers-reduced-motion` handling, focus-visible outlines, `aria-*` on toggles, and the injected mobile menu working.
8. **Mobile-first**: verify every change at ≤600px; index uses swipe carousels, secondary pages use the hamburger.
9. **Verify, don't assume**: there are no frontend tests — preview visually (desktop+mobile, PT+EN) and check the console before claiming done.
10. **Don't commit secrets** or the gitignored admin scripts. Backend changes go through the CI approval gate.
11. **Standing workflow preference**: after a coherent unit of edits, **commit AND push automatically** (separate `lyvoo` git repo, branch `master` → `origin/master`) — don't ask each time.

---

## 13. Project Context & Key Journeys

- **What it does**: turns an at-home finger-prick blood sample into an integrated, doctor-interpreted report and a personalised nutrition/supplementation plan, re-measured every 6 months to prove progress.
- **Marketing journey** (static): hero → "O problema" → biomarker atlas (`#atlas`) → optional modules → "Como funciona" → science → longitudinal value → plans → FAQ → contact/waitlist.
- **Customer journey** (authenticated): register → Stripe checkout (`client_reference_id`=uid) → webhook sets `estado=2` → kit/lab states advanced by admin → results unlocked at `estado` 4/7 → dashboard (results, plan, chat, nutrition booking) → 6-month reassessment.
- **Admin journey**: `admin.html` (custom-claim gated) manages client `estado`, results, bookings, and GDPR deletion.
- **Business-critical logic**: Stripe webhook idempotency (`estado > 1` guard), atomic `clienteId` counter, field-locked user docs, PII isolation (`agendamentosNutri` vs `busySlots`), GDPR cascade delete with audit trail.

---

## Reference docs in-repo
- `README.md` — architecture deep-dive (data model, Stripe flow, security, CI/CD).
- `ROADMAP.md` — production roadmap and explicitly deferred debt.
- Session memory: `C:\Users\AGENT47\.claude\projects\E--Claude\memory\` (auth/App Check, prelaunch pricing, mobile testing, dashboard i18n).
