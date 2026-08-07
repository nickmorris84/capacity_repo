# Page review 1 — Setup (draft 2)

**Status:** working draft for review. Replaces SPEC-V2 §4 once settled.
**Changed in draft 2:** navigation grammar (§2) after the "why drawers?"
challenge; globals fully categorised from the engine, not v1's labels (§4);
per-family purpose stated (§3).

---

## 1. Goal

> **Build and maintain a world the engine can simulate — and be able to defend
> every number in it.**

| Audience | Needs |
|---|---|
| **Planner** (primary) | A credible model in minutes; then tune one parameter without hunting for it |
| **Contributor** | Refresh volumes for their own queues; touch nothing else |

**The principle to settle first:** *hiding is a default, never a deletion.*
Every parameter the engine reads must be reachable in ≤ 2 clicks; the default
view shows only what is commonly changed. v1 chose walls of fields; v2
over-corrected by removing them. Neither is right.

---

## 2. Navigation grammar (the consistency problem)

Today the app speaks three dialects: Results uses **horizontal sub-tabs**,
Setup uses **vertical accordions + an overlay drawer**, Levers uses **cards
with inline expansion**. That is the inconsistency, and the drawer is the worst
of it — a 420 px overlay designed when a queue had six fields, now the densest
editing surface in the product.

### 2.1 Proposed: one grammar, four rules

| Pattern | Used for | Example |
|---|---|---|
| **Horizontal tabs** | *Which thing am I looking at* — mutually exclusive peers | Results lenses; **Setup sections** |
| **Master–detail** (list + panel) | *Which instance am I editing* | queues, services, profiles |
| **Headed sections in one scroll + sticky jump-nav** | *The parameters of one instance* | queue families; global groups |
| **Nested disclosure** | *Only where it mirrors real hierarchy* | BU › product › channel; service › journey steps |

That last rule is the important distinction, and it validates the instinct
behind the challenge: **Structure's nesting is good because it is a tree.**
The queue drawer's accordions are bad because they are just a form in a box.
Nesting that represents structure earns its place; nesting that only hides a
form does not.

### 2.2 What Setup becomes

```
Setup
┌─────────────────────────────────────────────────────────────┐
│ Structure ● │ Queues 4 │ Services 2 │ Volume ▲ │ Defaults   │  ← sub-tabs
└─────────────────────────────────────────────────────────────┘
```

- **Structure** — the BU › product › channel tree. Keeps its nesting.
- **Queues** — master–detail: the grouped queue list stays on the left; picking
  one opens a **full-width editor**, six family sections in one scroll with a
  sticky family nav. **No overlay drawer.**
- **Services** — master–detail: service list → journey editor.
- **Volume** — master–detail: profile list → mix + 52-week series + curves.
- **Defaults & engine** — the eight global groups (§4) in one scroll with the
  same sticky nav as the queue editor.

One editing pattern, reused four times.

### 2.3 What we lose, and the mitigation

Honest trade-off: the four-accordion page was the mockup's central idea — *"the
empty state IS the wizard"* — where you scroll down through the dependency
order and see all four completion badges at once. Tabs break that.

Mitigations:
- **Completion state moves onto the tabs** — a count, ● complete, ▲ needs
  attention. Same information, one line higher.
- **When the model is incomplete**, a slim progress strip under the tabs names
  the next thing to do and links to it, so a new user is still led through
  Structure → Queues → Services → Volume.
- Tabs also *solve* the problem that made the drawer necessary: a full-width
  panel has room for 30 parameters. The accordion page never did.

---

## 3. The six families — purpose, contents, gaps

Each family answers one question. That is what makes them a good grouping for
editing, not just reporting.

### Inputs — *"What arrives here, and how long it takes."*
| Present | Missing |
|---|---|
| derived volume (read-only), fallback AHT | **concurrency**, **digital subtype (chat vs workflow)**, **arrival pattern**, **seasonality pattern** *(→ moving to profiles, §5.3)* |

### Performance — *"What good looks like here."*
| Present | Missing |
|---|---|
| ASA target, max abandon | **SLA within (digital mins)**, **SLA target %**, **backlog limit**, **patience** *(exposed for voice only)*, **SLA attainment target** |

### Efficiency — *"How hard we are prepared to run."*
| Present | Missing |
|---|---|
| occupancy ceiling | **overtime: max/agent/day, weekly ceiling, premium, burnout load** |

### Workforce — *"Who is here, who is coming, who is leaving."*
| Present | Missing |
|---|---|
| shrinkage, attrition, resourcing model | **starting FTE**, **attrition growth**, **req-to-start**, **training weeks**, **learning curve**, **manual hires (week × heads)**, **priority**, **support routes (share of spare, max share, supporter list)**, **burnout (5: occ threshold, sensitivity, recovery, max attrition mult, absence uplift)** |

*The largest gap by far — and the one that makes strategy S4 inert.*

### Customer — *"What it costs the customer when we miss."*
| Present | Missing |
|---|---|
| churn cost, failed→churn % | **repeat contacts**, **converts-to-calls + target queue**, **redial %** |

### Outputs — *"What it costs us."*
| Present | Missing |
|---|---|
| agent cost | **OT premium**, manager cost/ratio *(global — see §4)* |

### 3.1 Known awkwardness

Two parameters sit oddly in a KPI-family grouping, because the families were
designed for *reporting*, not *editing*:

- **Support / spill routes** — modelled as Workforce (they are capacity) but
  they are really *routing*, and they pair conceptually with journeys.
- **Converts-to-calls** — sits in Customer, but it is a routing rule.

Options: leave them (accept the seam), or add a seventh editing group
**"Connections"** for everything that links one queue to another (support
routes, spill, converts-to). The second is cleaner conceptually but breaks the
"six families everywhere" rule from the brief (D4). **Recommendation:** leave
them for now, revisit if the Connections idea earns its keep on Levers too.

---

## 4. The globals — categorised

**67 fields**, read from the engine (`engine`, `costs`, `cx`, `loops`,
`R2_DEFAULTS`), not from v1's editor labels — v1 exposed only 46 of them.
Grouped by *what kind of thing they are*, which is what makes them navigable:

| # | Category | Fields | n | Proposed home |
|---|---|---|---|---|
| **A** | **Simulation frame** — how the clock works | horizonWeeks (+min/max), dayStart, dayEnd, intervalMin, daysPerWeek, hoursPerFteDay, daysWorkedPerFte, currency, calendar.weekOneDate | 11 | Setup › Defaults |
| **B** | **Channel defaults** — the inheritance layer | per channel: ASA target, max abandon, patience, concurrency, SLA within, SLA target + knockOn.{repeatPct, spillPct, spillTargetQueue} | ~9 × channels | Setup › Defaults |
| **C** | **Workforce policy** | training.{weeks, learningCurve, shrinkagePct}, trainingDebt.{accumRate, recoveryRate, maxAhtPenalty, maxAttritionMult}, globalStartingHC, crossSkillProficiency, occupancyCeiling | 10 | Setup › Defaults |
| **D** | **Overtime policy** | ot.{maxDailyHours, weeklyCeiling, premium, burnoutLoad} | 4 | Setup › Defaults |
| **E** | **Cost model** | costs.{managerCost, managerRatio}, cx.costPerLostCustomer | 3 | Setup › Defaults |
| **F** | **Customer behaviour** | cx.{customerBase, churnAbandon, churnWait, churnDigital, repeatUplift}, loops.{redial, deflection} | 7 | Setup › Defaults |
| **G** | **Risk thresholds** — when a number turns amber/red | risk.{slaBreachRun, tippingMargin, burnout, trainingDebt, otStreakWeeks, borrowedShare, knockOnShare, overCapacityPct} × amber/red + unmannedStarvation.{floorCover, weeks} | 19 | **Debatable — see below** |
| **H** | **Shared capacity** — service teams | per team: name, size, premiumPct, proficiency, triggerOccupancy, maxHoursPerWeek, agentCost, coversQueues | 8/team | **Setup › Queues** (they are capacity providers, siblings of queues) |
| **I** | **Pattern libraries** | seasonality presets, arrival presets | list | Setup › Defaults |

**Already correctly placed elsewhere — leave them:** hiring caps + total
ceiling, default buffer, S3 look-ahead months → **Levers** (D10: caps are a
lever, not a world property).

### 4.1 Two placement calls worth making deliberately

**G · Risk thresholds (19 fields).** These do not change the simulation — they
change *when the risk register shouts*. Three options:
1. Setup › Defaults (simple, keeps all config in one place)
2. **Results › Risk register — an inline "thresholds" control** where you see
   their effect *(recommended: they are a reading lens, not a world property,
   and the register already says "thresholds in Setup" which we can honour by
   linking)*
3. Levers (they shape the decision but are not a decision)

**H · Service teams.** They are shared capacity that covers queues — closer to
a queue than a setting. Recommendation: a **"Shared capacity" group inside the
Queues tab**, listed alongside the shared-queue group.

---

## 5. Proposed structure (consolidated)

### 5.1 Five tabs
Structure · Queues · Services · Volume · Defaults & engine — with completion
state on the tabs and a progress strip while incomplete (§2.3).

### 5.2 Queue editor
Master–detail, six family sections in one scroll, sticky family nav, modified
dots per section. Within a family: common parameters first, an **"Advanced (n)"**
disclosure for the long tail (burnout internals, training debt, priority).
Manual hires as a week × heads table in Workforce, cross-linked from the Levers
Manual-plan card.

### 5.3 Volume tab
Profiles gain the demand shape the spec always called for:
- **total volume** — flat daily figure *or* a **52-week series** (typed or imported)
- **seasonality** — 12-point curve + preset chips
- **arrival pattern** — draggable intraday curve + preset chips

At profile level rather than queue level, because in v2 **demand enters at the
profile** — the queue inherits the shape of what flows into it. (v1 put them on
the queue only because that is where volume lived.) A queue-level override
stays available in Inputs for stations that genuinely differ.

---

## 6. Decisions

| # | Decision | Recommendation |
|---|---|---|
| **D1** | Navigation grammar | **Adopt §2.1** — tabs / master–detail / scrolling sections / nesting-only-for-hierarchy |
| **D2** | Setup layout | **Five sub-tabs**, drawer retired, completion on tabs + progress strip |
| **D3** | Globals home | **Setup › Defaults & engine**, categories A–F + I |
| **D4** | Risk thresholds (G) | **Results, inline on the risk register** — they are a reading lens |
| **D5** | Service teams (H) | **Setup › Queues**, as shared capacity |
| **D6** | Profile volume shape | **52-week series + seasonality + arrival**, at profile level |
| **D7** | Manual hires | Queue editor › Workforce, cross-linked from Levers |
| **D8** | Family seams (routing params) | Leave in current families; revisit a "Connections" group later |
| **D9** | Contributor mode | Defer until after parity |

---

## 7. Build order

1. **Navigation shell** — five tabs, retire the drawer, master–detail in Queues.
   Pure restructure, no new parameters; makes room for everything else.
2. **Queue editor depth** — all ~30 parameters in six sections. Unblocks S4 and
   the workforce pipeline.
3. **Defaults & engine tab** — categories A–F, I.
4. **Volume tab** — 52-week series, seasonality, arrival + preset libraries.
5. **Service teams** into Queues; **risk thresholds** onto Results.
6. Template gains a Volumes sheet to match (4).
