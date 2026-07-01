# Dashboard ↔ Admin Implementation Backlog

Extracted from `docs/audits/2026-07-01-dashboard-admin-holistic-review.md` (§4–§8 of that audit). This file is the **living** one — update status/checkboxes here as work lands. Do not edit the source audit; if scope changes materially enough to need a new audit, add a new dated file under `docs/audits/` and re-derive this backlog.

**Legend** — Effort: Small · Medium · Large | Risk: Low · Medium · High | Value: Low · Medium · High · Critical

Execute **top to bottom, one at a time**, same convention as the root `ROADMAP.md`.

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
| ☐ | DA-05 | Data model: add `prioridades[]` (array to start; see DA-11 for subcollection migration) with fields `categoria`, `prioridade`, `texto`, `followUpData`, `metaValor`, `automatizado`, `visivelCliente`. | Medium | Low | High | DA-01, DA-02 | `firestore.rules`, `admin.html`, `dashboard.html` |
| ☐ | DA-06 | Rule engine: auto-suggest priority items from existing data — `tag=critico` → "Repita este marcador em 6 semanas"; `tag=atencao` matched against nutrition keywords → dietary suggestion. Reuse the existing `INSIGHT_DEFS`/keyword-matching pattern already built for meal tags (`dashboard.html:4857-4873`). | Medium | Low | High | DA-05 | `admin.html` (or shared logic) |
| ☐ | DA-07 | Admin: new "Prioridades" tab where clinician reviews rule-suggested cards (accept/edit/dismiss) and adds manual ones. Without this, Weekly Priorities has no clinical judgment behind the automation. | Medium | Medium | High | DA-05, DA-06 | `admin.html` |
| ☐ | DA-08 | Dashboard: "As Suas Prioridades Esta Semana" section rendering `prioridades[]`, icon by `categoria`, one-line action text. | Medium | Low | High | DA-05 | `dashboard.html` |

## Tier 3 — Admin efficiency (clinician time savings)

| ☐ | ID | Task | Effort | Risk | Value | Depends on | Files |
|---|----|------|--------|------|-------|------------|-------|
| ☐ | DA-09 | Reference-range template library: save a named biomarker panel (e.g. "Painel Metabólico Standard") once, apply to any client, override per-client only where needed. | Medium | Low | Medium | — | `admin.html`, new Firestore collection e.g. `biomarkerTemplates/` |
| ☐ | DA-10 | Supplement↔biomarker linkage: change `suplementacao[].razao` from plain textarea to textarea + optional biomarker-name picker sourced from that client's current `resultados.biomarcadores` keys. | Small | Low | Medium | — | `admin.html` |
| ☐ | DA-11 | Bulk cohort state-transition action — e.g. "advance all `estado=4` clients with `planoValidoAte` >6 months old to `estado=5`" as one confirmed batch action instead of per-client card clicks. | Medium | Medium | Medium | — | `admin.html` |
| ☐ | DA-12 | Consultation slot-suggestion shortcuts — "propose next 3 available Tue/Thu 10am–12pm slots" instead of manual month-grid click-through. | Small | Low | Low-Medium | — | `admin.html` |
| ☐ | DA-13 | Surface `emailFalhouEm` failures (already written, `admin.html:2833`) as a visible admin alert list instead of requiring the clinician to notice per-client. | Small | Low | Medium | — | `admin.html` |

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
☐ DA-08  Dashboard Weekly Priorities   → user-facing payoff
☐ DA-09  Reference-range templates     → biggest remaining manual-typing win
☐ DA-10  Supplement↔biomarker link     → small, low-risk
☐ DA-13  Surface emailFalhouEm alerts  → cheap, prevents silent failures
☐ DA-11  Bulk cohort transitions       → matters once cohort size grows
☐ DA-12  Consultation slot shortcuts   → nice-to-have
☐ DA-19  "Next test in N days" countdown → reframes the wait, no new data
☐ DA-20  Module home previews          → visible win, no new data
☐ DA-17  metaValor/target per marker   → extends DA-04 storytelling
☐ DA-21  Per-biomarker interpretation  → physician-voice depth, small effort
☐ DA-18  Adherence signal              → closes the feedback loop
☐ DA-14  prioridades → subcollection   → deferred until volume justifies it
☐ DA-15  clinicoAtribuido              → deferred until 2nd clinician hired
☐ DA-16  visivelCliente flag           → deferred, low urgency
```
