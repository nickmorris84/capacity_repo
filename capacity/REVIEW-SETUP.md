# Page review 1 — Setup

**Status:** working draft for review. Once settled, this replaces §4 of SPEC-V2.md.
**Evidence:** v1 `ui/editors/QueuesEditor.jsx` (41 fields) and `SettingsEditor.jsx`
(46 fields); v2 `ui/v2/SetupPage.jsx` (~25 controls). Engine queue shape read
from `makeDefaultConfig()`.

---

## 1. Goal

> **Build and maintain a world the engine can simulate — and be able to defend
> every number in it.**

Two audiences, two speeds:

| Who | What they need |
|---|---|
| **Planner** (primary) | Build a credible model in minutes; then tune one parameter and see the consequence without hunting for it |
| **Contributor** | Enter or refresh volumes for their own queues; touch nothing else |

The tension to resolve deliberately: the brief's goal #3 says *"complexity is
hidden by default — not walls of fields."* v1 chose walls (41 fields per queue,
flat). v2 over-corrected and **deleted** the fields instead of hiding them.
Neither is right.

**Proposed principle — depth behind a clear surface:**
progressive disclosure must be *reversible in one click*. Every parameter the
engine reads is reachable in ≤ 2 clicks from the queue row, and the default
view shows only what most people change most often. Hiding is a default, never
a deletion.

---

## 2. Current state

Four sections (Structure · Queues · Service catalog · Channel volume profiles),
each collapsible with a completion badge; a queue drawer with six KPI-family
accordions.

**What works and should be kept:**
- Derived volume + effective AHT with `svc`/`weighted` markers — the core idea,
  and genuinely better than v1's hand-entered numbers.
- Services + journeys + profiles: demand stated once, routing stated once.
- Referential-integrity guards on delete.
- Warnings surfaced where the cause is (unmodelled mix, cross-structure).
- The section/badge structure and the drawer's six-family organisation.

**What's thin:** the drawer carries **10 of the engine's ~30 queue parameters**,
and **none of the 46 globals** are editable anywhere.

---

## 3. What v1 had that we dropped

Mapping every v1 queue parameter onto the six KPI families the drawer already
uses. **Bold = missing in v2 today.**

| Family | Parameters |
|---|---|
| **Inputs** | derived volume *(read-only, v2)* · fallback AHT · **concurrency** · **digital subtype (chat vs workflow)** · **arrival pattern (~25 intervals + presets)** · **seasonality pattern (12 months + presets)** |
| **Performance** | ASA target · max abandon · patience · **SLA within (digital mins)** · **SLA target %** · **backlog limit** · **SLA attainment target** |
| **Efficiency** | occupancy ceiling · **OT: max/agent/day, weekly ceiling, premium, burnout load** |
| **Workforce** | shrinkage · attrition · resourcing model · **starting FTE** · **attrition growth** · **req-to-start** · **training weeks** · **learning curve** · **manual hires (week × heads)** · **priority** · **cross-skill / supports: share of spare, max share, supporter list** · **burnout: occ threshold, sensitivity, recovery, max attrition mult, absence uplift** |
| **Customer** | churn cost · failed→churn % · **repeat contacts** · **converts-to-calls + target queue** · **redial %** |
| **Outputs** | agent cost · **OT premium** · **manager cost / ratio** *(global)* |

Plus **46 globals** with no home at all: simulation window, occupancy ceiling,
day start/end, interval, currency, channel defaults, training & debt (accrual,
recovery, max AHT penalty, max attrition), overtime rules, knock-on defaults
(repeat, spill), manager cost/ratio, £/lost customer, repeat uplift, redial,
deflection, risk thresholds, and the seasonality/arrival **preset libraries**.

---

## 4. Proposed structure

### 4.1 Five sections

| # | Section | Change |
|---|---|---|
| 1 | Structure | unchanged |
| 2 | Queues | unchanged surface; **drawer gains depth** (§4.2) |
| 3 | Service catalog | unchanged |
| 4 | Channel volume profiles | **+ 52-week series, seasonality curve, arrival pattern** (§4.3) |
| 5 | **Defaults & engine** *(new)* | the 46 globals + preset libraries (§4.4) |

Section 5 sits last deliberately: it is the only section you can ignore on day
one (everything has a working default), so the empty-state wizard still gets
you to a running simulation without it.

### 4.2 The queue drawer — three tiers

Each family accordion becomes:

```
▸ Workforce   30% shrinkage · 26%/yr attrition · dedicated     ← summary (collapsed)
  ├ Shrinkage, Attrition, Resourcing model                     ← tier 2: common
  └ ▸ Advanced (7)                                             ← tier 3: long tail
      Starting FTE · Attrition growth · Req-to-start ·
      Training weeks · Learning curve · Priority ·
      Burnout (5 params)
```

- **Tier 1** — the one-line summary that already exists.
- **Tier 2** — the 2–4 parameters people actually change. Visible on expand.
- **Tier 3** — "Advanced (n)" disclosure. Everything else, always reachable,
  never in your face. The count in the label tells you it's there.
- A **modified dot** on any tier that differs from the default, so overrides
  can't hide inside a collapsed section.

This is the compromise: v1's completeness, v2's calm.

**Manual hires** (S4's only input) goes in Workforce → Advanced as a small
week × heads table, **and** the Manual plan card in Levers links straight to it.
One source of truth, two doors.

### 4.3 Profiles gain the demand shape

Today a profile is a single number. Restoring the spec's demand model:

- **Total volume** — either a flat daily figure *or* a **52-week series**
  (typed in a grid, or imported from the template's new Volumes sheet).
- **Seasonality** — a 12-point curve with preset chips (Flat, Retail Christmas,
  Summer lull, FY-end Q4, School-term) and save-as-new.
- **Arrival pattern** — a draggable intraday curve with preset chips (Double
  hump, Morning-heavy B2B, Evening consumer, Lunchtime spike, Flat,
  Weekend-shifted).

Seasonality and arrival sit here rather than per-queue because in v2 **demand
enters at the profile**, not the queue — the queue inherits the shape of what
flows into it. (v1 put them on the queue because that's where volume lived.)
A queue-level override stays possible via the drawer's Inputs accordion for the
cases where one station genuinely differs.

### 4.4 Section 5 — Defaults & engine

Six groups, matching v1's grouping so the mental model transfers:

1. **Engine & window** — simulation window, occupancy ceiling, day start/end,
   interval, currency, support proficiency
2. **Channel defaults** — per channel: ASA target, max abandon, patience,
   concurrency, SLA within/target. New queues inherit these.
3. **Training & debt** — default training weeks, training shrinkage, debt
   accrual/recovery, max AHT penalty, max attrition multiplier
4. **Overtime** — max/agent/day, weekly ceiling, premium, burnout load
5. **Costs & CX** — manager cost + ratio, £/lost customer, repeat uplift,
   redial rate, deflection rate, knock-on defaults (repeat, spill)
6. **Preset libraries** — seasonality and arrival patterns: apply, edit,
   save-as-new, delete

*Not here:* hiring caps, default buffer and risk thresholds — those are
**levers**, and already live on the Levers page (D10). Correct as-is.

---

## 5. Decisions needed

My recommendation on each, with the trade-off. Push back on any.

| # | Decision | Recommendation | Why / cost of the alternative |
|---|---|---|---|
| D1 | Home for the 46 globals | **5th Setup section** | Keeps the agreed 4-tab IA (D3). A 5th top-level tab is closer to v1 but reopens the IA decision. |
| D2 | Profile volume shape | **Full 52-week series** + seasonality + arrival | It's the demand model planners actually use and the template already wants a Volumes sheet. A single number × seasonality curve is ~40% of the work but can never load an actual forecast. |
| D3 | Manual hires location | **Drawer (Workforce › Advanced) + link from Levers** | It's per-queue data, so it belongs to the queue. A consolidated grid in Levers is better for planning a hiring wave — worth adding later, not first. |
| D4 | Drawer depth | **Three tiers** (summary → common → Advanced) | Two tiers is simpler but Workforce would show 12 fields flat. "Everything visible" is v1's wall. |
| D5 | Seasonality/arrival home | **Profile-level, with queue override** | Follows where demand now enters. If you'd rather keep them queue-level (v1 parity), say so — it's a smaller change but conceptually inconsistent with derived volume. |
| D6 | Contributor mode | **Defer** | The brief wants a scoped "enter data" view. Worth doing, but after parity. |

---

## 6. Proposed build order for Setup

1. **Drawer depth** (D4) — restore all ~30 queue params in three tiers.
   Unblocks manual hires (S4) and the workforce pipeline. Biggest capability
   win per unit of work.
2. **Section 5 · Defaults & engine** (D1) — the 46 globals.
3. **Profile demand shape** (D2, D5) — 52-week series, seasonality, arrival
   patterns + preset libraries.
4. Template gains a **Volumes sheet** to match (3).
5. Contributor mode (D6), if wanted.
