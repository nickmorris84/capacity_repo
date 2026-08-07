# Page review 1 — Setup (draft 3)

**Status:** purpose review. No structural decisions taken yet — §6 lists the
calls to make once we agree the purposes below are right.
**Draft 3 change:** rebuilt around *what each tab is trying to achieve*, per the
owner's framing: **"the goal is to set up the different service flows."**

---

## 1. The domain, as stated by the owner

> A **service flow** is a set of queues that process a specific request. The
> same queues can be used on multiple flows. Service flows require a
> **service**. A service should be attached to a **brand and a business unit**.
> These should be defined separately. Once all are defined, you should be able
> to see a **global view of queues and interactions**.

Read as a dependency chain:

```
brand + business unit ─→ service ─→ service flow ─→ (uses) queues
                                          ↑
                                     volume feeds it
                          global view verifies the whole
```

---

## 2. Setup's purpose, in one line

> **Define the service flows — and everything they depend on — then prove the
> world hangs together.**

Everything in Setup is either (a) a thing a flow needs, or (b) the check that
the flows are sound. That is the test for whether something belongs here.

---

## 3. Tab-by-tab: the job each does

For each: the question it answers, what it defines, what breaks downstream if
it is wrong, **how often it is touched and by whom** — and an honest read of
whether the current build serves that job.

### 3.1 Structure — *"What parts of the organisation are we planning for?"*

| | |
|---|---|
| **Defines** | brands, business units *(today also: products, channels)* |
| **Feeds** | service ownership · queue attachment · volume entry points · Results rollups · future permissions |
| **Cadence** | **Set once.** Changes on reorg or a new product line |
| **Owner** | Planner / admin |

**Current build:** collapsible BU rows, products as indented sub-rows, channels
as tap-on chips. This is the one place in Setup where nesting is genuinely
right — it *is* a tree, so the disclosure mirrors reality.

**Gaps:** you cannot **rename** a BU or product, cannot **delete** one, cannot
reorder. Brand-level attributes v1 had (training profile, brand volume, brand
share) have no home. And the depth is unresolved — the owner described *brand
and BU*; the build has four levels.

---

### 3.2 Queues — *"What stations exist, and what are their physics?"*

| | |
|---|---|
| **Defines** | queue identity, type, attachment (structural or shared), ~30 physics parameters |
| **Feeds** | every flow step · all capacity, cost and SLA maths · Results grouping |
| **Cadence** | **Tuned constantly.** The page you keep coming back to |
| **Owner** | Planner |

**Current build:** grouped list with derived volume + effective AHT, and an
overlay drawer exposing **10 of ~30** parameters.

**Gaps:** 20 missing parameters (all of the pipeline, learning curve, burnout,
manual hires, OT, backlog limit, concurrency, subtype). **Service teams** —
shared capacity that covers queues — have no home at all. Neither do **queue
interactions** (§3.6).

**The reuse signal is missing.** The owner's point that *the same queues can be
used on multiple flows* means a queue row should say **"used in N flows"**, the
way service cards say "used in N profiles". Without it, you cannot see the blast
radius of changing or deleting a queue — the delete guard blocks you, but
nothing tells you *before* you try.

---

### 3.3 Services — *"What do customers actually ask us for?"*

| | |
|---|---|
| **Defines** | request type, activity, product-request type, optional AHT, **(proposed) owning brand + BU** |
| **Feeds** | flows · volume mix |
| **Cadence** | Set up front; extended occasionally |
| **Owner** | Planner / business |

**Current build:** cards with chips, "used in N profiles", optional AHT — **and
the journey chip strip**.

**The core problem:** the service card is doing **two jobs at once** — declaring
*what the request is* and defining *how it gets processed*. Those have different
owners, different cadences, and different reasons to change. That conflation is
what the owner is pointing at.

**Gap:** no brand/BU attachment. Today the only link from a service to the org
is indirect, through a volume profile — so *"which BU owns this service?"* has
no direct answer; you have to reason backwards.

---

### 3.4 Service flows — *"How does each request actually get processed?"*

| | |
|---|---|
| **Defines** | the ordered queue path, split % per step, sampling % for governance steps |
| **Feeds** | **this is what derives queue workload** — the whole demand propagation |
| **Cadence** | Designed once per service; revised when the process changes |
| **Owner** | Planner / ops design |

**Current build:** *does not exist as a surface.* It is a row list at the bottom
of an expanded service card.

**This is the finding that matters most.** The owner says Setup's goal *is* to
set up service flows. In the build, flows are:
- unnamed (they are just an array on a service),
- invisible as a set — you cannot see all flows at once,
- limited to **one per service**, so the same request cannot be processed
  differently by two business units without duplicating the service,
- and given the least prominent home of any concept in Setup.

The most important idea in the model has the weakest representation.

---

### 3.5 Volume — *"How much arrives, and when?"*

| | |
|---|---|
| **Defines** | totals at a node, service mix %, *(missing)* 52-week series, seasonality, arrival shape |
| **Feeds** | every number downstream |
| **Cadence** | **Refreshed on a forecast cycle** — monthly or quarterly |
| **Owner** | **Often a different person** — the contributor |

**Current build:** profile cards with applies-at, a single total, and mix rows.

**Gaps:** the entire demand *shape* — 52-week series, seasonality curve, arrival
pattern — which the original spec called for and I implemented as one number.

**Note the cadence and owner:** this is the only Setup surface routinely touched
by someone who should not be editing anything else. That is a strong argument
for it being cleanly separable — and it makes the contributor-scope idea a
natural fit here rather than a general permissions feature.

---

### 3.6 Global view — *"Does the world I built hang together?"*

| | |
|---|---|
| **Shows** | every queue, the flows through it, the interactions between queues, orphans, unmodelled volume |
| **Cadence** | After every significant edit — it is the completion check |

**Current build:** an **Ecosystem Sankey on Home**, view-only.

**Two problems.**

1. **Wrong page.** It is framed as a homepage presentation; the owner describes
   it as the verification step at the end of Setup.
2. **It is the wrong graph.** The Sankey shows **volume flowing** (brand →
   channel → service → queues → outcome). The owner asked for *"queues and
   **interactions**"* — the capacity links *between* queues: shares-pool,
   leverages-to, supports, converts-to. **That concept has no editable home in
   v2 at all.** Only the `resourcing` type survives, in the drawer. v1 had it
   (brief D12: an Interactions panel with typed edges, graph/table toggle,
   tap-edge-to-edit).

So "a global view of queues and interactions" needs the interactions to exist
as editable objects *first*. That is a missing feature, not a missing view.

---

### 3.7 Defaults & engine — *"What physics does everything inherit?"*

| | |
|---|---|
| **Defines** | the 67 globals (categories A–I, draft 2 §4) |
| **Cadence** | Set once, tuned rarely |

**Current build:** absent entirely.

---

## 4. What the purposes tell us about the structure

### 4.1 Cadence and ownership vary wildly

| Tab | Cadence | Typical owner |
|---|---|---|
| Structure | set once | admin |
| Queues | tuned constantly | planner |
| Services | set up front | planner / business |
| Flows | on process change | ops design |
| Volume | **every forecast cycle** | **contributor** |
| Global view | after each edit | planner |
| Defaults | set once | admin |

Surfaces with different owners and different rhythms should be **separately
addressable** — which is an argument for tabs that comes from *use*, not from
aesthetics or from copying Results.

### 4.2 The dependency order is clean and teachable

```
Structure → Queues → Services → Flows → Volume → [Map verifies]
```

That is almost exactly the order the owner said it in. The current build
collapses *Flows* into *Services* and moves the *Map* off the page — those are
the two deviations.

### 4.3 Three findings, in priority order

1. **Flows are the point of Setup and have the weakest home.** They deserve to
   be first-class: named, listed, reusable across queues, and — if we want the
   same service handled differently by two BUs — separable from the service.
2. **Queue interactions do not exist.** "A global view of queues and
   interactions" cannot be built until support / spill / pool links are
   editable objects again.
3. **Services float free of the org.** No direct brand/BU ownership, which also
   makes volume profiles carry two jobs at once (where volume enters *and*
   which services it feeds). Attaching services to brand+BU would simplify
   profiles to "how much, split how".

---

## 5. Implied tab structure (for discussion, not decided)

```
Structure │ Queues │ Services │ Flows │ Volume │ Map │ Defaults
```

Seven is a lot. Two plausible compressions:

- **Six:** merge *Services* and *Flows* into one tab with a master–detail split
  (service list → its flows), keeping them conceptually distinct but
  co-located.
- **Five:** as above, plus fold *Map* into Home (status quo) — but that loses
  the verification step the owner asked for.

---

## 6. Calls to make (once the purposes above are agreed)

| # | Call | Why it matters |
|---|---|---|
| **C1** | Is a **flow** its own entity (one service → many flows), or the service's single journey? | Determines whether the same service can be processed differently per BU. Data-model change. |
| **C2** | Do **services attach to brand + BU**? *(the catalog-global veto the brief left open)* | Determines whether ownership is answerable directly, and whether profiles simplify. |
| **C3** | Does **Product** earn its place — brand→BU→product→channel, or brand→BU→channel? | Owner described two levels; build has four. |
| **C4** | Do we restore **queue interactions** (support / spill / pool) as editable objects? | Prerequisite for the "queues and interactions" global view. |
| **C5** | Where does the **global view** live — Setup tab, Home, or both? | It is a verification step, currently framed as a presentation. |
| **C6** | Tab count — seven, six (services+flows merged), or five? | Follows from C1 and C5. |
