# v1 → v2.4 gap analysis

**Compared:** the audited original `capacitysim__7_.html` (1,363,255 bytes) against
the shipping v2.4 rebuild (`dist/capacity-sim.html`).
**Method:** label/API extraction from both builds plus source inspection of
`ui/` (v1) and `ui/v2/` (v2). Counts below are measured, not estimated.

---

## 0. Headline

The v2.4 rebuild replaced v1's **information architecture and demand model** —
and did that well — but it re-implemented only a **subset of v1's editable
surface and analysis depth**.

| Measure | v1 | v2.4 |
|---|---|---|
| Editable fields | **106** | ~32 |
| Queue parameters | **41** | ~10 |
| Global/engine settings exposed | **46** | 0 |
| Data-tab columns | **53** in 7 groups, all 52 weeks | 9, **3 weeks** |
| Charts | 6 | 1 (+ intraday bars, Sankey) |
| Export/import functions | 18 | 3 |
| Tabs / surfaces | 9 tabs | 4 surfaces (5 Results lenses) |

**The single most important nuance:** almost everything below is a **missing UI
surface, not a missing engine capability**. The v1 global configuration is
carried verbatim through `migrateV1ToV2` as `model.engineConfig` and is fed to
the untouched engine by the adapter — so service teams, burnout, CX economics,
deflection/redial, seasonality and the rest are all **still being simulated at
their existing values**. You just can't see or change them in v2. That makes
most of this restoration work (add editors over data that already flows), not
new modelling work.

Two items are genuine functional holes rather than hidden defaults, flagged
**⛔** below.

---

## 1. Gaps by category

### A · Editing surfaces that no longer exist

| # | Feature (v1) | v2 status | Impact |
|---|---|---|---|
| A1 | **Global settings editor** — 46 params: simulation window, occupancy ceiling, day start/end, interval, currency, RAG amber/red thresholds, manager cost + ratio, default training weeks & shrinkage, training debt accrual/recovery, max AHT penalty, max attrition multiplier, £/lost customer, repeat uplift, redial rate, deflection rate, support proficiency, spill, default buffer | **Absent.** Values carried, none editable | **High** — the whole calibration layer is frozen at defaults |
| A2 | **Scenario authoring** — create/edit/schedule factors: growth %, product launch (ramp/peak/decay), P1 incident, forecast error, attrition shock, hiring freeze, reduced training | **Read-only.** Levers lists groups and shows a timeline; you cannot add or change a factor | **High** — "what could happen" is half of Levers, and it's inert |
| A3 | **Workforce / pipeline** — req-to-start, training weeks, learning curve, attrition growth | Absent (drawer has attrition % only) | **High** — hiring lead time drives every strategy |
| A4 | ⛔ **Manual hires table (per queue × week)** | Absent | **High** — strategy **S4 "Manual plan" is selectable but has no input**, so it silently plans zero hires |
| A5 | **Seasonality** — 12 monthly multipliers, system + per-queue, 5 presets, start month | Absent | **High** — no seasonal peak modelling; Christmas/summer effects unreachable |
| A6 | **Intraday arrival pattern** — ~25 interval sliders, 6 presets, save-as-new | Absent | **High** — every queue uses the default double-hump curve |
| A7 | **Burnout model** — occupancy threshold, sensitivity, recovery, max attrition multiplier, absence uplift | Absent | Medium |
| A8 | **CX economics** — customer base, £/lost customer, churn propensities (abandon / long wait / digital breach), repeat-contact uplift | Partial: churn cost + failed→churn % only | Medium — churn £ is a headline output |
| A9 | **Endogenous loops** — deflection %, redial % | Absent | Medium |
| A10 | **Service teams** — size, weekly hour cap, proficiency, cost premium, occupancy trigger, covered queues | Absent | Medium |
| A11 | **Cross-skill / support routes / leveraged resourcing** — flex flags, priority order, share of spare, max share, supporter lists | Drawer has a resourcing *type* selector only; no routes | Medium |
| A12 | **Per-queue volume source** — weekly figures vs flat, brand share, weekly-volume CSV/xlsx import | Absent (v2 derives volume from profiles) | Medium — **by design**, but the 52-week series it replaced has no equivalent yet |
| A13 | **Digital subtype** (customer/chat vs workflow/backlog) | Not selectable; new queues fall to the default | Medium — chat vs case-processing physics differ |
| A14 | **Preset libraries** (intraday + seasonality) with save-as-new and persistence | Absent | Low–Medium |

### B · Analysis depth lost

| # | Feature (v1) | v2 status | Impact |
|---|---|---|---|
| B1 | ⛔ **Data tab: 53 columns in 7 groups (Week/Demand/Service/People/Supply/Money/Status), column picker, all 52 weeks, per-table CSV** | **9 columns, 3 sample weeks** (`someWeeks = [first, middle, last]`) | **High** — this is a real regression: the numbers themselves are largely unavailable |
| B2 | **6 charts** — Coverage, Headcount (trained/ramping/training vs required), Volume composition (base/deflected/redial), Cost breakdown, Idle-pay vs churn with break-even, Burnout | 1 chart (required vs active FTE) | **High** |
| B3 | **Holistic requirement panel** — total required vs paid vs pipeline, feasibility verdict | Absent | Medium–High |
| B4 | **Hiring allocation trace** — per week: grants, denied, binding constraint, order ("Week 6: cap 18, plan wants 26; Billing took 12…") | Absent | Medium–High — this is *the* explanation of a bound plan |
| B5 | **Intraday**: per-queue selector + full interval detail table | **First queue only**, chart only, no table | Medium–High |
| B6 | **Risk register**: severity + **week it lands** + **suggested lever**, sortable | Text + severity only | Medium |
| B7 | **Strategy comparison view** — 4 strategies side by side (SLA weeks red, headcount trajectory, cost, feasibility) | Only the matrix cell summary | Medium |
| B8 | **Overlay comparison** — up to 4 strategies *or* views overlaid on charts/tables | Absent | Medium |
| B9 | **Scenario views** (named enabled-sets) + per-chart view selector | Groups only, no per-chart selector | Low–Medium |

### C · Workflow features lost

| # | Feature (v1) | v2 status | Impact |
|---|---|---|---|
| C1 | **Saved runs / snapshots** — save, list, compare, per-queue comparison blocks, totals delta | **"Save run" is disabled** | **High** — no before/after, the core planning loop |
| C2 | **Report tab + print-to-PDF** — exec summary, findings, risk register, charts, tables, `window.print()` | Absent | **High** — the leadership deliverable |
| C3 | **Parameters CSV round-trip** (flatten/apply every parameter) | Absent (template covers Setup sections only) | Medium |
| C4 | **Run JSON / config JSON** share + load | Absent | Medium |
| C5 | **Volumes CSV** export/import | Absent | Medium |
| C6 | **Model notes** | Absent | Low |
| C7 | Multi-brand: brand names, brand share of volume, per-brand training profiles | Structure has brands, but no brand-level volume/training editing | Medium |

---

## 2. What v2.4 added (the other side of the ledger)

Not a regression list — these are why the rebuild happened, and none of them
exist in v1:

1. **The derivation model** — services, journeys, channel volume profiles;
   queue volume and AHT *derived, never entered* (v1 hand-entered both).
2. **Hierarchy** — Business Unit and Product levels between brand and channel.
3. **Shared queues** with cost allocation by handling minutes.
4. **Cross-structure guard** and unmodelled-mix warnings.
5. **Ecosystem Sankey** — the flow made visible.
6. **Decision matrix as a first-class surface** with cost + SLA + red weeks and
   a live cost↔service weighting.
7. **Four-surface IA** with one shared model and one week cursor.
8. **Template round-trip** with an import validation report.
9. **Referential-integrity guards** on delete.
10. **A 21-gate / 262-test harness** including golden masters pinning the engine.

---

## 3. Recommended restoration order

Sequenced by *credibility of the plan per unit of work* — each step makes the
output more trustworthy than the last.

**Phase 1 — make the numbers real again (highest value, lowest risk)**
1. **B1 Data lens**: restore all 52 weeks and the full column set with groups +
   picker. The data already exists in the run; this is presentation only.
2. **A4 Manual hires** + **A3 workforce/pipeline**: unblocks S4 and makes lead
   time honest.
3. **B4 allocation trace** + **B3 holistic panel**: `sim.allocTrace` is already
   returned by the engine and currently unread.

**Phase 2 — restore control of the model**
4. **A1 global settings editor** — a fifth Setup section, or a Settings drawer.
5. **A5 seasonality** + **A6 intraday pattern** with **A14 preset libraries**.
6. **A7–A11** (burnout, CX economics, loops, service teams, support routes) as
   further drawer accordions — they map onto the six KPI families already there.

**Phase 3 — restore the planning loop**
7. **C1 saved runs / compare** (the `saved-runs.js` module still exists).
8. **C2 report + print**.
9. **B2 charts** (v1's `charts.jsx` is intact and reusable).

**Phase 4 — parity finishing**
10. B5–B9, C3–C7.

### Reuse note

Most of this is **restoration, not invention**. These v1 modules are still in
the repo, still tested, and were written against the same engine:
`ui/editors/{QueuesEditor,ScenariosEditor,SettingsEditor,PresetLibrary,PresetBar}.jsx`,
`ui/components/{charts,DataTab,IntradayTab,HolisticPanel,SnapshotsTab,StrategiesTab}.jsx`,
`ui/{exports,saved-runs,reporting,presets,print}.js`.
The work is adapting them to the v2 model shape and design system, not
rewriting the logic.

---

## 4. Honest summary (v2.4, historical)

v2.4 is a **better product architecture with a smaller feature surface**. It
solved the problems the brief set (derived demand, hierarchy, journeys, one IA,
a decision matrix, a template round-trip) and it is genuinely more coherent
than v1. But as a *planning tool* it is currently less capable: you cannot
author scenarios, tune the workforce pipeline, model seasonality, enter a
manual hiring plan, see the full weekly data, save a run, or produce a report.

Roughly **two-thirds of v1's editable surface and half its analysis depth**
remain to be reinstated. The good news is that the engine still computes all of
it, the values still flow, and most of the v1 code that presented it is still
in the tree.

---

## 5. RE-SCORE after the domain rebuild (F1 complete)

**Compared:** v1 against the shipping six-tab app (SPEC-V3.md baseline).
The Setup/editing side of the ledger has substantially closed; the analysis
side (Results/Levers/Home depth) is deliberately untouched — next cycle.

| Measure | v1 | v2.4 | **now (v3)** |
|---|---|---|---|
| Editable fields | 106 | ~32 | **~95** (six-tab Setup: registry + channel defaults 10 · queue families ~30 · request types/processes ~12 · volume grid n rows × value/shape · Defaults 24) |
| Queue parameters | 41 | ~10 | **~30** exposed (six families × Advanced; pipeline, burnout, cross-skill, supports, subtype, backlog, priority, deflection all back) |
| Global/engine settings exposed | 46 | 0 | **~26** (Defaults: frame 10 · hiring 2 · overtime 4 · costs 2 · customer 6 · seasonality 2; channel defaults moved to Structure; risk thresholds remain a Results lens) |
| Manual hiring plan (S4) | ✔ | ⛔ absent | **✔ restored** — week × heads per queue, proven end-to-end to the engine |
| Seasonality / weekly demand | ✔ | ⛔ absent | **✔ restored** — 52-week series + preset library at any cascade level, reaching `weeklyVolumes` |
| Service teams (shared capacity) | ✔ | hidden | **✔ editable** (Queues › Shared capacity, 8 params + covers) |
| Volume model | totals per queue | mix % profiles, deepest-wins | **cascade with provenance** (entered · weighted · equal · scaled-and-flagged) — better than both |
| Ecosystem/global view | static | derived Sankey | **generated Map** (flow from steps, dashed capacity links, validation with jump-links) |
| Data-tab columns | 53 × 52 wks | 9 × 3 wks | unchanged (next cycle) |
| Charts | 6 | 1 (+2) | unchanged (next cycle) |
| Saved runs / reports | ✔ | — | unchanged (next cycle) |

**Remaining gaps are now concentrated in analysis depth, not authoring:**
the two ⛔ functional holes (manual hires, seasonality) are closed; what's
left of the v1 ledger is Results-side surface (columns, charts, saved runs,
reports) plus the style pass the owner has queued behind function.
