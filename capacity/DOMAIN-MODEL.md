# Domain model — draft 1 (for review)

**Status:** proposed baseline from the design sessions of this review cycle.
Supersedes the v2.4 service/journey/profile model **once agreed**. Open
decisions are marked ⬜ with a recommendation; everything else reflects what
the owner has stated.

---

## 1. Vocabulary

| Term | Meaning | Replaces (v2.4) |
|---|---|---|
| **Brand / Business unit** | the org skeleton, defined first and separately | brands / businessUnits (kept) |
| **Queue** | a global processing station with staffing physics; reusable by any process | queue (kept) |
| **Process** | **one specific journey** that handles a request — an entry point, ordered steps through queues, declared end points | the `journey` array hidden inside a service |
| **Process group** | groups related processes | — (new) |
| **Channel path** | within a process, the queue path for one supporting channel | — (new; journeys were channel-blind) |
| **Volume entry** | a number entered at *any* level of the hierarchy; the resolver fills in the rest | ChannelVolumeProfile |

Retired words: *service flow* (→ process), *journey* (→ process), *profile*
(→ volume entry). "Service/request type" survives only if D1 = (b).

---

## 2. Entities and relationships

```
Brand ──1:N── Business unit                     (org skeleton, defined first)

Process group
  └── Process                                    each = ONE specific journey
        • assigned to: Brand (or All) × BU (or All)
        • entry: exactly one first step
        • outcomes: enumerated end points (completed, rejected,
          ended-at-decision, handed-off, …)
        └── Channel path (one per supporting channel: voice, digital, …)
              └── Step*  { queueId, splitPct, samplingPct?,
                           terminal?, outcome? }

Queue                                            global; referenced by any step
Volume entry { node, total | 52-week series, shape? }   sparse, any level
```

Cardinalities that carry the owner's requirements:

- **One process, many brands** — a process assigned `Brand = All` (or to a
  specific brand) lets brands **share a process**.
- **Two processes, shared queues** — brands that do *not* share a process each
  get their own, and the same queues may appear in both. Queues are global.
- **One process, many channels** — each channel that supports the process has
  its own queue path; queues may repeat across paths.

## 3. Rework and end points

**Rework is embedded, not a separate process.** An error path is a step branch
with a split % — "20% hit an error and go to rework" is `split 20` into the
rework queue. Multi-round rework collapses to an effective split of p/(1−p)
(computed for the user, not by them).

**Boundary rule:** a separate process is warranted only when the error path is
a **different commitment** — its own SLA, owner, or independently forecast
volume (e.g. complaints arising from failures). *Same request, same
accountability → one process with outcome branches.*

**End points are declared, not implied.** Every branch must terminate in one of
the process's enumerated outcomes; a step may be flagged terminal with its
outcome ("ends at decision"). **Validation:** a branch that reaches no declared
end point is a modelling error, surfaced on the Map.

## 4. The volume cascade

Sparse entry, full resolution, with provenance.

1. **Totals cascade down.** The highest-level entered figure is authoritative
   for everything beneath it.
2. **At each layer, children split the parent by:** explicit weights, if set →
   else finer *entered* figures, normalised into weights → else **equal
   split** across the assigned children.
3. **Shapes aggregate up.** A queue's seasonality/arrival profile is the
   volume-weighted blend of what passes through it; any layer without its own
   shape inherits from above. (Totals flow down; shapes flow up.)
4. **Reconciliation is visible.** Finer entries that disagree with a coarser
   total act as weights and are scaled — with a note ("scaled ×1.06 to
   reconcile with Brand A total"). Warnings, never silent.
5. **Provenance on every number:** `entered` · `weighted` · `equal split` ·
   `inherited shape` — shown in the UI, exported in the template.

Worked example:

```
Entered: Brand A = 10,000/day; later Collections = 5,000.

Brand A          10,000   [entered]
 ├─ Collections   5,000   [entered]
 ├─ Billing       2,500   [equal share of remainder]
 └─ New card      2,500   [equal share of remainder]
      ├─ Voice    1,250   [equal — 2 channel paths]
      └─ Digital  1,250   [equal]
            └─ queue volumes via step splits (process structure, not weights)
```

**Deliberate reversal:** v2.4's deepest-wins override is replaced by
coarse-authoritative + fine-as-weights + equal-by-default. Mix % disappears as
a concept (weights subsume it); "unmodelled remainder" warnings disappear with
it (equal split means nothing is unmodelled by omission).

## 5. Validation rules the model gives for free

| # | Rule | Message shape |
|---|---|---|
| V1 | **Coverage** — every (group, brand×BU) with volume has a matching process | "Brand B receives Billing enquiries but no process handles them" |
| V2 | **No ambiguity** — exactly one process matches a (group, brand, BU, channel) | "Two processes claim Billing · Brand A · Voice" |
| V3 | **End-point completeness** — every branch terminates in a declared outcome | "Step 3 of Premium billing leads nowhere" |
| V4 | **Queue blast radius** — queues report "used in N processes across M brands"; deletion guarded with the list | (existing guard, now with visibility before the attempt) |
| V5 | **Reconciliation** — finer entries scaled to coarser totals, flagged | "scaled ×1.06 …" |

## 6. Hierarchy assessment (the next review)

What the new model implies for the v2.4 hierarchy
(Brand → BU → **Product** → **ChannelInstance** → queue attachment):

| Level | v2.4 role | Under this model | Assessment |
|---|---|---|---|
| Brand, BU | structure + permissions | unchanged — the assignment key for processes | **keep** |
| **Product** | rollup level between BU and channel | nothing references it: processes assign to brand×BU, channels live on the process | ⬜ **at risk** — keep only if it's a real reporting/permission level |
| **ChannelInstance** (structure node) | where profiles attach and queues pin | channel becomes an *attribute of a process path*, not a place in the org tree | ⬜ likely **retired** as a structure level |
| Queue attachment (structural/shared) | grouping + cross-structure guard | all queues are global by reference; "attachment" reduces to an optional **home** for grouping/permissions | ⬜ simplify? |
| Cross-structure warning | guards out-of-path routing | reframed by V1/V2 coverage rules; may be obsolete | review after D1 |

## 7. Deltas from the current build

| Area | Change | Size |
|---|---|---|
| `model/derive.js` | propagation iterates **processes × channel paths** instead of services; volume resolution replaced by the **cascade resolver** (new pure module) | the main work |
| Model shape | `services[].journey` → `processGroups[] / processes[]`; `profiles[]` → `volumeEntries[]`; migration provided | medium |
| `model/adapter.js` | unchanged mechanics — still consumes derived per-queue volume/AHT | none–small |
| **Engine** | **untouched**, as always | none |
| Setup IA | follows this model (REVIEW-SETUP resumes after this is agreed) | — |
| Template | sheets become Structure · Queues · Process groups · Processes/steps · Volume entries | medium |

## 8. Open decisions

| # | Decision | Recommendation |
|---|---|---|
| ⬜ **D1** | Is the **process group** itself the request type (a), or does a separate **Service** catalogue sit above groups (b)? | **(a)** — "Billing enquiry" is the group; its brand/BU variants are the processes. One less layer; nothing described so far needs (b). |
| ⬜ **D2** | Rework boundary rule as stated in §3? | Confirm as written. |
| ⬜ **D3** | Assignment key: Brand×BU with "All", or explicit brand **lists**? | Start with Brand×BU + All; add lists only when a real "A and B but not C" case appears. |
| ⬜ **D4** | Does **Product** survive as a structure level? | Lean retire (nothing references it); keep only if it's a real rollup for your estate. |
| ⬜ **D5** | Queue attachment: keep structural/shared, or all-global + optional "home" grouping? | All-global + home. The shared/structural split loses its meaning once routing is process-based. |
| ⬜ **D6** | Where does an **AHT override** live now — on the process (per journey), per step, or kept at group level? | Process-level, falling back to queue AHT — mirrors today's service-level override. |
