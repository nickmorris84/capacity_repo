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
import { queueUsage, canDeleteBrand, canDeleteBU, canDeleteChannel, canDeleteGroup, canDeleteProduct, canDeleteRequestType } from "../../model/domain.js";
import { CHANNELS } from "../../model/taxonomy.js";
import * as Ops from "../../model/ops.js";
import { QTYPE_LABELS, CHANNEL_LABELS, ACTIVITIES, ACTIVITY_LABELS } from "./model.js";

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
        {tab === "queues" && <QueuesPanel model={model} p={p} />}
        {tab === "requestTypes" && <RequestTypesPanel model={model} set={onModelChange} p={p} />}
        {tab === "volume" && <VolumePanel model={model} p={p} />}
        {tab === "map" && <MapPanel p={p} />}
        {tab === "defaults" && <DefaultsPanel model={model} />}
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

// ---- 2 · Queues — the master–detail scaffold (deep editor lands in U4) -------
function QueuesPanel({ model, p }) {
  const queues = model.queues || [];
  const [sel, setSel] = useState(queues[0] ? queues[0].id : null);
  const q = queues.find((x) => x.id === sel);
  const d = q ? p.queues.get(q.id) : null;
  const usage = q ? queueUsage(model, q.id) : null;
  return (
    <>
      <h3>Queues</h3>
      <p className="hint">The stations and their physics. Volume and effective AHT are derived — never entered here.</p>
      {queues.length === 0 ? <p className="hint">No queues yet.</p> : (
        <div className="md">
          <div className="mdlist" role="listbox" aria-label="Queues">
            {queues.map((x) => {
              const dx = p.queues.get(x.id);
              return (
                <button key={x.id} role="option" aria-selected={sel === x.id} className={sel === x.id ? "on" : ""} onClick={() => setSel(x.id)}>
                  <b>{x.name}</b>
                  <small>{QTYPE_LABELS[x.type] || x.type}</small>
                  <span className="qstats num">{fmt(dx ? dx.volume : 0)}/day · {fmt(dx ? dx.effectiveAht : x.fallbackAhtSec)} s{dx && dx.ahtMarker === "weighted" ? " · weighted" : dx && dx.ahtMarker === "svc" ? " · svc" : ""}</span>
                </button>
              );
            })}
          </div>
          <div className="mddetail" data-testid="queue-detail">
            {q ? <>
              <h4>{q.name}</h4>
              <p className="hint">{QTYPE_LABELS[q.type] || q.type}{q.homeBrandId ? ` · ${nameOf(model.brands, q.homeBrandId)}` : ""}{q.homeBuId ? ` › ${nameOf(model.businessUnits, q.homeBuId)}` : ""}</p>
              <div className="kv"><span>Derived volume/day</span><b className="num">{fmt(d ? d.volume : 0)}</b></div>
              <div className="kv"><span>Effective AHT</span><b className="num">{fmt(d ? d.effectiveAht : q.fallbackAhtSec)} s{d && d.ahtMarker !== "queue" ? ` · ${d.ahtMarker}` : ""}</b></div>
              <div className="kv"><span>Fallback AHT</span><b className="num">{fmt(q.fallbackAhtSec)} s</b></div>
              <div className="kv"><span>Staffing</span><b>{q.staffing && q.staffing.wf ? "full physics carried" : q._modified ? "tuned" : "defaults"}</b></div>
              <p className="usage">{usage && usage.processes ? `Used in ${usage.processes} process${usage.processes === 1 ? "" : "es"} across ${usage.brands} brand${usage.brands === 1 ? "" : "s"}.` : "Not used by any process yet."}</p>
            </> : null}
          </div>
        </div>
      )}
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

// ---- 4 · Volume — entries + cascade summary (grid lands in U5) ---------------
function VolumePanel({ model, p }) {
  const label = (scope) => {
    const parts = [];
    if (scope.brandId) parts.push(nameOf(model.brands, scope.brandId));
    if (scope.buId) parts.push(nameOf(model.businessUnits, scope.buId));
    if (scope.requestTypeId) parts.push(nameOf(model.requestTypes, scope.requestTypeId));
    if (scope.channelId) parts.push(nameOf(model.channels, scope.channelId));
    return parts.join(" › ") || "Whole estate";
  };
  return (
    <>
      <h3>Volume</h3>
      <p className="hint">State how much arrives, at whatever granularity you know. Totals cascade down; entered finer figures act as weights; equal split otherwise.</p>
      {(model.volumeEntries || []).length === 0 ? <p className="hint">No entries yet.</p> : (
        <div className="scrollx"><table className="vtable">
          <thead><tr><th>Applies at</th><th className="num">Daily</th><th>Shape</th></tr></thead>
          <tbody>
            {model.volumeEntries.map((e, i) => (
              <tr key={e.id || i}>
                <td>{label(e.scope || {})}</td>
                <td className="num">{fmt(e.daily)}</td>
                <td>{e.weekly ? "52-week series" : "flat"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {(p.notes || []).length ? <div className="valpanel">
        {p.notes.map((n, i) => <p key={i} className="warnmsg">▲ {n.message || String(n)}</p>)}
      </div> : null}
    </>
  );
}

// ---- 5 · Map — validation panel (the generated visual lands in U6) -----------
function MapPanel({ p }) {
  const { ok, errors, warnings } = p.validation;
  return (
    <>
      <h3>Map</h3>
      <p className="hint">Prove the world hangs together — generated from the model, nothing authored here.</p>
      <div className="valpanel" data-testid="validation-panel">
        {ok && !warnings.length ? <p className="okmsg">● No issues — every process reaches an end point and every reference resolves.</p> : null}
        {errors.map((e, i) => <p key={"e" + i} className="errmsg">✕ {e.message}</p>)}
        {warnings.map((w, i) => <p key={"w" + i} className="warnmsg">▲ {w.message}</p>)}
      </div>
    </>
  );
}

// ---- 6 · Defaults — the physics everything inherits --------------------------
function DefaultsPanel({ model }) {
  const ec = model.engineConfig;
  const eng = (ec && ec.engine) || {};
  return (
    <>
      <h3>Defaults</h3>
      <p className="hint">Global physics every queue inherits unless it overrides them.</p>
      {!ec ? <p className="warnmsg">▲ No engine defaults attached — import a model or start from the sample.</p> : <>
        <div className="kv"><span>Horizon</span><b className="num">{eng.horizonWeeks || 52} weeks</b></div>
        <div className="kv"><span>Operating day</span><b className="num">{eng.dayStart}:00 – {eng.dayEnd}:00 · {eng.intervalMin}-min intervals</b></div>
        <div className="kv"><span>Occupancy ceiling</span><b className="num">{Math.round((eng.occupancyCeiling || 0.85) * 100)}%</b></div>
        <div className="kv"><span>FTE basis</span><b className="num">{eng.hoursPerFteDay} h/day · {eng.daysWorkedPerFte} days/wk</b></div>
        <div className="kv"><span>Hiring</span><b className="num">cap {(ec.hiring || {}).cap} · buffer {Math.round(((ec.hiring || {}).buffer || 0) * 100)}%</b></div>
      </>}
    </>
  );
}
