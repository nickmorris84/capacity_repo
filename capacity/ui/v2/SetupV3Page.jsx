/* Domain redesign — Setup shell (BUILD-PLAN U1). The six-tab Setup over the
 * DOMAIN model (DOMAIN-MODEL v1.2 / REVIEW-SETUP §2):
 *
 *   Structure │ Queues │ Request types │ Volume │ Map │ Defaults
 *
 * The order IS the dependency order. Completion state lives on the tabs
 * (● complete · ▲ needs attention); while the model is incomplete a slim
 * progress strip names the next thing to do and jumps there. Queues carries
 * the master–detail scaffold the deep editors (U2–U6) will fill; every panel
 * here renders a live read-only view of the model so the shell is reviewable
 * before the editors land.
 */
import { useState, useMemo } from "react";
import { propagateDomain } from "../../model/propagate.js";
import { queueUsage, keyOf, canDeleteBrand, canDeleteBU, canDeleteChannel, canDeleteGroup, canDeleteProduct, canDeleteRequestType, canDeleteQueue } from "../../model/domain.js";
import { SEASONAL_PRESETS } from "../../engine/engine.js";
import { CHANNELS } from "../../model/taxonomy.js";
import { engineTypeOf, engineQueueDefaults } from "../../model/bridge.js";
import * as Ops from "../../model/ops.js";
import { QTYPE_LABELS, CHANNEL_LABELS, ACTIVITIES, ACTIVITY_LABELS, QUEUE_TYPES } from "./model.js";
import { FAMILY_COLORS } from "./tokens.js";

const fmt = (n) => (n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("en-GB"));
const NAV = [["home", "Home"], ["setup", "Setup"], ["levers", "Levers"], ["results", "Results"]];

export const SETUP_TABS = [
  ["structure", "Structure"],
  ["queues", "Queues"],
  ["requestTypes", "Request types"],
  ["volume", "Volume"],
  ["map", "Map"],
  ["defaults", "Defaults"],
];

// ---- completion: one status per tab, in dependency order ---------------------
export function computeStatus(model, p) {
  const nBrands = (model.brands || []).length, nBus = (model.businessUnits || []).length,
    nChans = (model.channels || []).length, nQ = (model.queues || []).length,
    nRt = (model.requestTypes || []).length, nVe = (model.volumeEntries || []).length;
  const errs = p.validation.errors, warns = p.validation.warnings;
  const structOk = nBrands > 0 && nBus > 0 && nChans > 0;
  const rtErrs = errs.length; // V3/dangling all live on the wiring
  const uncovered = warns.filter((w) => w.kind === "uncovered_volume").length;
  return [
    { key: "structure", ok: structOk, badge: `${nBrands + nBus + nChans + (model.processGroups || []).length + (model.products || []).length} entities`,
      next: "Add your first brand, business unit and channel in Structure." },
    { key: "queues", ok: nQ > 0, badge: `${nQ} queue${nQ === 1 ? "" : "s"}`,
      next: "Add the queues work actually lands on." },
    { key: "requestTypes", ok: nRt > 0 && rtErrs === 0,
      badge: rtErrs ? `${rtErrs} error${rtErrs === 1 ? "" : "s"}` : `${nRt} type${nRt === 1 ? "" : "s"}`,
      next: nRt === 0 ? "Define a request type and wire its process." : "Fix the process errors flagged in Request types." },
    { key: "volume", ok: nVe > 0 && uncovered === 0,
      badge: uncovered ? `${uncovered} uncovered` : `${nVe} entr${nVe === 1 ? "y" : "ies"}`,
      next: nVe === 0 ? "Enter volume at whatever level you know it." : "Cover the volume flagged as reaching no process." },
    { key: "map", ok: p.validation.ok, badge: p.validation.ok ? "no issues" : `${errs.length + warns.length} issue${errs.length + warns.length === 1 ? "" : "s"}`,
      next: "Resolve the issues listed in Map." },
    { key: "defaults", ok: !!model.engineConfig, badge: model.engineConfig ? "attached" : "missing",
      next: "Attach engine defaults (import a model or start from the sample)." },
  ];
}

export default function SetupV3Page({ model, onModelChange, onNav = () => {}, onOpenClassic }) {
  const p = useMemo(() => propagateDomain(model), [model]);
  const status = useMemo(() => computeStatus(model, p), [model, p]);
  const [tab, setTab] = useState("structure");
  const firstTodo = status.find((s) => !s.ok);

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <div className="mark">C</div>
          <div><h1>{(model.brands && model.brands[0] && model.brands[0].name) || "Simulation"}</h1><small>Capacity Simulator</small></div>
        </div>
        <div className="tabs" role="tablist" aria-label="Sections">
          {NAV.map(([k, label]) => (
            <button key={k} role="tab" className={k === "setup" ? "on" : ""} aria-selected={k === "setup"} onClick={() => onNav(k)}>{label}</button>
          ))}
        </div>
      </header>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h2>Setup</h2>
        {onOpenClassic ? <button className="linkbtn" onClick={onOpenClassic}>← classic Setup</button> : null}
      </div>
      <p className="lede">Six tabs in dependency order — each consumes what the previous ones defined. Request types is the only place anything is wired together.</p>

      {firstTodo ? (
        <div className="pstrip" role="status"><span className="glyph todo">▲</span><span><b>Next:</b> {firstTodo.next}</span>
          <button className="btn sm" onClick={() => setTab(firstTodo.key)}>Go</button></div>
      ) : null}

      <div className="subtabs" role="tablist" aria-label="Setup tabs">
        {SETUP_TABS.map(([k, label]) => {
          const s = status.find((x) => x.key === k);
          return (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {label}
              {!s.ok ? <span className="glyph todo">▲</span> : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" data-tab={tab} className="panel">
        {tab === "structure" && <StructurePanel model={model} set={onModelChange} />}
        {tab === "queues" && <QueuesPanel model={model} set={onModelChange} p={p} />}
        {tab === "requestTypes" && <RequestTypesPanel model={model} set={onModelChange} p={p} />}
        {tab === "volume" && <VolumePanel model={model} set={onModelChange} p={p} />}
        {tab === "map" && <MapPanel model={model} p={p} onJump={setTab} />}
        {tab === "defaults" && <DefaultsPanel model={model} set={onModelChange} />}
      </div>
    </div>
  );
}

const nameOf = (list, id) => { const e = (list || []).find((x) => x.id === id); return e ? e.name : id; };

// ---- 1 · Structure — the registry: five flat lists, editable (U2) ------------
// Rename propagates by id (nothing stores names twice); delete is guarded with
// the dependents summarised (V6). Channels enable from the taxonomy and carry
// the channel defaults new processes inherit (globals category B).
const KIND_LABELS = { requestType: ["request type", "request types"], queue: ["queue", "queues"], volumeEntry: ["volume entry", "volume entries"], process: ["process", "processes"] };
function guardSummary(guard) {
  const byKind = {};
  for (const b of guard.blockedBy) byKind[b.kind] = (byKind[b.kind] || 0) + 1;
  return Object.entries(byKind).map(([k, n]) => {
    const [one, many] = KIND_LABELS[k] || [k, k + "s"];
    return `${n} ${n === 1 ? one : many}`;
  }).join(" · ");
}

function RegRow({ entity, onRename, guard, onDelete, extra, children }) {
  return (
    <div className="regrow">
      <div className="regmain">
        <input value={entity.name} onChange={(e) => onRename(e.target.value)} aria-label={"Rename " + entity.name} />
        {extra}
        {guard.ok
          ? <button className="regdel" onClick={onDelete} aria-label={"Delete " + entity.name}>✕</button>
          : <span className="hint blocked" title={"Referenced by " + guardSummary(guard)}>▲ in use — {guardSummary(guard)}</span>}
      </div>
      {children}
    </div>
  );
}

function RegistryList({ title, list, hint, onAdd, addLabel, row }) {
  return (
    <div className="reglist">
      <div className="reghead"><b>{title}</b><span className="count">{(list || []).length}</span>
        {onAdd ? <button className="btn sm" style={{ marginLeft: "auto" }} onClick={onAdd}>{addLabel || "+ Add"}</button> : null}
      </div>
      {hint ? <p className="hint" style={{ marginBottom: 6 }}>{hint}</p> : null}
      {(list || []).length === 0 ? <span className="hint">none yet</span> : list.map(row)}
    </div>
  );
}

const CH_DEFAULT_FIELDS = [
  ["asaTarget", "ASA target (s)", 1],
  ["maxAbandon", "Max abandon (%)", 100],
  ["patience", "Patience (s)", 1],
  ["concurrency", "Concurrency", 1],
  ["digitalSlaMinutes", "SLA within (min)", 1],
  ["digitalSlaPct", "SLA target (%)", 100],
];

function ChannelRow({ model, c, set }) {
  const [open, setOpen] = useState(false);
  const d = c.defaults || {};
  return (
    <RegRow entity={c} onRename={(name) => set(Ops.renameChannel(model, c.id, name))}
      guard={canDeleteChannel(model, c.id)} onDelete={() => set(Ops.deleteChannel(model, c.id))}
      extra={<>
        <span className="tax">{CHANNEL_LABELS[c.key] || c.key}</span>
        <button className="linkbtn" onClick={() => setOpen(!open)} aria-expanded={open}>defaults{Object.keys(d).length ? " ●" : ""}</button>
      </>}>
      {open ? (
        <div className="fields chdefaults" data-testid={"channel-defaults-" + c.key}>
          {CH_DEFAULT_FIELDS.map(([k, label, scale]) => (
            <div className="field" key={k}><label>{label}</label>
              <input className="num" placeholder="—" value={d[k] != null ? Math.round(d[k] * scale * 100) / 100 : ""}
                onChange={(e) => set(Ops.setChannelDefaults(model, c.id, { [k]: e.target.value === "" ? undefined : (+e.target.value || 0) / scale }))} />
            </div>
          ))}
          <p className="hint" style={{ gridColumn: "1/-1" }}>New processes on this channel inherit these; a queue can still override them.</p>
        </div>
      ) : null}
    </RegRow>
  );
}

function StructurePanel({ model, set }) {
  const plain = [
    ["Brands", "brands", Ops.addBrand, Ops.renameBrand, Ops.deleteBrand, canDeleteBrand, "New brand", "+ Brand"],
    ["Business units", "businessUnits", Ops.addBusinessUnit, Ops.renameBusinessUnit, Ops.deleteBusinessUnit, canDeleteBU, "New business unit", "+ Business unit"],
    ["Process groups", "processGroups", Ops.addProcessGroup, Ops.renameProcessGroup, Ops.deleteProcessGroup, canDeleteGroup, "New group", "+ Group"],
    ["Products", "products", Ops.addProduct, Ops.renameProduct, Ops.deleteProduct, canDeleteProduct, "New product", "+ Product"],
  ];
  const enabledKeys = new Set((model.channels || []).map((c) => c.key));
  const offKeys = CHANNELS.filter((k) => !enabledKeys.has(k));
  const [brandsL, busL, groupsL, prodsL] = plain.map(([title, key, add, rename, del, guard, seed, addLabel]) => (
    <RegistryList key={key} title={title} list={model[key]} onAdd={() => set(add(model, { name: seed }))} addLabel={addLabel}
      row={(e) => (
        <RegRow key={e.id} entity={e} onRename={(name) => set(rename(model, e.id, name))}
          guard={guard(model, e.id)} onDelete={() => set(del(model, e.id))} />
      )} />
  ));
  return (
    <>
      <h3>Structure</h3>
      <p className="hint">Brands, business units, channels, groups and products — set up here, wired together in Request types. Renames propagate; deletes are guarded while in use.</p>
      <div className="structgrid">
        {brandsL}
        {busL}
        <div className="reglist">
          <div className="reghead"><b>Channels</b><span className="count">{(model.channels || []).length}</span></div>
          {(model.channels || []).length === 0 ? <span className="hint">none yet</span> : null}
          {(model.channels || []).map((c) => <ChannelRow key={c.id} model={model} c={c} set={set} />)}
          {offKeys.length ? (
            <div className="regoff">
              {offKeys.map((k) => (
                <button key={k} className="chip off" onClick={() => set(Ops.addChannel(model, { key: k, name: CHANNEL_LABELS[k] }))} aria-label={"Enable " + CHANNEL_LABELS[k]}>
                  + {CHANNEL_LABELS[k]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {groupsL}
        {prodsL}
      </div>
    </>
  );
}

// ---- 2 · Queues — stations and their physics (U4) ----------------------------
// Master list grouped by home (plus Global and Shared capacity); full editor in
// six KPI families with an Advanced disclosure per family for the long tail.
// Volume and effective AHT stay DERIVED — never entered here. Manual hires
// (week × heads) live in Workforce — S4's input.
function NumF({ label, value, onChange, placeholder }) {
  return (
    <div className="field"><label>{label}</label>
      <input className="num" value={value} placeholder={placeholder || ""} aria-label={label}
        onChange={(e) => onChange(e.target.value)} /></div>
  );
}
const n0 = (v) => +v || 0;

function Fam({ fam, name, sum, children, advanced }) {
  const [adv, setAdv] = useState(false);
  return (
    <section className="fam-sec">
      <div className="famhead"><span className="fam" style={{ background: FAMILY_COLORS[fam] }} /><b>{name}</b><span className="hint">{sum}</span>
        {advanced ? <button className="linkbtn" style={{ marginLeft: "auto" }} onClick={() => setAdv(!adv)} aria-expanded={adv}>{adv ? "Hide advanced" : `Advanced (${advanced.count})`}</button> : null}
      </div>
      {children}
      {adv && advanced ? <div style={{ marginTop: 8 }}>{advanced.body}</div> : null}
    </section>
  );
}

function QueueChips({ model, selfId, list, onToggle, label }) {
  return (
    <div className="field" style={{ gridColumn: "1/-1" }}><label>{label}</label>
      <div className="regoff" style={{ marginTop: 2 }}>
        {(model.queues || []).filter((x) => x.id !== selfId).map((x) => {
          const on = (list || []).includes(x.id);
          return <button key={x.id} className={"chip" + (on ? " on-toggle" : " off")} aria-pressed={on} onClick={() => onToggle(x.id)}>{x.name}</button>;
        })}
      </div>
    </div>
  );
}

function QueueDetail({ model, set, q, d }) {
  const st = q.staffing || {};
  const et = engineTypeOf(q);
  const DEF = engineQueueDefaults(q.homeBrandId || (model.brands[0] || {}).id || "b1", st.channel || (et.type === "voice" ? "voice" : "digital"));
  const eff = { ...DEF, ...st };
  const wf = { ...DEF.wf, ...(st.wf || {}) };
  const burn = { ...DEF.burn, ...(st.burn || {}) };
  const upd = (patch) => set(Ops.updateQueueStaffing(model, q.id, patch));
  const updWf = (patch) => upd({ wf: { ...wf, ...patch } });
  const updBurn = (patch) => upd({ burn: { ...burn, ...patch } });
  const updQ = (patch) => set(Ops.updateQueue(model, q.id, patch));
  const usage = queueUsage(model, q.id);
  const guard = canDeleteQueue(model, q.id);
  const voice = et.type === "voice";
  const hires = wf.hires || [];
  const setHires = (h) => updWf({ hires: h });
  return (
    <div className="mddetail" data-testid="queue-detail">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h4 style={{ marginRight: "auto" }}>{q.name}{q._modified ? <span className="moddot" style={{ marginLeft: 6 }} aria-label="modified" /> : null}</h4>
        <button className="btn sm" onClick={() => set(Ops.resetQueueStaffing(model, q.id))}>Reset to defaults</button>
        {guard.ok
          ? <button className="btn sm" style={{ color: "var(--red-ink)", borderColor: "#F0B4B4" }} onClick={() => set(Ops.deleteQueue(model, q.id))}>Delete</button>
          : <span className="hint blocked" style={{ marginLeft: 0 }} title={"Referenced by " + guardSummary(guard)}>▲ in use</span>}
      </div>
      <p className="hint derived-strip">Derived: <b className="num">{fmt(d ? d.volume : 0)}/day</b> · eff. AHT <b className="num">{fmt(d ? d.effectiveAht : q.fallbackAhtSec)} s</b>{d && d.ahtMarker !== "queue" ? ` (${d.ahtMarker})` : ""} · {usage.processes ? `used in ${usage.processes} process${usage.processes === 1 ? "" : "es"} across ${usage.brands} brand${usage.brands === 1 ? "" : "s"}` : "not used by any process yet"}</p>

      <Fam fam="inputs" name="Inputs" sum={`${QTYPE_LABELS[q.type] || q.type} · fallback AHT ${q.fallbackAhtSec} s`}
        advanced={{ count: voice ? 2 : 5, body: (
          <div className="fields">
            <NumF label="Priority" value={eff.priority} onChange={(v) => upd({ priority: n0(v) })} />
            {!voice ? <>
              <NumF label="Concurrency" value={eff.concurrency} onChange={(v) => upd({ concurrency: n0(v) })} />
              <NumF label="Backlog limit" value={eff.backlogLimit} onChange={(v) => upd({ backlogLimit: n0(v) })} />
              <div className="field"><label>Subtype</label>
                <select value={st.subtype || ""} aria-label="Subtype" onChange={(e) => upd({ subtype: e.target.value || undefined })}>
                  <option value="">Workflow (backlog)</option><option value="customer">Customer (live SLA)</option>
                </select></div>
            </> : null}
            <div className="field"><label>Deflects to</label>
              <select value={eff.deflectsTo || ""} aria-label="Deflects to" onChange={(e) => upd({ deflectsTo: e.target.value || null })}>
                <option value="">— none</option>
                {(model.queues || []).filter((x) => x.id !== q.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select></div>
          </div>
        ) }}>
        <div className="fields">
          <div className="field"><label>Name</label><input value={q.name} aria-label="Queue name" onChange={(e) => updQ({ name: e.target.value })} /></div>
          <div className="field"><label>Type</label>
            <select value={q.type} aria-label="Queue type" onChange={(e) => updQ({ type: e.target.value })}>
              {QUEUE_TYPES.map((t) => <option key={t} value={t}>{QTYPE_LABELS[t]}</option>)}
            </select></div>
          <div className="field"><label>Home brand</label>
            <select value={q.homeBrandId || ""} aria-label="Home brand" onChange={(e) => updQ({ homeBrandId: e.target.value || undefined })}>
              <option value="">— global</option>
              {(model.brands || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div className="field"><label>Home BU</label>
            <select value={q.homeBuId || ""} aria-label="Home BU" onChange={(e) => updQ({ homeBuId: e.target.value || undefined })}>
              <option value="">— global</option>
              {(model.businessUnits || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <NumF label="Fallback AHT (s)" value={q.fallbackAhtSec} onChange={(v) => updQ({ fallbackAhtSec: n0(v) })} />
        </div>
      </Fam>

      <Fam fam="performance" name="Performance" sum={voice ? `ASA ${eff.asaTarget} s · abandon ≤ ${Math.round(eff.maxAbandon * 100)}%` : `${eff.digitalSlaPct * 100}% in ${eff.digitalSlaMinutes} min`}>
        <div className="fields">
          {voice ? <>
            <NumF label="ASA target (s)" value={eff.asaTarget} onChange={(v) => upd({ asaTarget: n0(v) })} />
            <NumF label="Max abandon (%)" value={Math.round(eff.maxAbandon * 100)} onChange={(v) => upd({ maxAbandon: n0(v) / 100 })} />
          </> : <>
            <NumF label="SLA within (min)" value={eff.digitalSlaMinutes} onChange={(v) => upd({ digitalSlaMinutes: n0(v) })} />
            <NumF label="SLA target (%)" value={Math.round(eff.digitalSlaPct * 100)} onChange={(v) => upd({ digitalSlaPct: n0(v) / 100 })} />
          </>}
          <NumF label="Patience (s)" value={eff.patience} onChange={(v) => upd({ patience: n0(v) })} />
        </div>
      </Fam>

      <Fam fam="efficiency" name="Efficiency" sum={`occupancy ≤ ${Math.round((eff.occupancyCeiling ?? 0.85) * 100)}%`}
        advanced={{ count: 5, body: (
          <div className="fields">
            <NumF label="Burnout threshold (%)" value={Math.round(burn.occThreshold * 100)} onChange={(v) => updBurn({ occThreshold: n0(v) / 100 })} />
            <NumF label="Burnout sensitivity" value={burn.sensitivity} onChange={(v) => updBurn({ sensitivity: n0(v) })} />
            <NumF label="Recovery (weeks)" value={burn.recovery} onChange={(v) => updBurn({ recovery: n0(v) })} />
            <NumF label="Max attrition ×" value={burn.maxAttritionMult} onChange={(v) => updBurn({ maxAttritionMult: n0(v) })} />
            <NumF label="Absence uplift (%)" value={Math.round(burn.absenceUplift * 100)} onChange={(v) => updBurn({ absenceUplift: n0(v) / 100 })} />
          </div>
        ) }}>
        <div className="fields">
          <NumF label="Occupancy ceiling (%)" value={Math.round((eff.occupancyCeiling ?? 0.85) * 100)} onChange={(v) => upd({ occupancyCeiling: n0(v) / 100 })} />
        </div>
      </Fam>

      <Fam fam="workforce" name="Workforce" sum={`${eff.resourcing || "resourced"} · shrinkage ${Math.round(eff.shrinkage * 100)}%`}
        advanced={{ count: 4 + 1, body: (
          <>
            <div className="fields">
              <NumF label="Attrition growth (/mo)" value={wf.attritionGrowth} onChange={(v) => updWf({ attritionGrowth: n0(v) })} />
              <div className="field"><label>Learning curve (× by week)</label>
                <input value={(wf.learningCurve || []).join(", ")} aria-label="Learning curve"
                  onChange={(e) => updWf({ learningCurve: e.target.value.split(",").map((x) => +x.trim()).filter((x) => !isNaN(x)) })} /></div>
            </div>
            <QueueChips model={model} selfId={q.id} list={eff.crossSkill} label="Cross-skilled with"
              onToggle={(id) => upd({ crossSkill: (eff.crossSkill || []).includes(id) ? eff.crossSkill.filter((x) => x !== id) : [...(eff.crossSkill || []), id] })} />
            <QueueChips model={model} selfId={q.id} list={eff.supports} label="Supports (capacity link)"
              onToggle={(id) => upd({ supports: (eff.supports || []).includes(id) ? eff.supports.filter((x) => x !== id) : [...(eff.supports || []), id] })} />
            <div className="field" style={{ gridColumn: "1/-1", marginTop: 6 }}><label>Manual hires (S4 — week × heads)</label>
              {hires.map((h, i) => (
                <div className="mixrow" key={i}>
                  <span className="hint">week</span>
                  <input className="num" value={h.week} aria-label={`hire ${i + 1} week`} onChange={(e) => setHires(hires.map((x, j) => j === i ? { ...x, week: n0(e.target.value) } : x))} />
                  <span className="hint">heads</span>
                  <input className="num" value={h.heads} aria-label={`hire ${i + 1} heads`} onChange={(e) => setHires(hires.map((x, j) => j === i ? { ...x, heads: n0(e.target.value) } : x))} />
                  <button className="regdel" onClick={() => setHires(hires.filter((_, j) => j !== i))} aria-label={`remove hire ${i + 1}`}>✕</button>
                </div>
              ))}
              <div><button className="btn sm" onClick={() => setHires([...hires, { week: 1, heads: 1 }])}>+ Hire</button></div>
            </div>
          </>
        ) }}>
        <div className="fields">
          <div className="field"><label>Resourcing</label>
            <select value={eff.resourcing || "resourced"} aria-label="Resourcing" onChange={(e) => upd({ resourcing: e.target.value })}>
              <option value="resourced">Resourced — own headcount</option>
              <option value="dedicated">Dedicated</option>
              <option value="leveraged">Leveraged — shared pool</option>
              <option value="overflow_only">Overflow only</option>
            </select></div>
          <NumF label="Starting FTE" value={eff.fte != null ? eff.fte : ""} placeholder="— sized by strategy" onChange={(v) => upd({ fte: v === "" ? undefined : n0(v) })} />
          <NumF label="Shrinkage (%)" value={Math.round(eff.shrinkage * 100)} onChange={(v) => upd({ shrinkage: n0(v) / 100 })} />
          <NumF label="Attrition (%/mo)" value={Math.round(wf.attrition * 1000) / 10} onChange={(v) => updWf({ attrition: n0(v) / 100 })} />
          <NumF label="Req → start (weeks)" value={wf.reqToStart} onChange={(v) => updWf({ reqToStart: n0(v) })} />
          <NumF label="Training (weeks)" value={wf.trainingWeeks} onChange={(v) => updWf({ trainingWeeks: n0(v) })} />
        </div>
      </Fam>

      <Fam fam="customer" name="Customer" sum={`churn £${eff.churnCost ?? 500}`}>
        <div className="fields">
          <NumF label="Churn cost (£)" value={eff.churnCost ?? 500} onChange={(v) => upd({ churnCost: n0(v) })} />
          <NumF label="Failed → churn (%)" value={eff.failedToChurnPct ?? 6} onChange={(v) => upd({ failedToChurnPct: n0(v) })} />
        </div>
      </Fam>

      <Fam fam="outputs" name="Outputs" sum={`agent £${fmt(eff.agentCost)}/yr`}>
        <div className="fields">
          <NumF label="Agent cost (£/yr)" value={eff.agentCost} onChange={(v) => upd({ agentCost: n0(v) })} />
        </div>
      </Fam>
    </div>
  );
}

function TeamDetail({ model, set, team }) {
  const upd = (patch) => set(Ops.updateServiceTeam(model, team.id, patch));
  return (
    <div className="mddetail" data-testid="team-detail">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h4 style={{ marginRight: "auto" }}>{team.name}</h4>
        <button className="btn sm" style={{ color: "var(--red-ink)", borderColor: "#F0B4B4" }} onClick={() => set(Ops.deleteServiceTeam(model, team.id))}>Delete</button>
      </div>
      <p className="hint">Shared capacity — spills into the queues it covers when they run hot.</p>
      <div className="fields">
        <div className="field"><label>Name</label><input value={team.name} aria-label="Team name" onChange={(e) => upd({ name: e.target.value })} /></div>
        <NumF label="Size (FTE)" value={team.size} onChange={(v) => upd({ size: n0(v) })} />
        <NumF label="Premium (%)" value={Math.round((team.premiumPct || 0) * 100)} onChange={(v) => upd({ premiumPct: n0(v) / 100 })} />
        <NumF label="Proficiency (%)" value={Math.round((team.proficiency || 0) * 100)} onChange={(v) => upd({ proficiency: n0(v) / 100 })} />
        <NumF label="Trigger occupancy (%)" value={Math.round((team.triggerOccupancy || 0) * 100)} onChange={(v) => upd({ triggerOccupancy: n0(v) / 100 })} />
        <NumF label="Max hours (/wk)" value={team.maxHoursPerWeek} onChange={(v) => upd({ maxHoursPerWeek: n0(v) })} />
        <NumF label="Agent cost (£/yr)" value={team.agentCost} onChange={(v) => upd({ agentCost: n0(v) })} />
      </div>
      <div className="field" style={{ marginTop: 8 }}><label>Covers</label>
        <div className="regoff" style={{ marginTop: 2 }}>
          {(model.queues || []).map((x) => {
            const on = (team.coversQueues || []).includes(x.id);
            return <button key={x.id} className={"chip" + (on ? " on-toggle" : " off")} aria-pressed={on}
              onClick={() => upd({ coversQueues: on ? team.coversQueues.filter((i) => i !== x.id) : [...(team.coversQueues || []), x.id] })}>{x.name}</button>;
          })}
        </div>
      </div>
    </div>
  );
}

function QueuesPanel({ model, set, p }) {
  const queues = model.queues || [];
  const teams = (model.engineConfig && model.engineConfig.serviceTeams) || [];
  const [sel, setSel] = useState(queues[0] ? { kind: "queue", id: queues[0].id } : null);
  const q = sel && sel.kind === "queue" ? queues.find((x) => x.id === sel.id) : null;
  const team = sel && sel.kind === "team" ? teams.find((x) => x.id === sel.id) : null;
  // group by home: brand › BU · brand-only · Global
  const groups = [];
  const byKey = new Map();
  for (const x of queues) {
    const label = x.homeBrandId
      ? nameOf(model.brands, x.homeBrandId) + (x.homeBuId ? " › " + nameOf(model.businessUnits, x.homeBuId) : "")
      : "Global — no home";
    if (!byKey.has(label)) { byKey.set(label, []); groups.push(label); }
    byKey.get(label).push(x);
  }
  groups.sort((a, b) => (a === "Global — no home" ? 1 : b === "Global — no home" ? -1 : 0));
  return (
    <>
      <h3>Queues</h3>
      <p className="hint">Volume and effective AHT are derived — never entered here.</p>
      <div className="md">
        <div>
          {groups.map((label) => (
            <div className="mdgroup" key={label}>
              <p className="mdgrouplab">{label}</p>
              <div className="mdlist" role="listbox" aria-label={label}>
                {byKey.get(label).map((x) => {
                  const dx = p.queues.get(x.id);
                  const u = queueUsage(model, x.id);
                  const on = sel && sel.kind === "queue" && sel.id === x.id;
                  return (
                    <button key={x.id} role="option" aria-selected={on} className={on ? "on" : ""} onClick={() => setSel({ kind: "queue", id: x.id })}>
                      <b>{x.name}{x._modified ? <span className="moddot" style={{ marginLeft: 5 }} aria-label="modified" /> : null}</b>
                      <small>{QTYPE_LABELS[x.type] || x.type}{u.processes ? ` · ${u.processes} process${u.processes === 1 ? "" : "es"} · ${u.brands} brand${u.brands === 1 ? "" : "s"}` : " · unused"}</small>
                      <span className="qstats num">{fmt(dx ? dx.volume : 0)}/day · {fmt(dx ? dx.effectiveAht : x.fallbackAhtSec)} s{dx && dx.ahtMarker === "weighted" ? " · weighted" : dx && dx.ahtMarker === "svc" ? " · svc" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button className="btn sm" onClick={() => {
            const m2 = Ops.addQueue(model, { name: "New queue", type: "inbound_call" });
            set(m2); setSel({ kind: "queue", id: m2.queues[m2.queues.length - 1].id });
          }}>+ Queue</button>
          <div className="mdgroup">
            <p className="mdgrouplab">Shared capacity</p>
            <div className="mdlist" role="listbox" aria-label="Shared capacity">
              {teams.map((x) => {
                const on = sel && sel.kind === "team" && sel.id === x.id;
                return (
                  <button key={x.id} role="option" aria-selected={on} className={on ? "on" : ""} onClick={() => setSel({ kind: "team", id: x.id })}>
                    <b>{x.name}</b>
                    <small>service team · covers {(x.coversQueues || []).length} queue{(x.coversQueues || []).length === 1 ? "" : "s"}</small>
                    <span className="qstats num">{x.size} FTE</span>
                  </button>
                );
              })}
            </div>
            <button className="btn sm" style={{ marginTop: 4 }} disabled={!model.engineConfig} onClick={() => {
              const m2 = Ops.addServiceTeam(model, { name: "Shared team" });
              set(m2); setSel({ kind: "team", id: m2.engineConfig.serviceTeams[m2.engineConfig.serviceTeams.length - 1].id });
            }}>+ Shared team</button>
          </div>
        </div>
        {q ? <QueueDetail model={model} set={set} q={q} d={p.queues.get(q.id)} />
          : team ? <TeamDetail model={model} set={set} team={team} />
          : <div className="mddetail" data-testid="queue-detail"><p className="hint">Select a queue or shared team.</p></div>}
      </div>
    </>
  );
}

// ---- 3 · Request types — the heart: the only linking surface (U3) ------------
// Master–detail. Identity · assignment (empty ⇒ All, spelled out; V2 inline) ·
// AHT override · one process per enabled channel (entry step, splits, sampling
// on governance queues, terminal + outcome, editable outcome chips, the
// p/(1−p) multi-round rework figure computed per branch) with V3 live.
const fmtPct = (x) => (Math.round(x * 10) / 10).toLocaleString("en-GB");

function ToggleChips({ options, selected, onToggle, allLabel }) {
  return (
    <div className="regoff" style={{ marginTop: 4 }}>
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button key={o.id} className={"chip" + (on ? " on-toggle" : " off")} aria-pressed={on}
            onClick={() => onToggle(o.id)}>{on ? o.name : "+ " + o.name}</button>
        );
      })}
      {options.length === 0 ? <span className="hint">{allLabel}</span> : null}
    </div>
  );
}

function ProcessEditor({ model, set, rt, proc }) {
  const [newOutcome, setNewOutcome] = useState("");
  const chName = nameOf(model.channels, proc.channelId);
  const upd = (i, patch) => set(Ops.updateStep(model, rt.id, proc.channelId, i, patch));
  const noTerminal = (proc.steps || []).length > 0 && !proc.steps.some((s) => s.terminal);
  const hasGov = (proc.steps || []).some((s) => { const q = (model.queues || []).find((x) => x.id === s.queueId); return q && q.type === "governance"; });
  return (
    <div className="proc" data-testid={"process-" + rt.id + "-" + proc.channelId}>
      <div className="prochead">
        <span className="chip on-toggle">{chName}</span>
        <button className="regdel" onClick={() => set(Ops.deleteProcess(model, rt.id, proc.channelId))} aria-label={"Remove " + chName + " process"}>✕</button>
      </div>
      {(proc.steps || []).length === 0 ? <p className="hint" style={{ margin: "4px 0" }}>No steps yet — this process is inert until it routes somewhere.</p> : (
        <div className={"steps" + (hasGov ? " with-sample" : "")}>
          <div className="steprow head"><span /><span>Queue</span><span>Split %</span>{hasGov ? <span>Sample %</span> : null}<span>Ends</span><span>Outcome</span><span /></div>
          {(proc.steps || []).map((s, i) => {
            const q = (model.queues || []).find((x) => x.id === s.queueId);
            const gov = q && q.type === "governance";
            const p01 = (+s.splitPct || 0) / 100;
            const reworkTitle = p01 > 0 && p01 < 1
              ? `Routes ${s.splitPct}% of what reaches it. If this branch is rework, repeated rounds compound to an effective ${fmtPct((p01 / (1 - p01)) * 100)}%.`
              : undefined;
            return (
              <div className="steprow" key={i}>
                <span className="stepno">{i === 0 ? "entry" : i + 1}</span>
                <select value={s.queueId} onChange={(e) => upd(i, { queueId: e.target.value })} aria-label={`${rt.id} ${proc.channelId} step ${i + 1} queue`}>
                  {(model.queues || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <input className="num" value={s.splitPct} title={reworkTitle} onChange={(e) => upd(i, { splitPct: +e.target.value || 0 })} aria-label={`${rt.id} ${proc.channelId} step ${i + 1} split percent`} />
                {hasGov ? (gov
                  ? <input className="num" value={s.samplingPct != null ? s.samplingPct : ""} placeholder="—"
                      onChange={(e) => upd(i, { samplingPct: e.target.value === "" ? undefined : +e.target.value })} aria-label={`${rt.id} ${proc.channelId} step ${i + 1} sampling percent`} />
                  : <span className="stepdash">—</span>) : null}
                <input type="checkbox" checked={!!s.terminal} onChange={(e) => upd(i, { terminal: e.target.checked ? true : false })} aria-label={`${rt.id} ${proc.channelId} step ${i + 1} terminal`} />
                {s.terminal ? (
                  <select value={s.outcome || ""} onChange={(e) => upd(i, { outcome: e.target.value || undefined })} aria-label={`${rt.id} ${proc.channelId} step ${i + 1} outcome`}>
                    <option value="">outcome…</option>
                    {(proc.outcomes || []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : <span className="stepdash">—</span>}
                <button className="regdel" onClick={() => set(Ops.removeStep(model, rt.id, proc.channelId, i))} aria-label={`${rt.id} ${proc.channelId} remove step ${i + 1}`}>✕</button>
              </div>
            );
          })}
        </div>
      )}
      {noTerminal ? <p className="errmsg">✕ No terminal step — the process leads nowhere. Mark the final step "ends" and pick its outcome.</p> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
        <button className="btn sm" disabled={!(model.queues || []).length}
          onClick={() => set(Ops.addStep(model, rt.id, proc.channelId, { queueId: model.queues[0].id }))}>+ Step</button>
        <span className="hint" style={{ marginLeft: 8 }}>outcomes:</span>
        {(proc.outcomes || []).map((o) => {
          const used = (proc.steps || []).some((s) => s.outcome === o);
          return (
            <span className="chip" key={o}>{o}{used
              ? <small title="Referenced by a terminal step"> ·in use</small>
              : <button className="chipx" onClick={() => set(Ops.setOutcomes(model, rt.id, proc.channelId, proc.outcomes.filter((x) => x !== o)))} aria-label={"Remove outcome " + o}>✕</button>}
            </span>
          );
        })}
        <input className="outin" placeholder="add outcome…" value={newOutcome} onChange={(e) => setNewOutcome(e.target.value)} aria-label={`${rt.id} ${proc.channelId} new outcome`} />
        <button className="btn sm" disabled={!newOutcome.trim()} onClick={() => {
          const o = newOutcome.trim();
          if (o && !(proc.outcomes || []).includes(o)) set(Ops.setOutcomes(model, rt.id, proc.channelId, [...(proc.outcomes || []), o]));
          setNewOutcome("");
        }}>Add</button>
      </div>
    </div>
  );
}

function RequestTypesPanel({ model, set, p }) {
  const rts = model.requestTypes || [];
  const [sel, setSel] = useState(rts[0] ? rts[0].id : null);
  const rt = rts.find((x) => x.id === sel) || rts[0] || null;
  const rtErr = (x) => p.validation.errors.filter((e) => e.requestTypeId === x.id);
  const rtWarn = (x) => p.validation.warnings.filter((w) => (w.requestTypeIds || []).includes(x.id));
  const assignLine = (x) => {
    const b = (x.brandIds || []).length ? x.brandIds.map((i) => nameOf(model.brands, i)).join(", ") : "all brands";
    const u = (x.buIds || []).length ? x.buIds.map((i) => nameOf(model.businessUnits, i)).join(", ") : "all BUs";
    return b + " · " + u;
  };
  const offChannels = rt ? (model.channels || []).filter((c) => !(rt.processes || []).some((pr) => pr.channelId === c.id)) : [];
  const guard = rt ? canDeleteRequestType(model, rt.id) : { ok: true, blockedBy: [] };
  return (
    <>
      <h3>Request types</h3>
      <p className="hint">What customers ask for, and how each is processed. This is the only place brands, BUs, channels, groups, products and queues are wired together.</p>
      {rts.length === 0 ? <p className="hint">No request types yet.</p> : null}
      <div className="md">
        <div className="mdlist" role="listbox" aria-label="Request types">
          {rts.map((x) => {
            const errs = rtErr(x), warns = rtWarn(x);
            return (
              <button key={x.id} role="option" aria-selected={rt && rt.id === x.id} className={"rtrow" + (rt && rt.id === x.id ? " on" : "")} onClick={() => setSel(x.id)}>
                <b>{x.name} <span className={"glyph " + (errs.length ? "err" : warns.length ? "todo" : "ok")}>{errs.length ? "✕" : warns.length ? "▲" : "●"}</span></b>
                <small>{nameOf(model.processGroups, x.groupId) || "no group"}{x.productId ? " · " + nameOf(model.products, x.productId) : ""} · {assignLine(x)}</small>
                <small>{(x.processes || []).map((pr) => nameOf(model.channels, pr.channelId)).join(" · ") || "no processes"}</small>
              </button>
            );
          })}
          <button className="btn sm" style={{ marginTop: 4 }} onClick={() => {
            const m2 = Ops.addRequestType(model, { name: "New request type", groupId: (model.processGroups[0] || {}).id });
            set(m2); setSel(m2.requestTypes[m2.requestTypes.length - 1].id);
          }}>+ Request type</button>
        </div>
        <div className="mddetail" data-testid="rt-detail">
          {rt ? <>
            <h4>Identity</h4>
            <div className="fields">
              <div className="field"><label>Name</label><input value={rt.name} onChange={(e) => set(Ops.updateRequestType(model, rt.id, { name: e.target.value }))} aria-label="Request type name" /></div>
              <div className="field"><label>Activity</label>
                <select value={rt.activity} onChange={(e) => set(Ops.updateRequestType(model, rt.id, { activity: e.target.value }))}>
                  {ACTIVITIES.map((a) => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
                </select></div>
              <div className="field"><label>Product request</label>
                <select value={rt.productRequest} onChange={(e) => set(Ops.updateRequestType(model, rt.id, { productRequest: e.target.value }))}>
                  <option value="existing">Existing product</option><option value="new">New product</option>
                </select></div>
              <div className="field"><label>Process group</label>
                <select value={rt.groupId || ""} onChange={(e) => set(Ops.updateRequestType(model, rt.id, { groupId: e.target.value || undefined }))} aria-label="Process group">
                  <option value="">— none</option>
                  {(model.processGroups || []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select></div>
              <div className="field"><label>Product (optional)</label>
                <select value={rt.productId || ""} onChange={(e) => set(Ops.updateRequestType(model, rt.id, { productId: e.target.value || undefined }))} aria-label="Product">
                  <option value="">— none</option>
                  {(model.products || []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select></div>
              <div className="field"><label>AHT override (s) — optional</label>
                <input className="num" placeholder="— uses queue AHT" value={rt.ahtSec != null ? rt.ahtSec : ""}
                  onChange={(e) => set(Ops.updateRequestType(model, rt.id, { ahtSec: e.target.value === "" ? undefined : +e.target.value }))} aria-label="AHT override" /></div>
            </div>

            <h4 style={{ marginTop: 14 }}>Assignment</h4>
            <p className="hint">None selected = applies to all.</p>
            <ToggleChips options={model.brands || []} selected={rt.brandIds || []} allLabel="no brands defined yet"
              onToggle={(id) => set(Ops.setAssignment(model, rt.id, { brandIds: (rt.brandIds || []).includes(id) ? rt.brandIds.filter((x) => x !== id) : [...(rt.brandIds || []), id] }))} />
            <ToggleChips options={model.businessUnits || []} selected={rt.buIds || []} allLabel="no business units defined yet"
              onToggle={(id) => set(Ops.setAssignment(model, rt.id, { buIds: (rt.buIds || []).includes(id) ? rt.buIds.filter((x) => x !== id) : [...(rt.buIds || []), id] }))} />
            <p className="hint applies" data-testid="applies-line"><b>Applies to:</b> {assignLine(rt)}</p>
            {rtWarn(rt).map((w, i) => <p className="warnmsg" key={i}>▲ {w.message}</p>)}

            <h4 style={{ marginTop: 14 }}>Processes — one per channel</h4>
            {(rt.processes || []).map((pr) => <ProcessEditor key={pr.channelId} model={model} set={set} rt={rt} proc={pr} />)}
            {offChannels.length ? (
              <div className="regoff">
                {offChannels.map((c) => (
                  <button key={c.id} className="chip off" onClick={() => set(Ops.addProcess(model, rt.id, c.id))} aria-label={"Add " + c.name + " process"}>+ {c.name}</button>
                ))}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "0.5px solid var(--line)", paddingTop: 10 }}>
              {guard.ok
                ? <button className="btn sm" style={{ color: "var(--red-ink)", borderColor: "#F0B4B4" }} onClick={() => { set(Ops.deleteRequestType(model, rt.id)); setSel(null); }}>Delete request type</button>
                : <span className="hint blocked" style={{ marginLeft: 0 }}>▲ Delete blocked — referenced by {guardSummary(guard)}. Remove them first.</span>}
            </div>
          </> : null}
        </div>
      </div>
    </>
  );
}

// ---- 4 · Volume — the cascade grid (U5) --------------------------------------
// Rows are the spine (estate → brand → BU → request type → channel). Type a
// number at ANY row: it becomes an entered figure and everything beneath
// re-resolves live (entered finer figures act as weights; equal split
// otherwise; over-runs scaled AND flagged — V5). Provenance badge on every
// row. A row can also carry a 52-week series (typed, or expanded from a
// seasonality preset) — shapes cascade down and aggregate up to queues.
const PROV_LABELS = { entered: "entered", scaled: "scaled", equal: "equal split", sum: "sum", none: "—" };

function entryAt(model, scope) {
  const k = keyOf(scope || {});
  return (model.volumeEntries || []).find((e) => keyOf(e.scope || {}) === k);
}

function ShapeEditor({ model, set, scope, entry, daily }) {
  const [text, setText] = useState(entry && entry.weekly ? entry.weekly.map((v) => Math.round(v)).join(", ") : "");
  const [err, setErr] = useState(null);
  const apply = (weekly) => {
    const d = entry && entry.daily != null ? entry.daily : daily;
    set(Ops.setVolumeEntry(model, scope, { daily: d, weekly }));
  };
  return (
    <div className="shapebox" data-testid="shape-editor">
      <div className="regoff">
        {Object.keys(SEASONAL_PRESETS).map((name) => (
          <button key={name} className="chip off" onClick={() => {
            const d = (entry && entry.daily != null ? entry.daily : daily) || 0;
            if (name === "Flat") { set(Ops.setVolumeEntry(model, scope, { daily: d })); setText(""); setErr(null); return; }
            const preset = SEASONAL_PRESETS[name];
            const weekly = Array.from({ length: 52 }, (_, w) => Math.round(d * preset[Math.min(11, Math.floor((w * 12) / 52))]));
            apply(weekly); setText(weekly.join(", ")); setErr(null);
          }}>{name}</button>
        ))}
      </div>
      <textarea rows={2} value={text} placeholder="52 weekly values, comma-separated — or pick a preset"
        aria-label="Weekly series" onChange={(e) => setText(e.target.value)} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn sm" onClick={() => {
          const vals = text.split(/[\s,;]+/).filter(Boolean).map(Number);
          if (vals.length !== 52 || vals.some(isNaN)) { setErr(`need 52 numbers, got ${vals.filter((v) => !isNaN(v)).length}`); return; }
          apply(vals); setErr(null);
        }}>Apply series</button>
        {err ? <span className="hint" style={{ color: "var(--red-ink)" }}>✕ {err}</span> : null}
      </div>
    </div>
  );
}

function VolRow({ model, set, level, name, scope, node, hasOwnShape, inheritsShape }) {
  const [shapeOpen, setShapeOpen] = useState(false);
  const entry = entryAt(model, scope);
  const total = node ? node.total : 0;
  const prov = node ? node.prov : "none";
  const shown = total ? Math.round(total * 10) / 10 : (prov === "entered" ? 0 : "");
  return (
    <>
      <div className={"volrow lvl" + level} data-key={keyOf(scope)}>
        <span className="volname" style={{ paddingLeft: level * 18 }}>{name}</span>
        <input className="num" value={shown === "" ? "" : shown} placeholder="—" aria-label={"Volume at " + name}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (v === "") set(Ops.clearVolumeEntry(model, scope));
            else set(Ops.setVolumeEntry(model, scope, { daily: +v || 0, ...(entry && entry.weekly ? { weekly: entry.weekly } : {}) }));
          }} />
        <span className={"prov " + prov}>{PROV_LABELS[prov] || prov}{prov === "scaled" ? " ▲" : ""}</span>
        <button className={"linkbtn shapecell" + (hasOwnShape ? " set" : "")} onClick={() => setShapeOpen(!shapeOpen)} aria-expanded={shapeOpen}
          aria-label={"Shape at " + name}>
          {hasOwnShape ? "52-wk ●" : inheritsShape ? "inherited" : "flat"}
        </button>
      </div>
      {shapeOpen ? <ShapeEditor model={model} set={set} scope={scope} entry={entry} daily={total} /> : null}
    </>
  );
}

function VolumePanel({ model, set, p }) {
  // Spine tree from the resolved leaves (assignment-driven).
  const rows = [];
  const seen = new Set();
  const hasShapeAt = (scope) => { const e = entryAt(model, scope); return !!(e && e.weekly); };
  rows.push({ level: 0, name: "Whole estate", scope: {} });
  for (const leaf of p.leaves) {
    const bKey = leaf.brandId;
    if (!seen.has(bKey)) { seen.add(bKey); rows.push({ level: 1, name: nameOf(model.brands, leaf.brandId), scope: { brandId: leaf.brandId } }); }
    const buKey = leaf.brandId + "|" + leaf.buId;
    if (!seen.has(buKey)) { seen.add(buKey); rows.push({ level: 2, name: nameOf(model.businessUnits, leaf.buId), scope: { brandId: leaf.brandId, buId: leaf.buId } }); }
    const rtKey = buKey + "|" + leaf.requestTypeId;
    if (!seen.has(rtKey)) { seen.add(rtKey); rows.push({ level: 3, name: leaf.rt.name, scope: { brandId: leaf.brandId, buId: leaf.buId, requestTypeId: leaf.requestTypeId } }); }
    rows.push({ level: 4, name: nameOf(model.channels, leaf.channelId), scope: { brandId: leaf.brandId, buId: leaf.buId, requestTypeId: leaf.requestTypeId, channelId: leaf.channelId } });
  }
  const uncovered = p.validation.warnings.filter((w) => w.kind === "uncovered_volume");
  return (
    <>
      <h3>Volume</h3>
      <p className="hint">Type at any row — the highest entered figure is authoritative beneath it; entered finer figures act as weights; the rest split equally. Nothing reconciles silently.</p>
      {rows.length <= 1 ? <p className="hint">Assign request types first — the spine builds itself from them.</p> : (
        <div className="scrollx">
          <div className="volgrid" data-testid="cascade-grid">
            <div className="volrow head"><span className="volname">Spine</span><span>Daily</span><span>Provenance</span><span>Shape</span></div>
            {rows.map((r) => {
              const anc = [];
              if (r.scope.brandId) {
                anc.push({});
                anc.push({ brandId: r.scope.brandId });
                if (r.scope.buId) anc.push({ brandId: r.scope.brandId, buId: r.scope.buId });
                if (r.scope.requestTypeId) anc.push({ brandId: r.scope.brandId, buId: r.scope.buId, requestTypeId: r.scope.requestTypeId });
                anc.pop(); // self is not an ancestor
              }
              return (
                <VolRow key={keyOf(r.scope)} model={model} set={set} level={r.level} name={r.name} scope={r.scope}
                  node={p.nodes.get(keyOf(r.scope))} hasOwnShape={hasShapeAt(r.scope)}
                  inheritsShape={anc.some((a) => hasShapeAt(a))} />
              );
            })}
          </div>
        </div>
      )}
      {(p.notes || []).length || uncovered.length ? (
        <div className="valpanel" data-testid="volume-notes">
          {(p.notes || []).map((n, i) => <p key={"n" + i} className="warnmsg">▲ {n.message || String(n)}</p>)}
          {uncovered.map((w, i) => <p key={"u" + i} className="warnmsg">▲ {w.message}</p>)}
        </div>
      ) : null}
    </>
  );
}

// ---- 5 · Map — a pure generated artefact (U6) --------------------------------
// Nothing is authored here, ever. Queues are nodes placed by journey depth;
// flow edges come entirely from process steps (split % · sampling); capacity-
// sharing (supports, cross-skill, service teams) draws DASHED, visually
// distinct from flow. The validation panel lives here, each issue with a
// jump-link to the tab that fixes it.
const NODE_W = 168, NODE_H = 52, COL_W = 212, ROW_H = 76;

function buildMap(model, p) {
  const depth = new Map();
  for (const rt of model.requestTypes || [])
    for (const proc of rt.processes || [])
      proc.steps.forEach((s, i) => {
        if (!depth.has(s.queueId) || i < depth.get(s.queueId)) depth.set(s.queueId, i);
      });
  const maxD = Math.max(0, ...depth.values());
  const cols = [];
  for (const q of model.queues || []) {
    const d = depth.has(q.id) ? depth.get(q.id) : maxD + 1;
    (cols[d] = cols[d] || []).push(q);
  }
  const pos = new Map();
  cols.forEach((col, d) => (col || []).forEach((q, i) => pos.set(q.id, { x: 20 + d * COL_W, y: 24 + i * ROW_H })));
  const teams = (model.engineConfig && model.engineConfig.serviceTeams) || [];
  const teamY = 24 + Math.max(1, ...cols.map((c) => (c || []).length)) * ROW_H + 10;
  teams.forEach((tm, i) => pos.set("team:" + tm.id, { x: 20 + i * COL_W, y: teamY }));

  const flow = [], seenF = new Set();
  for (const rt of model.requestTypes || [])
    for (const proc of rt.processes || [])
      for (let i = 0; i + 1 < proc.steps.length; i++) {
        const s = proc.steps[i + 1];
        const label = s.splitPct + "%" + (s.samplingPct != null ? " · sample " + s.samplingPct + "%" : "");
        const k = proc.steps[i].queueId + ">" + s.queueId + ">" + label;
        if (!seenF.has(k)) { seenF.add(k); flow.push({ from: proc.steps[i].queueId, to: s.queueId, label }); }
      }
  const cap = [], seenC = new Set();
  for (const q of model.queues || []) {
    const st = q.staffing || {};
    for (const t of st.supports || []) { const k = q.id + ">" + t; if (pos.has(t) && !seenC.has(k)) { seenC.add(k); cap.push({ from: q.id, to: t, label: "supports" }); } }
    for (const t of st.crossSkill || []) { const k = [q.id, t].sort().join(">"); if (pos.has(t) && !seenC.has(k)) { seenC.add(k); cap.push({ from: q.id, to: t, label: "cross-skill" }); } }
  }
  for (const tm of teams)
    for (const t of tm.coversQueues || [])
      if (pos.has(t)) cap.push({ from: "team:" + tm.id, to: t, label: "covers" });
  const width = 40 + (maxD + 2) * COL_W;
  const height = teamY + (teams.length ? NODE_H + 30 : 6);
  return { pos, flow, cap, teams, width, height };
}

function MapPanel({ model, p, onJump }) {
  const { ok, errors, warnings } = p.validation;
  const [selQ, setSelQ] = useState(null);
  const m = buildMap(model, p);
  const center = (id) => { const c = m.pos.get(id); return c ? { cx: c.x + NODE_W / 2, cy: c.y + NODE_H / 2 } : null; };
  const edge = (e, i, dashed) => {
    const a = center(e.from), b = center(e.to);
    if (!a || !b) return null;
    const midX = (a.cx + b.cx) / 2, midY = (a.cy + b.cy) / 2;
    return (
      <g key={(dashed ? "c" : "f") + i} className={dashed ? "medge cap" : "medge flow"}>
        <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} strokeDasharray={dashed ? "5 4" : undefined} markerEnd={dashed ? undefined : "url(#arr)"} />
        <text x={midX} y={midY - 4}>{e.label}</text>
      </g>
    );
  };
  const issues = [
    ...errors.map((e) => ({ tone: "err", message: e.message, tab: "requestTypes", tabName: "Request types" })),
    ...warnings.map((w) => ({
      tone: "warn", message: w.message,
      tab: w.kind === "uncovered_volume" ? "volume" : "requestTypes",
      tabName: w.kind === "uncovered_volume" ? "Volume" : "Request types",
    })),
    ...(p.notes || []).map((n) => ({ tone: "warn", message: n.message, tab: "volume", tabName: "Volume" })),
  ];
  const selected = selQ && (model.queues || []).find((x) => x.id === selQ);
  return (
    <>
      <h3>Map</h3>
      <p className="hint">Generated from the model on every view — flow from process steps, capacity links dashed. Nothing is authored here.</p>
      {(model.queues || []).length === 0 ? <p className="hint">The map draws itself once queues and processes exist.</p> : (
        <div className="scrollx">
          <svg className="mapsvg" data-testid="map-svg" width={m.width} height={m.height} viewBox={`0 0 ${m.width} ${m.height}`}>
            <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="var(--ink-3)" /></marker></defs>
            {m.flow.map((e, i) => edge(e, i, false))}
            {m.cap.map((e, i) => edge(e, i, true))}
            {(model.queues || []).map((q) => {
              const c = m.pos.get(q.id);
              const d = p.queues.get(q.id);
              return (
                <g key={q.id} className={"mnode" + (selQ === q.id ? " on" : "")} onClick={() => setSelQ(selQ === q.id ? null : q.id)} data-node={q.id}>
                  <rect x={c.x} y={c.y} width={NODE_W} height={NODE_H} rx="9" />
                  <text className="mname" x={c.x + 10} y={c.y + 21}>{q.name.length > 22 ? q.name.slice(0, 21) + "…" : q.name}</text>
                  <text className="mmeta" x={c.x + 10} y={c.y + 38}>{fmt(d ? d.volume : 0)}/day · {QTYPE_LABELS[q.type] || q.type}</text>
                </g>
              );
            })}
            {m.teams.map((tm) => {
              const c = m.pos.get("team:" + tm.id);
              return (
                <g key={tm.id} className="mnode team" data-node={"team:" + tm.id}>
                  <rect x={c.x} y={c.y} width={NODE_W} height={NODE_H} rx="9" strokeDasharray="5 4" />
                  <text className="mname" x={c.x + 10} y={c.y + 21}>{tm.name}</text>
                  <text className="mmeta" x={c.x + 10} y={c.y + 38}>{tm.size} FTE shared</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      {selected ? (
        <div className="valpanel" data-testid="map-node-detail">
          <p style={{ fontSize: 12.5 }}><b>{selected.name}</b> · {QTYPE_LABELS[selected.type] || selected.type} · {fmt((p.queues.get(selected.id) || {}).volume || 0)}/day
            <button className="btn sm" style={{ marginLeft: 10 }} onClick={() => onJump && onJump("queues")}>Edit in Queues</button></p>
        </div>
      ) : null}
      <div className="valpanel" data-testid="validation-panel">
        {ok && !warnings.length && !(p.notes || []).length ? <p className="okmsg">● No issues — every process reaches an end point and every reference resolves.</p> : null}
        {issues.map((it, i) => (
          <p key={i} className={it.tone === "err" ? "errmsg" : "warnmsg"} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ flex: 1 }}>{it.tone === "err" ? "✕" : "▲"} {it.message}</span>
            <button className="linkbtn" onClick={() => onJump && onJump(it.tab)}>Fix in {it.tabName} →</button>
          </p>
        ))}
      </div>
    </>
  );
}

// ---- 6 · Defaults — what everything inherits (U6) ----------------------------
// One scrolling form over the engineConfig carry: A simulation frame ·
// C workforce policy · D overtime · E cost model · F customer behaviour ·
// I pattern libraries (applied in Volume). Channel defaults live in
// Structure; service teams in Queues; risk thresholds read in Results.
function G({ name, children }) {
  return <section className="fam-sec"><div className="famhead"><b>{name}</b></div><div className="fields">{children}</div></section>;
}
function DefaultsPanel({ model, set }) {
  const ec = model.engineConfig;
  if (!ec) return (
    <>
      <h3>Defaults</h3>
      <p className="warnmsg">▲ No engine defaults attached — import a model or start from the sample.</p>
    </>
  );
  const eng = ec.engine || {}, hiring = ec.hiring || {}, costs = ec.costs || {}, cx = ec.cx || {};
  const ot = ((ec.settings || {}).ot) || { maxDailyHours: 2, weeklyCeiling: 10, premium: 1.5, burnoutLoad: 10 };
  const season = ec.seasonality || { startMonth: 0, system: new Array(12).fill(1) };
  const updEC = (block, patch) => {
    const m = JSON.parse(JSON.stringify(model));
    m.engineConfig[block] = { ...(m.engineConfig[block] || {}), ...patch };
    set(m);
  };
  const updOt = (patch) => {
    const m = JSON.parse(JSON.stringify(model));
    m.engineConfig.settings = m.engineConfig.settings || {};
    m.engineConfig.settings.ot = { ...ot, ...patch };
    set(m);
  };
  const presetName = Object.keys(SEASONAL_PRESETS).find((k) => JSON.stringify(SEASONAL_PRESETS[k]) === JSON.stringify(season.system)) || "";
  return (
    <>
      <h3>Defaults</h3>
      <p className="hint">Global physics every queue inherits unless it overrides them. Channel defaults live in Structure; shared teams in Queues.</p>
      <G name="Simulation frame">
        <NumF label="Horizon (weeks)" value={eng.horizonWeeks} onChange={(v) => updEC("engine", { horizonWeeks: n0(v) })} />
        <NumF label="Day start (h)" value={eng.dayStart} onChange={(v) => updEC("engine", { dayStart: n0(v) })} />
        <NumF label="Day end (h)" value={eng.dayEnd} onChange={(v) => updEC("engine", { dayEnd: n0(v) })} />
        <NumF label="Interval (min)" value={eng.intervalMin} onChange={(v) => updEC("engine", { intervalMin: n0(v) })} />
        <NumF label="Days per week" value={eng.daysPerWeek} onChange={(v) => updEC("engine", { daysPerWeek: n0(v) })} />
        <NumF label="Hours per FTE day" value={eng.hoursPerFteDay} onChange={(v) => updEC("engine", { hoursPerFteDay: n0(v) })} />
        <NumF label="Days worked per FTE" value={eng.daysWorkedPerFte} onChange={(v) => updEC("engine", { daysWorkedPerFte: n0(v) })} />
        <NumF label="Occupancy ceiling (%)" value={Math.round((eng.occupancyCeiling || 0.85) * 100)} onChange={(v) => updEC("engine", { occupancyCeiling: n0(v) / 100 })} />
        <NumF label="Cross-skill proficiency (%)" value={Math.round((eng.crossSkillProficiency || 0.9) * 100)} onChange={(v) => updEC("engine", { crossSkillProficiency: n0(v) / 100 })} />
        <div className="field"><label>Currency</label><input value={eng.currency || "£"} aria-label="Currency" onChange={(e) => updEC("engine", { currency: e.target.value })} /></div>
      </G>
      <G name="Workforce policy">
        <NumF label="Hiring cap (/wk)" value={hiring.cap} onChange={(v) => updEC("hiring", { cap: n0(v) })} />
        <NumF label="Hiring buffer (%)" value={Math.round((hiring.buffer || 0) * 100)} onChange={(v) => updEC("hiring", { buffer: n0(v) / 100 })} />
      </G>
      <G name="Overtime">
        <NumF label="Max OT (h/day)" value={ot.maxDailyHours} onChange={(v) => updOt({ maxDailyHours: n0(v) })} />
        <NumF label="OT ceiling (h/wk)" value={ot.weeklyCeiling} onChange={(v) => updOt({ weeklyCeiling: n0(v) })} />
        <NumF label="OT premium (×)" value={ot.premium} onChange={(v) => updOt({ premium: n0(v) })} />
        <NumF label="OT burnout load" value={ot.burnoutLoad} onChange={(v) => updOt({ burnoutLoad: n0(v) })} />
      </G>
      <G name="Cost model">
        <NumF label="Manager cost (£/yr)" value={costs.managerCost} onChange={(v) => updEC("costs", { managerCost: n0(v) })} />
        <NumF label="Manager ratio (1:n)" value={costs.managerRatio} onChange={(v) => updEC("costs", { managerRatio: n0(v) })} />
      </G>
      <G name="Customer behaviour">
        <NumF label="Customer base" value={cx.customerBase} onChange={(v) => updEC("cx", { customerBase: n0(v) })} />
        <NumF label="Cost per lost customer (£)" value={cx.costPerLostCustomer} onChange={(v) => updEC("cx", { costPerLostCustomer: n0(v) })} />
        <NumF label="Churn on abandon (%)" value={Math.round((cx.churnAbandon || 0) * 1000) / 10} onChange={(v) => updEC("cx", { churnAbandon: n0(v) / 100 })} />
        <NumF label="Churn on long wait (%)" value={Math.round((cx.churnWait || 0) * 1000) / 10} onChange={(v) => updEC("cx", { churnWait: n0(v) / 100 })} />
        <NumF label="Churn on digital miss (%)" value={Math.round((cx.churnDigital || 0) * 1000) / 10} onChange={(v) => updEC("cx", { churnDigital: n0(v) / 100 })} />
        <NumF label="Repeat uplift (×)" value={cx.repeatUplift} onChange={(v) => updEC("cx", { repeatUplift: n0(v) })} />
      </G>
      <G name="Pattern libraries">
        <div className="field"><label>System seasonality</label>
          <select value={presetName} aria-label="System seasonality" onChange={(e) => {
            const nm = e.target.value;
            if (nm) updEC("seasonality", { system: [...SEASONAL_PRESETS[nm]] });
          }}>
            {presetName === "" ? <option value="">custom</option> : null}
            {Object.keys(SEASONAL_PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select></div>
        <NumF label="Season start month (0–11)" value={season.startMonth} onChange={(v) => updEC("seasonality", { startMonth: n0(v) })} />
        <div className="field" style={{ gridColumn: "1/-1" }}><label>Presets</label>
          <p className="hint">The same library powers the shape chips on the Volume tab.</p></div>
      </G>
    </>
  );
}
