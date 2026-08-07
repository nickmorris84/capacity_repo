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
import { queueUsage } from "../../model/domain.js";
import { QTYPE_LABELS } from "./model.js";

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

      {firstTodo
        ? <div className="pstrip" role="status"><span className="glyph todo">▲</span><span><b>Next:</b> {firstTodo.next}</span>
            <button className="btn sm" onClick={() => setTab(firstTodo.key)}>Go</button></div>
        : <div className="pstrip done" role="status"><span className="glyph ok">●</span><span>Model complete — every tab checks out.</span></div>}

      <div className="subtabs" role="tablist" aria-label="Setup tabs">
        {SETUP_TABS.map(([k, label]) => {
          const s = status.find((x) => x.key === k);
          return (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              <span className={"glyph " + (s.ok ? "ok" : "todo")}>{s.ok ? "●" : "▲"}</span>
              {label}
              <span className="count">{s.badge}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" data-tab={tab} className="panel">
        {tab === "structure" && <StructurePanel model={model} />}
        {tab === "queues" && <QueuesPanel model={model} p={p} />}
        {tab === "requestTypes" && <RequestTypesPanel model={model} />}
        {tab === "volume" && <VolumePanel model={model} p={p} />}
        {tab === "map" && <MapPanel p={p} />}
        {tab === "defaults" && <DefaultsPanel model={model} />}
      </div>
    </div>
  );
}

const nameOf = (list, id) => { const e = (list || []).find((x) => x.id === id); return e ? e.name : id; };

// ---- 1 · Structure — the five flat lists (registry; editors land in U2) ------
function StructurePanel({ model }) {
  const lists = [
    ["Brands", model.brands], ["Business units", model.businessUnits], ["Channels", model.channels],
    ["Process groups", model.processGroups], ["Products", model.products],
  ];
  return (
    <>
      <h3>Structure</h3>
      <p className="hint">The vocabulary of the estate — five independent lists, nothing interlinked. Request types is where they meet.</p>
      {lists.map(([title, list]) => (
        <div className="reglist" key={title}>
          <div className="reghead"><b>{title}</b><span className="count">{(list || []).length}</span></div>
          <div className="regchips">
            {(list || []).length === 0 ? <span className="hint">none yet</span>
              : list.map((e) => <span className="chip" key={e.id}>{e.name}{e.defaults ? <small> · defaults set</small> : null}</span>)}
          </div>
        </div>
      ))}
      <p className="phase-note">Add · rename · delete-with-guard lands in the next build phase.</p>
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
              <p className="phase-note">The full editor — six families × three tiers, manual hires, shared capacity — lands in a later phase.</p>
            </> : null}
          </div>
        </div>
      )}
    </>
  );
}

// ---- 3 · Request types — the only linking surface (editor lands in U3) -------
function RequestTypesPanel({ model }) {
  const chName = (id) => nameOf(model.channels, id);
  const qName = (id) => nameOf(model.queues, id);
  return (
    <>
      <h3>Request types</h3>
      <p className="hint">What customers ask for, and how each is processed — per channel, one specific journey.</p>
      {(model.requestTypes || []).length === 0 ? <p className="hint">No request types yet.</p> : null}
      {(model.requestTypes || []).map((rt) => (
        <div className="rtcard" key={rt.id}>
          <div className="rthead">
            <b>{rt.name}</b>
            <span className="tax">{(rt.brandIds || []).length ? rt.brandIds.map((b) => nameOf(model.brands, b)).join(", ") : "All brands"} · {(rt.buIds || []).length ? rt.buIds.map((b) => nameOf(model.businessUnits, b)).join(", ") : "All BUs"}</span>
            {rt.ahtSec != null ? <span className="tax num">AHT {rt.ahtSec} s</span> : null}
          </div>
          {(rt.processes || []).map((proc) => (
            <div className="procline" key={proc.channelId}>
              <span className="chip on-toggle">{chName(proc.channelId)}</span>
              <span className="chain num">
                {(proc.steps || []).length === 0 ? "no steps yet"
                  : proc.steps.map((s, i) => `${qName(s.queueId)} ${s.splitPct}%${s.samplingPct != null ? ` (sample ${s.samplingPct}%)` : ""}${s.terminal ? ` ✓ ${s.outcome || "ends"}` : ""}`).join(" → ")}
              </span>
              <span className="hint">outcomes: {(proc.outcomes || []).join(" · ") || "—"}</span>
            </div>
          ))}
        </div>
      ))}
      <p className="phase-note">Identity · assignment · the per-channel process editor land in a later phase.</p>
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
        <table className="vtable">
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
        </table>
      )}
      {(p.notes || []).length ? <div className="valpanel">
        {p.notes.map((n, i) => <p key={i} className="warnmsg">▲ {n.message || String(n)}</p>)}
      </div> : null}
      <p className="phase-note">The cascade grid — spine rows, type-anywhere, provenance badges, shapes — lands in a later phase.</p>
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
      <p className="phase-note">The visual map — flow edges from process steps, dashed capacity links — lands in a later phase.</p>
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
      <p className="phase-note">The full Defaults form (categories A·C·D·E·F·I) lands in a later phase.</p>
    </>
  );
}
