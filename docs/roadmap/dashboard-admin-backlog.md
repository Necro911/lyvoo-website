# Dashboard ↔ Admin Implementation Backlog

Extracted from `docs/audits/2026-07-01-dashboard-admin-holistic-review.md` (§4–§8 of that audit). This file is the **living** one — update status/checkboxes here as work lands. Do not edit the source audit; if scope changes materially enough to need a new audit, add a new dated file under `docs/audits/` and re-derive this backlog.

**Legend** — Effort: Small · Medium · Large | Risk: Low · Medium · High | Value: Low · Medium · High · Critical

Execute **top to bottom, one at a time**, same convention as the root `ROADMAP.md`.

---

## Tier 0 — Security

| ☐ | ID | Task | Effort | Risk | Value | Depends on | Files |
|---|----|------|--------|------|-------|------------|-------|
| ☑ | DA-22 | **Field-lock `resultados`, `planoAlimentar`, `suplementacao`, and `relatorio` on `users/{uid}`.** Discovered 2026-07-01 while adding the `prioridades` lock for DA-05: these four clinical-content fields were not in `ownerKeepsLockedFields()`, and `validProfileFields()` only validates specific known profile fields without rejecting unlisted ones — a client could `updateDoc` directly and fabricate their own lab results, nutrition plan, supplements, or medical report. **Done 2026-07-01**: added all four keys to `ownerKeepsLockedFields()`'s `hasAny([...])` list; added a matching `assertFails` test (all four fields) in `test/firestore.rules.test.mjs`. **Verified no legitimate client write path exists**: audited every `updateDoc`/`setDoc` call against `users/{uid}` in `dashboard.html` (12 call sites) — none touch these four fields; the one client-side `setDoc` (profile save) uses `merge:true` and only writes profile fields, so this lock cannot break any existing dashboard flow. **Not verified against the rules emulator** (needs Java 21+, unavailable in this sandbox) — run `npm run test:rules` before this deploys. Noted in passing: `renderSupplementos()` in `dashboard.html:5211` interpolates `suplementacao[].razao` into `innerHTML` unescaped (unlike `escapeHtml()` used for the new DA-08 priorities text) — low real-world risk now that this field is locked to admin-only writes (self-XSS surface closes), but worth a follow-up cleanup for defense in depth. | Small | Medium | Critical | — | `firestore.rules`, `test/firestore.rules.test.mjs` |

---

## Tier 1 — Pure wins (no new UI surface, reuse existing computed signals)

| ☐ | ID | Task | Effort | Risk | Value | Depends on | Files |
|---|----|------|--------|------|-------|------------|-------|
| ☑ | DA-01 | Auto-compute biomarker `delta` from `users/{uid}/analises/` history at admin save time, instead of clinician typing it. Diff current value vs. most recent snapshot for the same biomarker `nome`. Keep a manual-override toggle. **Done 2026-07-01**: `openUser` now parallel-fetches the latest `analises/` doc into `currentPrevBiomarcadores`; empty `delta` fields auto-fill on load via `autoFillDeltas()`, and each row got a `↻` button (`recalcDeltaRow`) to recompute or override at any time. No data-model change — `delta` stays a plain string, unchanged on save. | Small | Low | Critical | — | `admin.html` |
| ☑ | DA-02 | Persist health score into each `analises/{id}` snapshot at save time (mirror dashboard's `computeBioScore` server/admin-side, or store the client-computed read-back). This is the prerequisite for any score trend UI. **Done 2026-07-01**: `admin.html` now carries a faithful port of dashboard.html's scoring pipeline (`parseRefRange`→`autoTag`, `BODY_TAG_SCORE`, gender-aware `pickRef`) as `computeHealthScore()`, run on `saveBiomarcadores()` and written as `score` on the `analises/{id}` snapshot. Unit-verified against hand-checked sample data (4-tier ranges, manual tag override, no-value exclusion, empty-biomarker null case). | Small | Low | High | — | `admin.html`, `dashboard.html` |
| ☑ | DA-03 | Health Score hero redesign: previous score, delta arrow + %, one-line auto-generated interpretation, confidence note ("baseado em N de M marcadores") using already-computed `scored.length`. **Done 2026-07-01**: `renderScore()` now takes the previous `analises/` snapshot, shows a trend line (↑/↓ + delta, color-coded), a one-line interpretation naming the biggest-moving biomarker system (`biggestCategoryMover`), a confidence note (`computeScoreConfidence`), and a "first analysis" fallback when no history exists. Falls back to computing the previous score live from `biomarcadores` for pre-DA-02 history entries that lack a stored `score`. i18n keys added PT+EN. Visually verified via DOMParser injection (no live auth in this environment). | Medium | Low | High | DA-02 | `dashboard.html` |
| ☑ | DA-04 | Biomarcadores section: add "N improved / N worsened / N stable" roll-up card above the list/card view, computed from the now-automatic deltas. **Done 2026-07-01**: implemented as `biomarkerRollup()`, comparing each biomarker's clinical tag (not raw value sign — a decrease isn't always an improvement, e.g. LDL vs. HDL) against the same-named marker in the previous `analises/` snapshot via the shared `BODY_TAG_SCORE` ranking. Wired into both `renderBiomarcadores()` view modes and the historical-test selector. Unit-verified against hand-checked sample data. | Small | Low | Medium | DA-01 | `dashboard.html` |

## Tier 2 — Weekly Priorities (the one genuinely new feature)

| ☐ | ID | Task | Effort | Risk | Value | Depends on | Files |
|---|----|------|--------|------|-------|------------|-------|
| ☑ | DA-05 | Data model: add `prioridades[]` (array to start; see DA-11 for subcollection migration) with fields `categoria`, `prioridade`, `texto`, `followUpData`, `metaValor`, `automatizado`, `visivelCliente`. **Done 2026-07-01**: field reserved and locked in `firestore.rules` (`ownerKeepsLockedFields()` now includes `prioridades` — clients cannot self-author priorities), matching rules test added in `test/firestore.rules.test.mjs`, shape documented in `README.md`'s data model table. Scoped intentionally narrow — no admin/dashboard UI yet (that's DA-07/DA-08). **Not verified locally**: the rules emulator test suite needs Java 21+, unavailable in this environment; verify with `npm run test:rules` before merging. **Also found while in this file**: `resultados`, `planoAlimentar`, `suplementacao`, and `relatorio` are NOT in the locked-fields list today, meaning a client can currently forge their own lab results/nutrition plan/supplements/report via `updateDoc` — flagged as a separate security item, not fixed here (out of DA-05's scope, needs its own review). | Medium | Low | High | DA-01, DA-02 | `firestore.rules`, `test/firestore.rules.test.mjs`, `README.md` |
| ☑ | DA-06 | Rule engine: auto-suggest priority items from existing data — `tag=critico` → "Repita este marcador em 6 semanas"; `tag=atencao` matched against nutrition keywords → dietary suggestion. Reuse the existing `INSIGHT_DEFS`/keyword-matching pattern already built for meal tags (`dashboard.html:4857-4873`). **Done 2026-07-01**: `suggestPriorities(biomarcadores, genero)` in `admin.html`, built on the DA-02 scoring port (`scoreAutoTag`, `scorePickRef`) plus a ported `PRIORITY_INSIGHT_DEFS` (mirrors dashboard.html's `INSIGHT_DEFS` keyword regexes). Returns candidate objects in the exact DA-05 `prioridades[]` shape, all `automatizado:true`. **Deliberately writes nothing and has no UI yet** — it's a pure function ready for DA-07 to call, review, and persist; wiring it up is DA-07's job, not this item's. Unit-verified against sample data (critico → retest, atencao+keyword-match → nutrition suggestion, no-value and no-match rows correctly excluded). | Medium | Low | High | DA-05 | `admin.html` |
| ☑ | DA-07 | Admin: new "Prioridades" tab where clinician reviews rule-suggested cards (accept/edit/dismiss) and adds manual ones. Without this, Weekly Priorities has no clinical judgment behind the automation. **Done 2026-07-01**: new tab between Biomarcadores and Plano alimentar, following the exact card-editor pattern already used for Suplementação. "🔎 Gerar sugestões" button calls `suggestPriorities()` (DA-06) against the biomarker table's *current* state (even unsaved), dedupes against existing card text, and appends editable cards — auto-generated ones get an "Automático" badge. Manual "+ Adicionar" available too. Saves via the existing generic `saveDoc()`/`clinicalConfirm()` plumbing to the DA-05 `prioridades[]` field — wired into `TAB_TS_KEYS`, `TAB_SAVE_FN`, `CLINICAL_SAVE_FN`, and `doSwitchTab`'s tab-order array. Visually verified via DOMParser injection (no live auth in this environment). | Medium | Medium | High | DA-05, DA-06 | `admin.html` |
| ☑ | DA-08 | Dashboard: "As Suas Prioridades Esta Semana" section rendering `prioridades[]`, icon by `categoria`, one-line action text. **Done 2026-07-01**: new panel on Painel home, between the score/progress row and the feature cards. `renderPrioridadesSemana()` filters to `visivelCliente !== false`, sorts by `prioridade` (alta→baixa), renders a category icon + text + optional "Até {data}" follow-up date, and hides the whole panel when there's nothing to show. Admin-authored `texto` passed through the existing `escapeHtml()` helper before interpolation (defense in depth) — verified via an injected `<script>` test that it renders as inert text. Visually verified via DOMParser injection. | Medium | Low | High | DA-05 | `dashboard.html` |

## Tier 3 — Admin efficiency (clinician time savings)

| ☐ | ID | Task | Effort | Risk | Value | Depends on | Files |
|---|----|------|--------|------|-------|------------|-------|
| ☑ | DA-09 | Reference-range template library: save a named biomarker panel (e.g. "Painel Metabólico Standard") once, apply to any client, override per-client only where needed. **Done 2026-07-01**: new `biomarkerTemplates/{id}` collection (admin-only read/write, with a matching rules test), a "Modelos de referência" section in the admin Biomarcadores tab, `guardarModeloBiomarcadores()` (saves current ref-ranges — filtered to rows that actually have at least one range filled — as a named template) and `aplicarModeloBiomarcadores()` (finds-or-creates rows by name, updates only unidade/reference-range fields, never touches an existing row's valor/tag/delta/destaque). Filter predicate unit-tested; UI visually verified via DOMParser injection. Not verified against the rules emulator locally (needs Java 21+). | Medium | Low | Medium | — | `admin.html`, `firestore.rules`, `test/firestore.rules.test.mjs` |
| ☑ | DA-10 | Supplement↔biomarker linkage: change `suplementacao[].razao` from plain textarea to textarea + optional biomarker-name picker sourced from that client's current `resultados.biomarcadores` keys. **Done 2026-07-01**: added `biomarcadorRelacionado` field to the supplement schema, populated via a `<select>` sourced from `extractBiomarkerNames(d.resultados?.biomarcadores)` (computed once per client load, cached in `currentBiomarkerNames`). Visually verified via DOMParser injection. | Small | Low | Medium | — | `admin.html` |
| ☑ | DA-11 | Bulk cohort state-transition action — e.g. "advance all `estado=4` clients with `planoValidoAte` >6 months old to `estado=5`" as one confirmed batch action instead of per-client card clicks. **Done 2026-07-01, scoped narrower than the original example**: rather than an opaque "auto-detect who's overdue" algorithm (which risked being clinically wrong — there's no single reliable "how overdue" field), implemented admin-selected bulk action: checkboxes per client row (persisted across filter/re-renders via `selectedUids`), "Selecionar todos os filtrados"/"Limpar seleção", and a bulk bar with "Avançar p/ reavaliação". Reuses the *exact* per-client transition logic (`aplicarEfeitosDeTransicao`) already used by the single-client button — no duplicated business logic. Filters selection to only estado 4/7 clients (results-ready), reports ineligible ones, confirms with names before executing, reports per-client failures after. Operates on the currently loaded/filtered page (consistent with existing pagination), not a separate whole-collection query. Visually verified via DOMParser injection. | Medium | Medium | Medium | — | `admin.html` |
| ☑ | DA-12 | Consultation slot-suggestion shortcuts — "propose next 3 available Tue/Thu 10am–12pm slots" instead of manual month-grid click-through. **Done 2026-07-01, simplified from the day-of-week example**: a "Hora sugerida" time input + "⚡ Sugerir próximos 3 dias úteis" button fills the next 3 weekdays (skipping weekends, skipping days already picked) at the chosen time directly into the existing `_conviteSlots` state, re-rendering the same calendar/hour-chip UI the admin would've clicked through manually — fully reviewable/editable before sending, not auto-sent. Does not check `busySlots` for conflicts (the admin calendar didn't do this before either — no regression, but noted as a gap). Weekday-selection logic unit-tested (start-of-week rollover, respecting already-selected days). | Small | Low | Low-Medium | — | `admin.html` |
| ☑ | DA-13 | Surface `emailFalhouEm` failures (already written, `admin.html:2833`) as a visible admin alert list instead of requiring the clinician to notice per-client. **Done 2026-07-01**: added as a 4th category in the existing cross-client Inbox mechanism (alongside consultation confirmations/cancellations/kit returns) — new `onSnapshot(where('emailFalhouEm','!=',null))` listener, filtered client-side to `!notificadoEm`, counted in the inbox badge, rendered as a red-icon item linking to the client's Geral tab. No new UI pattern introduced, reuses the established Inbox. Visually verified via DOMParser injection. | Small | Low | Medium | — | `admin.html` |

## Tier 5 — From the 2026 vision gap analysis

Source: `docs/audits/2026-07-01-2026-vision-gap-analysis.md`. Two further items from that vision (adherence check-in interaction design, extending DA-18; wearable/Apple Health integration) are **not** listed here — they need a product decision from Ricardo before they're scoped as backlog items. See that audit's Part 4.

| ☐ | ID | Task | Effort | Risk | Value | Depends on | Files |
|---|----|------|--------|------|-------|------------|-------|
| ☐ | DA-19 | "Próximo teste em N dias" countdown + waiting-period narrative on Painel home, using the already-existing `planoValidoAte` field. Reframes the wait between blood draws as anticipation instead of dead air — no new data required. | Small | Low | Medium | — | `dashboard.html` |
| ☐ | DA-20 | Module home-page previews: no-click summaries of nutrition/supplements/biomarkers directly on Painel, instead of requiring a full section navigation switch to see anything. | Small | Low | Medium | — | `dashboard.html` |
| ☐ | DA-21 | Per-biomarker `interpretacao` free-text field (physician-authored, plain-language) added to the admin biomarker row and surfaced in the dashboard biomarker detail view — currently only a 3-value tag exists, no explanatory text per marker. | Small-Medium | Low | Medium | — | `admin.html`, `dashboard.html` |

## Tier 4 — Structural / deferred (scale-driven, not urgent)

| ☐ | ID | Task | Effort | Risk | Value | Depends on | Files |
|---|----|------|--------|------|-------|------------|-------|
| ☐ | DA-14 | Migrate `prioridades[]` from an array on `users/{uid}` to a dedicated subcollection once volume/independent-timestamp needs justify it (unbounded growth across cycles, unlike bounded `biomarcadores`/`suplementacao`). | Medium | Medium | Deferred | DA-05 | `firestore.rules`, `admin.html`, `dashboard.html` |
| ☐ | DA-15 | Add `clinicoAtribuido` (assigned clinician) field + `firestore.rules` scoping, only when a 2nd clinician/admin is hired. Cheap to add now, but no immediate value at current single-admin scale. | Small | Low | Deferred | — | `firestore.rules`, `admin.html` |
| ☐ | DA-16 | `visivelCliente: boolean` explicit flag on `anamnese`/internal notes to formally enforce (not just by convention) that admin-only fields never leak into `dashboard.html` reads. | Small | Low | Low | — | `firestore.rules` |
| ☐ | DA-17 | `metaValor`/target field per biomarker, surfaced in the dashboard biomarker detail view ("you're at X, target is Y") — natural extension of DA-04's evolution storytelling. | Small | Low | Medium | DA-05 (shares `prioridades` schema conventions) | `admin.html`, `dashboard.html` |
| ☐ | DA-18 | `adesao` (adherence) signal — let the client mark supplement/plan items as "following" and let the clinician see it. Currently a one-way broadcast with no feedback loop. | Medium | Low | Medium | — | `admin.html`, `dashboard.html`, `firestore.rules` |

---

## Execution order (recommended)

```
☑ DA-01  Auto-delta                    → kills daily manual typing (done 2026-07-01)
☑ DA-02  Persist score history         → unlocks all trend UI (done 2026-07-01)
☑ DA-03  Health Score hero             → visible win #1 (done 2026-07-01)
☑ DA-04  Biomarker roll-up card        → visible win #2 (done 2026-07-01)
☐ DA-05  prioridades[] data model      → foundation for Weekly Priorities
☐ DA-06  Rule engine for suggestions   → automation core
☐ DA-07  Admin "Prioridades" tab       → clinician control surface
☑ DA-08  Dashboard Weekly Priorities   → user-facing payoff (done 2026-07-01)
☑ DA-09  Reference-range templates     → biggest remaining manual-typing win (done 2026-07-01)
☑ DA-10  Supplement↔biomarker link     → small, low-risk (done 2026-07-01)
☑ DA-13  Surface emailFalhouEm alerts  → cheap, prevents silent failures (done 2026-07-01)
☑ DA-11  Bulk cohort transitions       → matters once cohort size grows (done 2026-07-01)
☑ DA-12  Consultation slot shortcuts   → nice-to-have (done 2026-07-01)
☐ DA-19  "Next test in N days" countdown → reframes the wait, no new data
☐ DA-20  Module home previews          → visible win, no new data
☐ DA-17  metaValor/target per marker   → extends DA-04 storytelling
☐ DA-21  Per-biomarker interpretation  → physician-voice depth, small effort
☐ DA-18  Adherence signal              → closes the feedback loop
☐ DA-14  prioridades → subcollection   → deferred until volume justifies it
☐ DA-15  clinicoAtribuido              → deferred until 2nd clinician hired
☐ DA-16  visivelCliente flag           → deferred, low urgency
```
