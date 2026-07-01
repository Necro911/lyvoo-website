# 2026 Vision — Ideal Preventive Health Dashboard & Gap Analysis

- **Version**: 1.0
- **Date**: 2026-07-01
- **Scope**: A from-first-principles redesign of the Lyvoo client dashboard, benchmarked against WHOOP, Oura, Apple Health, and Function Health as of a 2026 launch, then compared against the current `dashboard.html`/`admin.html` implementation.
- **Relationship to prior audit**: This builds on and extends `docs/audits/2026-07-01-dashboard-admin-holistic-review.md` — that audit's data-model and backlog findings (DA-01…DA-18 in `docs/roadmap/dashboard-admin-backlog.md`) are treated as given, not re-litigated. This document adds the competitive/first-principles framing and identifies what's genuinely new on top of that backlog.
- **Status**: Point-in-time snapshot. Do not edit after the fact — add a new dated file if the vision changes materially.

---

## Part 1 — First Principles

Strip away brand aesthetics and ask what each category leader is actually solving:

- **WHOOP** solves *"what should I do with my body today"* — a single daily hero number (Recovery), driven by continuous physiological signal, that changes behavior in real time.
- **Oura** solves the same problem with three scores (Readiness/Sleep/Activity) and wins on **plain-language narrative** — it tells you *why*, not just *what*.
- **Apple Health** solves *aggregation and longitudinal memory* — every data source in one timeline, with "Highlights" that surface what changed without you having to look.
- **Function Health** solves *"what's actually wrong with me that I can't feel yet"* — dense biomarker data made legible, physician-reviewed, with quarterly re-tests to prove change over time.

**The insight that matters most for Lyvoo:** three of these four run on *continuous* data (daily wearable signal). Lyvoo, like Function Health, runs on *episodic* data — a blood draw every 6 months. You cannot fake a daily WHOOP-style recovery score from a biomarker panel; trying to would be dishonest UX. **The core design problem for Lyvoo is not "which hero metric to pick" — it's "how does an episodic-data product stay alive and trustworthy in the 179 days between blood draws."** That is the question the current dashboard doesn't answer, and the one this vision is built to solve.

### What transfers from each competitor, and what doesn't

| Lesson | Applies to Lyvoo? | Why |
|---|---|---|
| Single hero score with trend + narrative (WHOOP/Oura) | **Yes, adapted** | Lyvoo already computes a score client-side (`computeBioScore`). It just needs history + narrative — cheap, no new data source needed. |
| Daily behavior nudge loop (WHOOP/Oura) | **Yes, re-scoped** | Can't be biomarker-driven daily (no daily blood data). Must be *plan-adherence*-driven instead — supplement taken, meal plan followed, water goal hit. Genuinely new capability. |
| Continuous physiological trend graphs | **No, not as-is** | Lyvoo has no wearable input. Faking a daily trend line from a static biomarker would mislead. Only justified with a future Apple Health/Google Fit integration — a real option, not required for v1. |
| Longitudinal "Highlights" / anomaly surfacing (Apple Health) | **Yes, directly** | Maps onto biomarker deltas across cycles — Lyvoo already has the raw data (`analises/` subcollection), just not the surfacing. |
| Dense-but-legible biomarker library, physician narrative, quarterly re-test framing (Function Health) | **Yes — Lyvoo's closest sibling** | Lyvoo's biomarker model (4-tier ranges, gender-aware) is already more sophisticated than most direct-to-consumer panels. The gap is entirely presentation and cadence-framing, not data depth. |
| AI chat-based insight advisor (Oura Advisor, WHOOP Coach) | **Defer** | High novelty risk in a clinical context without physician review in the loop; Lyvoo's chat-with-clinician is already the trust-safe equivalent. Premature before the rule-based Weekly Priorities layer (DA-05→DA-08) is proven. |

---

## Part 2 — The Ideal Lyvoo Experience

### Organizing idea: three time horizons, one narrative thread

Instead of 10 flat sidebar sections, the dashboard should answer three questions at three cadences, visually connected as one story:

1. **Right now** — "Am I on track today?" → plan adherence (daily/weekly cadence, behavior-driven, not biomarker-driven)
2. **This cycle** — "What did my last test show, and what am I doing about it?" → Weekly Priorities + active plan (weeks-to-months cadence)
3. **Over time** — "Am I actually getting healthier?" → Health Score trend + biomarker evolution across cycles (6-month cadence)

Today's dashboard only has layer 3 (and even that lacks history). Layers 1 and 2 don't exist yet — that's the biggest gap: a missing time horizon, not a missing widget.

### Home screen, redesigned

```
┌─────────────────────────────────────────────┐
│  HEALTH SCORE — hero                          │
│  82  ↑ +6 since March · "Bom, a melhorar"     │
│  "O seu score subiu principalmente pela        │
│   melhoria no perfil lipídico."                │
│  Confidence: baseado em 11 de 12 marcadores    │
├─────────────────────────────────────────────┤
│  YOUR PRIORITIES THIS WEEK                     │
│  ○ Aumentar fibra (biomarcador: glicose ↑)     │
│  ○ Continuar Vitamina D3                        │
│  ○ Marcar consulta de nutrição                 │
├─────────────────────────────────────────────┤
│  NEXT TEST IN 143 DAYS          [countdown]    │
│  "Enquanto espera: siga o plano, e o próximo    │
│   teste vai mostrar se estas mudanças           │
│   resultaram."                                  │
├─────────────────────────────────────────────┤
│  Plan preview │ Biomarker preview │ Consult    │
│  (no-click summaries, not nav cards)            │
└─────────────────────────────────────────────┘
```

The "next test in N days" countdown is the honest, first-principles answer to the episodic-data problem: instead of pretending to have daily signal, the product is explicit about its own cadence and turns waiting into anticipation rather than dead air.

### Biomarkers, redesigned around evolution

Function Health's best UX idea, adapted: every biomarker card leads with **the story across cycles**, not the current value. "Your LDL: 142 → 118 → 105 over 3 tests. Trending toward optimal." Value-first should invert to trend-first.

### Adherence as the new daily layer

The one genuinely new capability: a lightweight daily/weekly check-in ("Tomou os suplementos hoje?", "Seguiu o plano alimentar esta semana?" — one tap, not a food diary) feeding the `adesao` concept already identified in the prior audit (DA-18). Gives the client a reason to open the app between blood draws, and gives the clinician real adherence signal instead of guessing at the next consultation.

---

## Part 3 — Gap Analysis: Vision vs. Current Implementation

| Vision element | Current state | Gap | Backlog status |
|---|---|---|---|
| Health score with history + narrative | Computed live, never persisted, no narrative (`dashboard.html:5233-5238`) | No score history at all | Covered: DA-02, DA-03 |
| Weekly Priorities | Doesn't exist; closest analogue is regex-derived meal insight tags | Entire feature missing | Covered: DA-05→DA-08 |
| Biomarker trend-first storytelling | Sparklines exist but secondary to raw value; delta manually typed | Partial — needs reordering + auto-delta | Covered: DA-01, extends DA-04 |
| "Next test in N days" cycle framing | `planoValidoAte` exists, only used for access-gating, never shown as countdown/narrative | Missing entirely | **New: DA-19** |
| Module previews instead of nav cards | Sections require full navigation switch | Confirmed gap from prior audit, no dedicated backlog item existed | **New: DA-20** |
| Physician narrative per biomarker (Function Health style) | Only a 3-value tag (Ótimo/Atenção/Crítico) + free-text report summary; no per-biomarker interpretation text | Missing structured field | **New: DA-21** |
| Daily/weekly adherence check-in | Zero daily engagement mechanic exists (confirmed: no wearable/streak/check-in code in `dashboard.html`) | New capability; DA-18 covers the data field but not the interaction design | **Extends DA-18 — needs a UX decision before scoping (see Part 4)** |
| Wearable/Apple Health integration to fill the between-cycles gap | None | Genuinely new, optional | **Not a backlog item — strategic decision needed (see Part 4)** |

**What's *not* a gap**, contrary to what a "redesign everything" instinct would suggest: the underlying biomarker data model (gender-aware, 4-tier ranges) is already more rigorous than most competitors ship, and the admin↔dashboard data pipe is already solid. This vision is a **presentation and time-horizon gap, not a data-model rebuild** — with two exceptions, both flagged below as decisions rather than backlog items.

---

## Part 4 — Decisions Needed Before These Become Backlog Items

Two items from this vision are deliberately **not** added to `docs/roadmap/dashboard-admin-backlog.md` yet, because they require a product decision from Ricardo first, not just implementation:

1. **Adherence check-in interaction design** (extends DA-18). Open question: how naggy should a daily/weekly check-in be without the product starting to feel like a habit-tracker/chore app rather than a calm clinical companion? Needs a decision on cadence (daily vs. weekly), scope (supplements only, or plan + supplements + hydration), and whether it's opt-in. Once decided, this becomes a concrete DA item.
2. **Wearable/Apple Health/Google Fit integration** to fill the between-cycles data gap with steps/sleep/weight. Open question: does Lyvoo want to become a wearable-adjacent product, or stay deliberately focused on lab-grade episodic data as its differentiator against WHOOP/Oura? This is a strategic positioning question, not an engineering one — it also has real scope implications (which platform, what data, consent/privacy model under the existing GDPR posture) that shouldn't be sized until the positioning question is answered.

Both are revisited once a decision is made; see `docs/roadmap/dashboard-admin-backlog.md` Tier 5 for the three items from this vision that were unambiguous enough to backlog directly (DA-19, DA-20, DA-21).
