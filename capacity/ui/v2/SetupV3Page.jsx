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
import { useState, useMemo, useRef, useEffect } from "react";
import { propagateDomain } from "../../model/propagate.js";
import { queueUsage, keyOf, processesOf, canDeleteBrand, canDeleteBU, canDeleteChannel, canDeleteGroup, canDeleteProduct, canDeleteRequestType, canDeleteQueue } from "../../model/domain.js";
import { SEASONAL_PRESETS } from "../../engine/engine.js";
import { CHANNELS } from "../../model/taxonomy.js";
import { engineTypeOf, engineQueueDefaults } from "../../model/bridge.js";
import * as Ops from "../../model/ops.js";
import { QTYPE_LABELS, CHANNEL_LABELS, ACTIVITIES, ACTIVITY_LABELS, QUEUE_TYPES } from "./model.js";
import { FAMILY_COLORS } from "./tokens.js";

const fmt = (n) => (n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("en-GB"));
const NAV = [["home", "Home"], ["setup", "Setup"], ["levers", "Levers"], ["results", "Results"]];

export const SETUP_TABS = [
  ["structure", "Structure", "The vocabulary of the estate — brands, business units, channels and products. Each shows what it is used for, so you can see the shape of the estate at a glance. Products belong to a brand, or to all of them."],
  ["queues", "Queues", "The stations work actually lands on, and the physics that staff them. Volume and effective AHT are derived from your processes — they are never entered here. Tap a queue to open its editor."],
  ["processes", "Processes", "The journeys work can take, defined once and reused. A process is a channel-specific route through your queues, ending in a declared outcome — attach the same one to as many request types as need it. Process groups are managed here."],
  ["requestTypes", "Request types", "What customers ask for, and how each one is handled. This is the only place brands, business units, channels and queues are wired together — one process per channel, ending in a declared outcome."],
  ["volume", "Volume & flow", "How much arrives, and where it goes. Type a figure at any level you know; it is authoritative beneath, finer entries act as weights, and the rest splits equally. Expand a process row to see its journey with those volumes on the arrows; the whole-estate map lives at the bottom."],
  ["defaults", "Defaults", "The physics every queue inherits unless it overrides them. Channel defaults live in Structure; shared teams live in Queues; risk thresholds are a reading lens on Results."],
];

// ---- completion: one status per tab, in dependency order ---------------------
export function computeStatus(model, p) {
  const nBrands = (model.brands || []).length, nBus = (model.businessUnits || []).length,
    nChans = (model.channels || []).length, nQ = (model.queues || []).length,
    nRt = (model.requestTypes || []).length, nVe = (model.volumeEntries || []).length;
  const errs = p.validation.errors, warns = p.validation.warnings;
  const nProc = (model.processes || []).length;
  // A process is incomplete until it routes somewhere and declares an end.
  const procBad = (model.processes || []).filter(
    (pr) => !(pr.steps || []).length || !(pr.steps || []).some((st) => st.terminal)).length;
  const structOk = nBrands > 0 && nBus > 0 && nChans > 0;
  const rtErrs = errs.length; // V3/dangling all live on the wiring
  const uncovered = warns.filter((w) => w.kind === "uncovered_volume").length;
  return [
    { key: "structure", ok: structOk, badge: `${nBrands + nBus + nChans + (model.processGroups || []).length + (model.products || []).length} entities`,
      next: "Add your first brand, business unit and channel in Structure." },
    { key: "queues", ok: nQ > 0, badge: `${nQ} queue${nQ === 1 ? "" : "s"}`,
      next: "Add the queues work actually lands on." },
    { key: "processes", ok: nProc > 0 && procBad === 0,
      badge: procBad ? `${procBad} incomplete` : `${nProc} process${nProc === 1 ? "" : "es"}`,
      next: nProc === 0 ? "Define the journeys work can take." : "Finish the processes that do not reach an end point." },
    { key: "requestTypes", ok: nRt > 0 && rtErrs === 0,
      badge: rtErrs ? `${rtErrs} error${rtErrs === 1 ? "" : "s"}` : `${nRt} type${nRt === 1 ? "" : "s"}`,
      next: nRt === 0 ? "Define a request type and wire its process." : "Fix the process errors flagged in Request types." },
    { key: "volume", ok: nVe > 0 && uncovered === 0,
      badge: uncovered ? `${uncovered} uncovered` : `${nVe} entr${nVe === 1 ? "y" : "ies"}`,
      next: nVe === 0 ? "Enter volume at whatever level you know it." : "Cover the volume flagged as reaching no process." },
    { key: "defaults", ok: !!model.engineConfig, badge: model.engineConfig ? "attached" : "missing",
      next: "Attach engine defaults (import a model or start from the sample)." },
  ];
}

// Import validation report for template v3 uploads — counts + errors (red) +
// warnings (amber), dismissible; nothing is ever applied silently.
function DomainImportReport({ report, onDismiss }) {
  const err = report.error;
  const errors = report.errors || [], warnings = report.warnings || [];
  const tone = err || errors.length ? "err" : warnings.length ? "warn" : "ok";
  const bg = tone === "err" ? "var(--red-bg)" : tone === "warn" ? "var(--amber-bg)" : "var(--green-bg)";
  const ink = tone === "err" ? "var(--red-ink)" : tone === "warn" ? "var(--amber-ink)" : "var(--green-ink)";
  const c = report.counts || {};
  return (
    <div data-testid="import-report" role="status" style={{ border: "0.5px solid " + ink, background: bg, color: ink, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <b style={{ fontSize: 13 }}>{tone === "err" ? "✕ Import failed" : "Template imported" + (report.filename ? ` — ${report.filename}` : "")}</b>
        <button className="close" onClick={onDismiss} aria-label="Dismiss import report" style={{ marginLeft: "auto", color: ink, background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>
      {err ? <p style={{ fontSize: 12.5, marginTop: 4 }}>{err}</p> : <>
        <p style={{ fontSize: 12.5, marginTop: 4 }}>
          Loaded {c.brands || 0} brand{c.brands === 1 ? "" : "s"} · {c.queues || 0} queue{c.queues === 1 ? "" : "s"} · {c.requestTypes || 0} request type{c.requestTypes === 1 ? "" : "s"} · {c.volumeEntries || 0} volume entr{c.volumeEntries === 1 ? "y" : "ies"}.
          {errors.length ? ` ${errors.length} error${errors.length === 1 ? "" : "s"} must be fixed.` : warnings.length ? ` ${warnings.length} warning${warnings.length === 1 ? "" : "s"} to review.` : " No issues."}
        </p>
        {errors.slice(0, 5).map((e, i) => <p key={"e" + i} style={{ fontSize: 12, marginTop: 2 }}>✕ {e.message}</p>)}
        {warnings.slice(0, 5).map((w, i) => <p key={"w" + i} style={{ fontSize: 12, marginTop: 2 }}>▲ {w.message}</p>)}
      </>}
    </div>
  );
}

export default function SetupV3Page({ model, onModelChange, onNav = () => {}, onOpenClassic, onDownloadTemplate, onUploadTemplate, importReport, onDismissImport }) {
  const p = useMemo(() => propagateDomain(model), [model]);
  const status = useMemo(() => computeStatus(model, p), [model, p]);
  const [tab, setTab] = useState("structure");
  const firstTodo = status.find((s) => !s.ok);
  // Six labels overflow the strip on a phone, so a jump-link from Map (or the
  // progress strip's Go) could select a tab whose button is off-screen.
  const activeTabRef = useRef(null);
  useEffect(() => { activeTabRef.current?.scrollIntoView?.({ inline: "center", block: "nearest" }); }, [tab]);

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
      <p className="lede">Six tabs in dependency order — each consumes what the previous ones defined.</p>

      {importReport ? <DomainImportReport report={importReport} onDismiss={onDismissImport} /> : null}

      {firstTodo ? (
        <div className="pstrip" role="status"><span className="glyph todo">▲</span><span><b>Next:</b> {firstTodo.next}</span>
          <button className="btn sm" onClick={() => setTab(firstTodo.key)}>Go</button></div>
      ) : null}

      <div className="subtabs" role="tablist" aria-label="Setup tabs">
        {SETUP_TABS.map(([k, label]) => {
          const s = status.find((x) => x.key === k);
          const on = tab === k;
          return (
            <button key={k} role="tab" id={"tab-" + k} aria-controls="setup-panel" aria-selected={on}
              ref={on ? activeTabRef : null} className={on ? "on" : ""} onClick={() => setTab(k)}
              aria-label={s.ok ? label : label + " — needs attention: " + s.next}>
              {label}
              {!s.ok ? <span className="glyph todo" title={s.next}>▲</span> : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="setup-panel" aria-labelledby={"tab-" + tab} data-tab={tab} className="panel flat">
        <p className="tabnote" data-testid="tab-note">{(SETUP_TABS.find(([k]) => k === tab) || [])[2]}</p>
        {tab === "structure" && <StructurePanel model={model} set={onModelChange} />}
        {tab === "queues" && <QueuesPanel model={model} set={onModelChange} p={p} />}
        {tab === "processes" && <ProcessesPanel model={model} set={onModelChange} p={p} />}
        {tab === "requestTypes" && <RequestTypesPanel model={model} set={onModelChange} p={p} />}
        {tab === "volume" && <VolumePanel model={model} set={onModelChange} p={p} onJump={setTab} />}
        {tab === "defaults" && <DefaultsPanel model={model} set={onModelChange} />}
      </div>

      {onDownloadTemplate || onUploadTemplate ? (
        <div className="importbox">
          <p><b>Bulk edit via the five-sheet template.</b> Download comes pre-filled; re-upload validates first.</p>
          <div style={{ display: "flex", gap: 8 }}>
            {onDownloadTemplate ? <button className="btn sm" onClick={() => onDownloadTemplate(model)}>Download template</button> : null}
            {onUploadTemplate ? <button className="btn sm primary" onClick={() => onUploadTemplate()}>Upload data</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// On a phone .md is one column and the detail pane renders after the entire
// master list — selecting a row changed something off-screen. Moves focus (so
// keyboard users land in the editor too) and scrolls only where it is stacked.
// Both scrollIntoView and matchMedia are optional: jsdom defines neither.
function useRevealOnSelect(sel) {
  const ref = useRef(null);
  useEffect(() => {
    if (sel == null || !ref.current) return;
    ref.current.focus?.();
    if (window.matchMedia?.("(max-width:640px)")?.matches) ref.current.scrollIntoView?.({ block: "start" });
  }, [sel]);
  return ref;
}

// The option groups inside a tab are drawers — one idiom, used by every tab.
function Drawer({ title, sub, info, count, defaultOpen, children, testid }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={"drw" + (open ? " open" : "")} data-testid={testid}>
      <button className="drwhead" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span><b>{title}</b>{info ? <span className="info" title={info} aria-label={info}>i</span> : null}{sub ? <small>{sub}</small> : null}</span>
        {count != null ? <span className="count">{count}</span> : null}
        <span className="chev">▼</span>
      </button>
      <div className="drwbody">{children}</div>
    </div>
  );
}

const nameOf = (list, id) => { const e = (list || []).find((x) => x.id === id); return e ? e.name : id; };

// ---- 1 · Structure — the registry: five flat lists, editable (U2) ------------
// Rename propagates by id (nothing stores names twice); delete is guarded with
// the dependents summarised (V6). Channels enable from the taxonomy and carry
// the channel defaults new processes inherit (globals category B).
const CH_INFO = "The contact channels this estate uses. All four defaults are ready to use; add your own for anything else. Each channel carries the defaults new processes inherit — ASA, abandon, patience, concurrency and SLA.";
const REG_INFO = {
  Brands: "The brands you plan for. A request type is assigned to one or more; leaving it unassigned means it applies to every brand.",
  "Business units": "An independent axis from brands — one BU can serve many brands. Used to scope request types and to give a queue its home.",
  "Process groups": "A way of reporting on similar processes together. The double-cover warning is scoped to a group: two request types in the same group covering the same brand, BU and channel is flagged.",
  Products: "Optional. Tag a request type with the product it concerns, for reporting.",
};
const KIND_INFO_ORDER = 0;
const KIND_LABELS = { requestType: ["request type", "request types"], queue: ["queue", "queues"], volumeEntry: ["volume entry", "volume entries"], process: ["process", "processes"] };
function guardSummary(guard) {
  const byKind = {};
  for (const b of guard.blockedBy) byKind[b.kind] = (byKind[b.kind] || 0) + 1;
  return Object.entries(byKind).map(([k, n]) => {
    const [one, many] = KIND_LABELS[k] || [k, k + "s"];
    return `${n} ${n === 1 ? one : many}`;
  }).join(" · ");
}

// What a registry entity is actually used for — the view the owner asked for on
// this tab, so the estate's shape is readable without opening Request types.
function usageOf(model, kind, id) {
  const rts = (model.requestTypes || []).filter((rt) => {
    if (kind === "brand") return (rt.brandIds || []).length ? rt.brandIds.includes(id) : true;
    if (kind === "bu") return (rt.buIds || []).length ? rt.buIds.includes(id) : true;
    if (kind === "channel") return processesOf(model, rt).some((pr) => pr.channelId === id);
    if (kind === "product") return rt.productId === id;
    return false;
  });
  return rts.map((rt) => rt.name);
}
function UsageNote({ names }) {
  const on = names.length > 0;
  const detail = on
    ? `Active — used by ${names.length} request type${names.length === 1 ? "" : "s"}: ${names.join(", ")}`
    : "Not active — nothing references this yet, so it has no effect on the plan.";
  return <span className={"statusdot" + (on ? " on" : "")} title={detail} aria-label={detail}>{on ? "active" : "not active"}</span>;
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

function RegistryList({ title, list, hint, info, onAdd, addLabel, row, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={"reglist drw" + (open ? " open" : "")}>
      <button className="reghead drwhead" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span><b>{title}</b>{info ? <span className="info" title={info} aria-label={info}>i</span> : null}</span>
        <span className="count">{(list || []).length}</span>
        <span className="chev">▼</span>
      </button>
      <div className="drwbody">
        {hint ? <p className="hint" style={{ marginBottom: 6 }}>{hint}</p> : null}
        {(list || []).length === 0 ? <span className="hint">none yet</span> : list.map(row)}
        {onAdd ? <div style={{ marginTop: 8 }}><button className="btn sm" onClick={onAdd}>{addLabel || "+ Add"}</button></div> : null}
      </div>
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
        <span className="tax">{CHANNEL_LABELS[c.key] || "custom"}</span>
        <UsageNote names={usageOf(model, "channel", c.id)} />
        <button className="linkbtn chdrw" onClick={() => setOpen(!open)} aria-expanded={open}>Settings{Object.keys(d).length ? " ●" : ""}<span className="chev">▼</span></button>
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

// The four taxonomy channels come seeded; anything beyond them (WhatsApp, web
// chat, a partner channel) is added here and behaves identically thereafter.
function AddChannel({ model, set }) {
  const [name, setName] = useState("");
  const commit = () => {
    const n = name.trim();
    if (!n) return;
    set(Ops.addChannel(model, { name: n }));
    setName("");
  };
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input className="outin" value={name} placeholder="add a channel…" aria-label="New channel name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />
      <button className="btn sm" disabled={!name.trim()} onClick={commit}>Add</button>
    </span>
  );
}

function StructurePanel({ model, set }) {
  const plain = [
    ["Brands", "brands", Ops.addBrand, Ops.renameBrand, Ops.deleteBrand, canDeleteBrand, "New brand", "+ Brand"],
    ["Business units", "businessUnits", Ops.addBusinessUnit, Ops.renameBusinessUnit, Ops.deleteBusinessUnit, canDeleteBU, "New business unit", "+ Business unit"],
    ["Products", "products", Ops.addProduct, Ops.renameProduct, Ops.deleteProduct, canDeleteProduct, "New product", "+ Product"],
  ];
  const USAGE_KIND = { brands: "brand", businessUnits: "bu", products: "product" };
  const extraFor = (key, e) => {
    const bits = [];
    if (key === "products") {
      bits.push(
        <select key="brand" className="prodbrand" value={e.brandId || ""} aria-label={"Brand for " + e.name}
          onChange={(ev) => set(Ops.setProductBrand(model, e.id, ev.target.value))}>
          <option value="">All brands</option>
          {(model.brands || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>);
    }
    if (USAGE_KIND[key]) bits.push(<UsageNote key="u" names={usageOf(model, USAGE_KIND[key], e.id)} />);
    return bits;
  };
  const enabledKeys = new Set((model.channels || []).map((c) => c.key));
  const offKeys = CHANNELS.filter((k) => !enabledKeys.has(k));
  const [brandsL, busL, prodsL] = plain.map(([title, key, add, rename, del, guard, seed, addLabel]) => (
    <RegistryList key={key} title={title} list={model[key]} info={REG_INFO[title]} defaultOpen={key === "brands"} onAdd={() => set(add(model, { name: seed }))} addLabel={addLabel}
      row={(e) => (
        <RegRow key={e.id} entity={e} onRename={(name) => set(rename(model, e.id, name))}
          guard={guard(model, e.id)} onDelete={() => set(del(model, e.id))} extra={extraFor(key, e)} />
      )} />
  ));
  return (
    <>
      <h3>Structure <small>the vocabulary of the estate</small></h3>
      <div className="structgrid">
        {brandsL}
        {busL}
        <ChannelList model={model} set={set} />
        {prodsL}
      </div>
    </>
  );
}

function ChannelList({ model, set }) {
  const [open, setOpen] = useState(false);
  const enabledKeys = new Set((model.channels || []).map((c) => c.key));
  const offKeys = CHANNELS.filter((k) => !enabledKeys.has(k));
  return (
    <div className={"reglist drw" + (open ? " open" : "")}>
      <button className="reghead drwhead" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span><b>Channels</b><span className="info" aria-label={CH_INFO} title={CH_INFO}>i</span></span>
        <span className="count">{(model.channels || []).length}</span>
        <span className="chev">▼</span>
      </button>
      <div className="drwbody">
          {(model.channels || []).length === 0 ? <span className="hint">none yet</span> : null}
          {(model.channels || []).map((c) => <ChannelRow key={c.id} model={model} c={c} set={set} />)}
          <div className="regoff">
            {offKeys.map((k) => (
              <button key={k} className="chip off" onClick={() => set(Ops.addChannel(model, { key: k, name: CHANNEL_LABELS[k] }))} aria-label={"Enable " + CHANNEL_LABELS[k]}>
                + {CHANNEL_LABELS[k]}
              </button>
            ))}
            <AddChannel model={model} set={set} />
          </div>
      </div>
    </div>
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

// A KPI family: collapsed by default so the drawer opens as six scannable
// headings rather than thirty fields. Collapse is CSS-driven (the body stays in
// the DOM) so nothing re-mounts and in-progress edits survive a toggle.
const FAM_INFO = {
  Inputs: "What arrives and what it costs to handle. Volume and effective AHT are derived from the processes that route here — the fallback AHT is only used when a request type does not declare its own.",
  Performance: "The service promise for this queue. Voice queues answer on ASA and abandon; digital queues answer on a percentage within a time. This is what red and amber are measured against.",
  Efficiency: "How hard staff can be run. The occupancy ceiling caps sustainable utilisation; the advanced burnout block models what happens when you exceed it — attrition rises and handling slows.",
  Workforce: "Who staffs this queue and how they arrive. Covers the hiring pipeline (request to start, training, learning curve), shrinkage, attrition, cross-skilling, and the manual hire plan the Manual strategy uses.",
  Customer: "What a failure here costs commercially — the churn value applied when this queue misses.",
  Outputs: "The unit costs the plan is priced with.",
};
function Fam({ fam, name, children, advanced, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [adv, setAdv] = useState(false);
  return (
    <section className={"fam-sec" + (open ? " open" : "")}>
      <button className="famhead" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="fam" style={{ background: FAMILY_COLORS[fam] }} /><b>{name}</b>
        {FAM_INFO[name] ? <span className="info" title={FAM_INFO[name]} aria-label={FAM_INFO[name]}>i</span> : null}
        <span className="chev">▼</span>
      </button>
      <div className="fambody">
        {children}
        {advanced ? <button className="linkbtn" onClick={() => setAdv(!adv)} aria-expanded={adv}>{adv ? "Hide advanced" : `Advanced (${advanced.count})`}</button> : null}
        {adv && advanced ? <div style={{ marginTop: 8 }}>{advanced.body}</div> : null}
      </div>
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

function QueueDetail({ model, set, q, d, detailRef, onClosed }) {
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
    <div data-testid="queue-detail" ref={detailRef} tabIndex={-1} aria-label={q.name}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h4 style={{ marginRight: "auto" }}>{q._modified ? <>Tuned<span className="moddot" style={{ marginLeft: 6 }} aria-label="modified" /></> : "Defaults"}</h4>
        <button className="btn sm" onClick={() => set(Ops.resetQueueStaffing(model, q.id))}>Reset to defaults</button>
        {guard.ok
          ? <button className="btn sm danger" onClick={() => { set(Ops.deleteQueue(model, q.id)); onClosed && onClosed(); }}>Delete</button>
          : <span className="hint blocked" style={{ marginLeft: 0 }} title={"Referenced by " + guardSummary(guard)}>▲ in use</span>}
      </div>
      <p className="hint derived-strip">Derived: <b className="num">{fmt(d ? d.volume : 0)}/day</b> · eff. AHT <b className="num">{fmt(d ? d.effectiveAht : q.fallbackAhtSec)} s</b>{d && d.ahtMarker !== "queue" ? ` (${d.ahtMarker})` : ""} · {usage.processes ? `used in ${usage.processes} process${usage.processes === 1 ? "" : "es"} across ${usage.brands} brand${usage.brands === 1 ? "" : "s"}` : "not used by any process yet"}</p>

      <Fam fam="inputs" name="Inputs" defaultOpen
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

      <Fam fam="performance" name="Performance">
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

      <Fam fam="efficiency" name="Efficiency"
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

      <Fam fam="workforce" name="Workforce"
        advanced={{ count: 4 + 1, body: (
          <>
            <div className="fields">
              <NumF label="Attrition growth (/mo)" value={wf.attritionGrowth} onChange={(v) => updWf({ attritionGrowth: n0(v) })} />
              <div className="field"><label>Learning curve (× by week)</label>
                <input value={(wf.learningCurve || []).join(", ")} aria-label="Learning curve" placeholder="0.6, 0.8, 0.9, 1"
                  onChange={(e) => updWf({ learningCurve: e.target.value.split(",").map((x) => +x.trim()).filter((x) => !isNaN(x)) })} /></div>
            </div>
            <QueueChips model={model} selfId={q.id} list={eff.crossSkill} label="Cross-skilled with"
              onToggle={(id) => upd({ crossSkill: (eff.crossSkill || []).includes(id) ? eff.crossSkill.filter((x) => x !== id) : [...(eff.crossSkill || []), id] })} />
            <QueueChips model={model} selfId={q.id} list={eff.supports} label="Supports (capacity link)"
              onToggle={(id) => upd({ supports: (eff.supports || []).includes(id) ? eff.supports.filter((x) => x !== id) : [...(eff.supports || []), id] })} />
            <div className="field" style={{ gridColumn: "1/-1", marginTop: 6 }}><label>Manual hires (week × heads)</label>
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

      <Fam fam="customer" name="Customer">
        <div className="fields">
          <NumF label="Churn cost (£)" value={eff.churnCost ?? 500} onChange={(v) => upd({ churnCost: n0(v) })} />
          <NumF label="Failed → churn (%)" value={eff.failedToChurnPct ?? 6} onChange={(v) => upd({ failedToChurnPct: n0(v) })} />
        </div>
      </Fam>

      <Fam fam="outputs" name="Outputs">
        <div className="fields">
          <NumF label="Agent cost (£/yr)" value={eff.agentCost} onChange={(v) => upd({ agentCost: n0(v) })} />
        </div>
      </Fam>
    </div>
  );
}

function QueuesPanel({ model, set, p }) {
  const queues = model.queues || [];
  const [sel, setSel] = useState(null);
  const detailRef = useRevealOnSelect(sel && sel.id);
  const close = () => setSel(null);
  const q = sel && sel.kind === "queue" ? queues.find((x) => x.id === sel.id) : null;
  const open = !!q;
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
      <h3>Queues <small>volume and AHT are derived — tap a queue to edit</small></h3>
      <div>
        <div>
          {groups.map((label) => (
            <div className="mdgroup" key={label}>
              <p className="mdgrouplab">{label}</p>
              <div className="mdlist" role="listbox" aria-label={label}>
                {byKey.get(label).map((x) => {
                  const dx = p.queues.get(x.id);
                  const u = queueUsage(model, x.id);
                  const on = sel && sel.kind === "queue" && sel.id === x.id;
                  const shared = x.type === "shared_capacity";
                  return (
                    <div className={"ticket" + (on ? " open" : "") + (shared ? " shared-cap" : "")} key={x.id}>
                      <button className="tickethead" aria-expanded={on}
                        onClick={() => setSel(on ? null : { kind: "queue", id: x.id })}>
                        <span className="tname">
                          <b>{x.name}{x._modified ? <span className="moddot" aria-label="modified" /> : null}</b>
                          <small>{QTYPE_LABELS[x.type] || x.type}</small>
                        </span>
                        <span className="tmeta">
                          <span className={"statusdot" + (u.processes ? " on" : "")}
                            title={u.processes ? `Active — used in ${u.processes} process${u.processes === 1 ? "" : "es"} across ${u.brands} brand${u.brands === 1 ? "" : "s"}` : "Not active — no process routes here, so it carries no load."}>
                            {u.processes ? "active" : "not active"}</span>
                          <span className="tsum num">{shared ? "lends capacity" : `${fmt(dx ? dx.volume : 0)}/day · ${fmt(dx ? dx.effectiveAht : x.fallbackAhtSec)} s`}</span>
                        </span>
                        <span className="chev">▼</span>
                      </button>
                      {on ? <div className="ticketbody">
                        <QueueDetail model={model} set={set} q={x} d={dx} detailRef={detailRef} onClosed={close} />
                      </div> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <button className="btn sm" onClick={() => {
            const m2 = Ops.addQueue(model, { name: "New queue", type: "inbound_call" });
            set(m2); setSel({ kind: "queue", id: m2.queues[m2.queues.length - 1].id });
          }}>+ Queue</button>
        </div>
      </div>


    </>
  );
}

// ---- 3 · Processes — journeys defined once and reused (v1.3) ---------------
// A process belongs to a channel and routes through queues to a declared
// outcome. It is NOT owned by a request type: attach the same process to as
// many as need it, and an edit here is felt by all of them.
function ProcessesPanel({ model, set, p }) {
  const procs = model.processes || [];
  const [sel, setSel] = useState(null);
  const proc = sel ? procs.find((x) => x.id === sel) : null;
  const close = () => setSel(null);
  const detailRef = useRevealOnSelect(sel);
  const groups = model.processGroups || [];
  return (
    <>
      <h3>Processes <small>defined once, attached to any request type</small></h3>

      <Drawer title="Process groups" count={groups.length} defaultOpen={false}
        info="A way of reporting on similar processes together. The double-cover warning is scoped to a group: two request types in the same group covering the same brand, BU and channel is flagged.">
        {groups.length === 0 ? <span className="hint">none yet</span> : groups.map((g) => (
          <RegRow key={g.id} entity={g} onRename={(name) => set(Ops.renameProcessGroup(model, g.id, name))}
            guard={canDeleteGroup(model, g.id)} onDelete={() => set(Ops.deleteProcessGroup(model, g.id))} />
        ))}
        <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => set(Ops.addProcessGroup(model, { name: "New group" }))}>+ Group</button></div>
      </Drawer>

      <Drawer title="Processes" count={procs.length} defaultOpen
        info="Each process is one specific journey on one channel. Steps route a percentage of what reaches them to a queue; the step marked Ends declares the outcome. Reuse is the point — the same process can serve many request types.">
        {procs.length === 0 ? <p className="hint">No processes yet — add one, then attach it to a request type.</p> : null}
        <div className="mdlist" role="listbox" aria-label="Processes">
          {procs.map((x) => {
            const u = Ops.processUsage(model, x.id);
            const bad = !(x.steps || []).length || !(x.steps || []).some((st) => st.terminal);
            return (
              <button key={x.id} role="option" aria-selected={sel === x.id} className={sel === x.id ? "on" : ""} onClick={() => setSel(x.id)}>
                <b>{x.name} <span className={"glyph " + (bad ? "err" : "ok")}>{bad ? "✕" : "●"}</span></b>
                <small>{nameOf(model.channels, x.channelId)}{x.groupId ? " · " + nameOf(groups, x.groupId) : ""} · {(x.steps || []).length} step{(x.steps || []).length === 1 ? "" : "s"}</small>
                <span className="qstats">{u.requestTypes ? `used by ${u.requestTypes} request type${u.requestTypes === 1 ? "" : "s"}` : "not attached yet"}</span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 8 }}>
          <button className="btn sm" disabled={!(model.channels || []).length} onClick={() => {
            const m2 = Ops.createProcess(model, { name: "New process", channelId: model.channels[0].id });
            set(m2); setSel(m2.processes[m2.processes.length - 1].id);
          }}>+ Process</button>
        </div>
      </Drawer>

      <div className={"scrim" + (proc ? " on" : "")} onClick={close} />
      <aside className={"drawer" + (proc ? " on" : "")} aria-label="Edit process" aria-hidden={!proc}>
        {proc ? <ProcessDetail model={model} set={set} proc={proc} detailRef={detailRef} onClosed={close} /> : null}
      </aside>
    </>
  );
}

function ProcessDetail({ model, set, proc, detailRef, onClosed }) {
  const u = Ops.processUsage(model, proc.id);
  return (
    <>
      <div className="dhead">
        <div><h3>{proc.name}</h3><p>{nameOf(model.channels, proc.channelId)} · {u.requestTypes ? `used by ${u.names.join(", ")}` : "not attached to any request type"}</p></div>
        <button className="close" onClick={onClosed} aria-label="Close">✕</button>
      </div>
      <div className="dbody" data-testid="process-detail" ref={detailRef} tabIndex={-1}>
        {u.requestTypes > 1 ? (
          <p className="warnmsg">▲ Shared by {u.requestTypes} request types — an edit here changes all of them.</p>
        ) : null}
        <div className="fields">
          <div className="field"><label>Name</label>
            <input value={proc.name} aria-label="Process name" onChange={(e) => set(Ops.updateProcessMeta(model, proc.id, { name: e.target.value }))} /></div>
          <div className="field"><label>Channel</label>
            <select value={proc.channelId} aria-label="Process channel" onChange={(e) => set(Ops.updateProcessMeta(model, proc.id, { channelId: e.target.value }))}>
              {(model.channels || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div className="field"><label>Process group</label>
            <select value={proc.groupId || ""} aria-label="Process group" onChange={(e) => set(Ops.updateProcessMeta(model, proc.id, { groupId: e.target.value || undefined }))}>
              <option value="">— none</option>
              {(model.processGroups || []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select></div>
        </div>
        <ProcessSteps model={model} set={set} proc={proc} />
        <div style={{ marginTop: 16, borderTop: "0.5px solid var(--line)", paddingTop: 10 }}>
          <button className="btn sm danger" onClick={() => { set(Ops.deleteProcessById(model, proc.id)); onClosed && onClosed(); }}>
            Delete process{u.requestTypes ? ` (detaches from ${u.requestTypes})` : ""}
          </button>
        </div>
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

// Two of these render back to back under one "Assignment" heading — brands and
// business units. Unlabelled they were two anonymous rows of toggles deciding
// the most consequential wiring on the surface. Same idiom QueueChips already
// used 200 lines below: a .field label + a named group.
function ToggleChips({ label, options, selected, onToggle, allLabel }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="regoff" role="group" aria-label={label}>
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button key={o.id} className={"chip" + (on ? " on-toggle" : " off")} aria-pressed={on}
              onClick={() => onToggle(o.id)}>{on ? o.name : "+ " + o.name}</button>
          );
        })}
        {options.length === 0 ? <span className="hint">{allLabel}</span> : null}
      </div>
    </div>
  );
}

// The step grid, addressed by PROCESS id — so editing from the Processes tab or
// from a request type edits the same shared definition.
function ProcessSteps({ model, set, proc }) {
  const [newOutcome, setNewOutcome] = useState("");
  const upd = (i, patch) => set(Ops.updateProcessStep(model, proc.id, i, patch));
  const noTerminal = (proc.steps || []).length > 0 && !proc.steps.some((s) => s.terminal);
  const hasGov = (proc.steps || []).some((s) => { const q = (model.queues || []).find((x) => x.id === s.queueId); return q && q.type === "governance"; });
  const pid = proc.id;
  return (
    <>
      {(proc.steps || []).length === 0 ? <p className="hint" style={{ margin: "4px 0" }}>No steps yet — this process is inert until it routes somewhere.</p> : (
        <div className={"steps" + (hasGov ? " with-sample" : "")}>
          <div className="steprow head"><span>Step</span><span>Queue</span><span>Split %</span>{hasGov ? <span>Sample %</span> : null}<span>Ends</span><span>Outcome</span><span /></div>
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
                <select value={s.queueId} onChange={(e) => upd(i, { queueId: e.target.value })} aria-label={`${pid} step ${i + 1} queue`}>
                  {(model.queues || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <input className="num" value={s.splitPct} title={reworkTitle} onChange={(e) => upd(i, { splitPct: +e.target.value || 0 })} aria-label={`${pid} step ${i + 1} split percent`} />
                {hasGov ? (gov
                  ? <input className="num" value={s.samplingPct != null ? s.samplingPct : ""} placeholder="—"
                      onChange={(e) => upd(i, { samplingPct: e.target.value === "" ? undefined : +e.target.value })} aria-label={`${pid} step ${i + 1} sampling percent`} />
                  : <span className="stepdash">—</span>) : null}
                <input type="checkbox" checked={!!s.terminal} onChange={(e) => upd(i, { terminal: e.target.checked ? true : false })} aria-label={`${pid} step ${i + 1} terminal`} />
                {s.terminal ? (
                  <select value={s.outcome || ""} onChange={(e) => upd(i, { outcome: e.target.value || undefined })} aria-label={`${pid} step ${i + 1} outcome`}>
                    <option value="">outcome…</option>
                    {(proc.outcomes || []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : <span className="stepdash">—</span>}
                <button className="regdel" onClick={() => set(Ops.removeProcessStep(model, proc.id, i))} aria-label={`${pid} remove step ${i + 1}`}>✕</button>
              </div>
            );
          })}
        </div>
      )}
      {noTerminal ? <p className="errmsg">✕ No terminal step — the process leads nowhere. Mark the final step "ends" and pick its outcome.</p> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
        <button className="btn sm" disabled={!(model.queues || []).length}
          onClick={() => set(Ops.addProcessStep(model, proc.id, { queueId: model.queues[0].id }))}>+ Step</button>
        <span className="hint" style={{ marginLeft: 8 }}>outcomes:</span>
        {(proc.outcomes || []).map((o) => {
          const used = (proc.steps || []).some((s) => s.outcome === o);
          return (
            <span className="chip" key={o}>{o}{used
              ? <small title="Referenced by a terminal step"> ·in use</small>
              : <button className="chipx" onClick={() => set(Ops.setProcessOutcomes(model, proc.id, proc.outcomes.filter((x) => x !== o)))} aria-label={"Remove outcome " + o}>✕</button>}
            </span>
          );
        })}
        <input className="outin" placeholder="add outcome…" value={newOutcome} onChange={(e) => setNewOutcome(e.target.value)} aria-label={`${pid} new outcome`} />
        <button className="btn sm" disabled={!newOutcome.trim()} onClick={() => {
          const o = newOutcome.trim();
          if (o && !(proc.outcomes || []).includes(o)) set(Ops.setProcessOutcomes(model, proc.id, [...(proc.outcomes || []), o]));
          setNewOutcome("");
        }}>Add</button>
      </div>
    </>
  );
}

// A process as seen FROM a request type: the same shared definition, with the
// attachment (not the definition) removable here.
function ProcessEditor({ model, set, rt, proc }) {
  const [armed, setArmed] = useState(false);
  const chName = nameOf(model.channels, proc.channelId);
  const usage = proc.id ? Ops.processUsage(model, proc.id) : { requestTypes: 1 };
  const detach = () => set(Ops.deleteProcess(model, rt.id, proc.channelId));
  const needsConfirm = (proc.steps || []).length > 0;
  return (
    <div className="proc" data-testid={"process-" + rt.id + "-" + proc.channelId}>
      <div className="prochead">
        <span className="chip on-toggle">{chName}</span>
        <span className="hint">{proc.name}{usage.requestTypes > 1 ? ` · shared with ${usage.requestTypes - 1} other request type${usage.requestTypes === 2 ? "" : "s"}` : ""}</span>
        {armed ? (
          <button className="btn sm danger" style={{ marginLeft: "auto" }} aria-label={"Remove " + chName + " process"}
            onBlur={() => setArmed(false)} onKeyDown={(e) => { if (e.key === "Escape") setArmed(false); }}
            onClick={detach}>Remove {(proc.steps || []).length} step{(proc.steps || []).length === 1 ? "" : "s"}?</button>
        ) : (
          <button className="regdel" aria-label={"Remove " + chName + " process"}
            onClick={() => (needsConfirm ? setArmed(true) : detach())}>✕</button>
        )}
      </div>
      {usage.requestTypes > 1 ? <p className="hint" style={{ marginBottom: 4 }}>Editing these steps changes every request type that uses this process.</p> : null}
      <ProcessSteps model={model} set={set} proc={proc} />
    </div>
  );
}

// Attaching is the primary action now: pick a process that already exists (the
// same one can serve many request types), or create a fresh one for a channel
// that has none.
function AttachProcess({ model, set, rt, offChannels }) {
  const taken = new Set(processesOf(model, rt).map((x) => x.channelId));
  const available = (model.processes || []).filter(
    (x) => !(rt.processIds || []).includes(x.id) && !taken.has(x.channelId));
  const [pick, setPick] = useState("");
  return (
    <div style={{ marginTop: 8 }}>
      {available.length ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <span className="hint">Reuse an existing process:</span>
          <select value={pick} aria-label="Attach an existing process" onChange={(e) => setPick(e.target.value)}>
            <option value="">choose…</option>
            {available.map((x) => (
              <option key={x.id} value={x.id}>{x.name} — {nameOf(model.channels, x.channelId)}</option>
            ))}
          </select>
          <button className="btn sm" disabled={!pick} onClick={() => { set(Ops.attachProcess(model, rt.id, pick)); setPick(""); }}>Attach</button>
        </div>
      ) : null}
      {offChannels.length ? (
        <div className="regoff">
          <span className="hint" style={{ alignSelf: "center" }}>or start a new one:</span>
          {offChannels.map((c) => (
            <button key={c.id} className="chip off" onClick={() => set(Ops.addProcess(model, rt.id, c.id))} aria-label={"Add " + c.name + " process"}>+ {c.name}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RequestTypesPanel({ model, set, p }) {
  const rts = model.requestTypes || [];
  const [sel, setSel] = useState(rts[0] ? rts[0].id : null);
  const detailRef = useRevealOnSelect(sel);
  const rt = rts.find((x) => x.id === sel) || rts[0] || null;
  const rtErr = (x) => p.validation.errors.filter((e) => e.requestTypeId === x.id);
  const rtWarn = (x) => p.validation.warnings.filter((w) => (w.requestTypeIds || []).includes(x.id));
  const assignLine = (x) => {
    const b = (x.brandIds || []).length ? x.brandIds.map((i) => nameOf(model.brands, i)).join(", ") : "all brands";
    const u = (x.buIds || []).length ? x.buIds.map((i) => nameOf(model.businessUnits, i)).join(", ") : "all BUs";
    return b + " · " + u;
  };
  const offChannels = rt ? (model.channels || []).filter((c) => !processesOf(model, rt).some((pr) => pr.channelId === c.id)) : [];
  const guard = rt ? canDeleteRequestType(model, rt.id) : { ok: true, blockedBy: [] };
  return (
    <>
      <h3>Request types <small>the only place things are wired together</small></h3>
      {rts.length === 0 ? <p className="hint">No request types yet — add one to wire brands, channels and queues together.</p> : null}
      <div>
        <div>
        <div className="mdlist">
          {rts.map((x) => {
            const errs = rtErr(x), warns = rtWarn(x);
            const on = rt && rt.id === x.id;
            const live = processesOf(model, x).length > 0 && errs.length === 0;
            return (
              <div className={"ticket" + (on ? " open" : "")} key={x.id}>
                <button className="tickethead rtrow" aria-expanded={!!on} onClick={() => setSel(on ? null : x.id)}>
                  <span className="tname">
                    <b>{x.name} <span className={"glyph " + (errs.length ? "err" : warns.length ? "todo" : "ok")}>{errs.length ? "✕" : warns.length ? "▲" : "●"}</span></b>
                    <small>{nameOf(model.processGroups, x.groupId) || "no group"}{x.productId ? " · " + nameOf(model.products, x.productId) : ""} · {assignLine(x)}</small>
                  </span>
                  <span className="tmeta">
                    <span className={"statusdot" + (live ? " on" : "")}
                      title={errs.length ? "Not active — " + errs[0].message
                        : live ? `Active — ${processesOf(model, x).map((pr) => nameOf(model.channels, pr.channelId)).join(", ")}`
                        : "Not active — no process is attached, so nothing routes anywhere."}>
                      {live ? "active" : "not active"}</span>
                    <span className="tsum">{processesOf(model, x).map((pr) => nameOf(model.channels, pr.channelId)).join(" · ") || "no processes"}</span>
                  </span>
                  <span className="chev">▼</span>
                </button>
                {on ? <div className="ticketbody">{renderDetail()}</div> : null}
              </div>
            );
          })}
        </div>
          <button className="btn sm" style={{ marginTop: 4 }} onClick={() => {
            const m2 = Ops.addRequestType(model, { name: "New request type", groupId: (model.processGroups[0] || {}).id });
            set(m2); setSel(m2.requestTypes[m2.requestTypes.length - 1].id);
          }}>+ Request type</button>
        </div>
      </div>
    </>
  );

  function renderDetail() {
    return (
      <div data-testid="rt-detail" ref={detailRef} tabIndex={-1}>
          <>
            <Drawer title="Identity" defaultOpen
              info="What this request is and how it is classified. The process group drives double-cover reporting; the AHT override replaces the queue's own handling time wherever this request type is routed.">
            <div className="fields">
              <div className="field"><label>Name</label><input value={rt.name} onChange={(e) => set(Ops.updateRequestType(model, rt.id, { name: e.target.value }))} aria-label="Request type name" /></div>
              <div className="field"><label>Activity</label>
                <select value={rt.activity} aria-label="Activity" onChange={(e) => set(Ops.updateRequestType(model, rt.id, { activity: e.target.value }))}>
                  {ACTIVITIES.map((a) => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
                </select></div>
              <div className="field"><label>Product request</label>
                <select value={rt.productRequest} aria-label="Product request" onChange={(e) => set(Ops.updateRequestType(model, rt.id, { productRequest: e.target.value }))}>
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

            </Drawer>

            <Drawer title="Assignment"
              info="Which brands and business units this request type applies to. Selecting none means ALL — useful for a request every brand handles the same way. Two request types in the same process group covering the same brand, BU and channel raise a double-cover warning.">
            <p className="hint">None selected = applies to all.</p>
            <ToggleChips label="Brands" options={model.brands || []} selected={rt.brandIds || []} allLabel="no brands defined yet"
              onToggle={(id) => set(Ops.setAssignment(model, rt.id, { brandIds: (rt.brandIds || []).includes(id) ? rt.brandIds.filter((x) => x !== id) : [...(rt.brandIds || []), id] }))} />
            <ToggleChips label="Business units" options={model.businessUnits || []} selected={rt.buIds || []} allLabel="no business units defined yet"
              onToggle={(id) => set(Ops.setAssignment(model, rt.id, { buIds: (rt.buIds || []).includes(id) ? rt.buIds.filter((x) => x !== id) : [...(rt.buIds || []), id] }))} />
            <p className="hint applies" data-testid="applies-line"><b>Applies to:</b> {assignLine(rt)}</p>
            {rtWarn(rt).map((w, i) => <p className="warnmsg" key={i}>▲ {w.message}</p>)}

            </Drawer>

            <Drawer title="Processes — one per channel" defaultOpen
              info="The journey this request takes, per channel. Each step routes a percentage of what reaches it to a queue; a step marked Ends declares the outcome. A branch under 100% doubles as rework — hover the split to see the multi-round effective rate.">
            {processesOf(model, rt).map((pr) => <ProcessEditor key={pr.id || pr.channelId} model={model} set={set} rt={rt} proc={pr} />)}
            <AttachProcess model={model} set={set} rt={rt} offChannels={offChannels} />

            </Drawer>

            <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "0.5px solid var(--line)", paddingTop: 10 }}>
              {guard.ok
                ? <button className="btn sm danger" onClick={() => { set(Ops.deleteRequestType(model, rt.id)); setSel(null); }}>Delete request type</button>
                : <span className="hint blocked" style={{ marginLeft: 0 }}>▲ Delete blocked — referenced by {guardSummary(guard)}. Remove them first.</span>}
            </div>
          </>
      </div>
    );
  }
}

// ---- 4 · Volume — the cascade grid (U5) --------------------------------------
// Rows are the spine (estate → brand → BU → request type → channel). Type a
// number at ANY row: it becomes an entered figure and everything beneath
// re-resolves live (entered finer figures act as weights; equal split
// otherwise; over-runs scaled AND flagged — V5). Provenance badge on every
// row. A row can also carry a 52-week series (typed, or expanded from a
// seasonality preset) — shapes cascade down and aggregate up to queues.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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

// The flow strip is where Volume meets the old Map: each Process row unfolds
// into its journey, with the step volumes computed exactly as propagation does
// (each step independently takes total x split% x sampling% of the process).
function FlowStrip({ model, p, scope, proc }) {
  const node = p.nodes.get(keyOf(scope));
  const total = node ? node.total : 0;
  return (
    <div className="flowstrip" data-testid={"flow-" + proc.id}>
      <span className="jstep entry">{fmt(total)}/day in</span>
      {proc.steps.length === 0 ? <span className="hint">No steps yet — add them on the Processes tab.</span> : null}
      {proc.steps.map((s, i) => {
        const q = (model.queues || []).find((x) => x.id === s.queueId);
        const sampling = s.samplingPct != null ? s.samplingPct : 100;
        const vol = total * (s.splitPct / 100) * (sampling / 100);
        return (
          <span className="jseg" key={i}>
            <span className="jarr" title={s.splitPct + "% of the process total" + (s.samplingPct != null ? ", sampled at " + s.samplingPct + "%" : "")}>
              →&nbsp;{fmt(vol)}/day{s.samplingPct != null ? " (" + s.samplingPct + "% sample)" : ""}
            </span>
            <span className={"jstep" + (q && q.type === "governance" ? " gov" : "")}>{q ? q.name : s.queueId}</span>
            {s.terminal ? <span className="jdone">✓ {s.outcome || "done"}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

function VolRow({ model, set, p, level, name, kind, sub, scope, node, hasOwnShape, inheritsShape, proc }) {
  const [shapeOpen, setShapeOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const entry = entryAt(model, scope);
  const total = node ? node.total : 0;
  const prov = node ? node.prov : "none";
  const shown = total ? Math.round(total * 10) / 10 : (prov === "entered" ? 0 : "");
  return (
    <>
      <div className={"volrow lvl" + level} data-key={keyOf(scope)} data-row={name} data-kind={kind} style={{ "--lvl": level }}>
        <span className="volname" title={sub ? `${kind} · ${sub}` : kind}>
          <span className="volkind">{kind}</span>{name}
        </span>
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
        {proc ? (
          <button className="linkbtn flowcell" onClick={() => setFlowOpen(!flowOpen)} aria-expanded={flowOpen}
            aria-label={"Flow for " + name}>
            {proc.steps.length} step{proc.steps.length === 1 ? "" : "s"} {flowOpen ? "▾" : "▸"}
          </button>
        ) : <span className="flowcell" />}
      </div>
      {flowOpen && proc ? <FlowStrip model={model} p={p} scope={scope} proc={proc} /> : null}
      {shapeOpen ? <ShapeEditor model={model} set={set} scope={scope} entry={entry} daily={total} /> : null}
    </>
  );
}

function VolumePanel({ model, set, p, onJump }) {
  // Spine tree from the resolved leaves (assignment-driven).
  const rows = [];
  const seen = new Set();
  const hasShapeAt = (scope) => { const e = entryAt(model, scope); return !!(e && e.weekly); };
  rows.push({ level: 0, kind: "Estate", name: "Whole estate", scope: {} });
  for (const leaf of p.leaves) {
    const bKey = leaf.brandId;
    if (!seen.has(bKey)) { seen.add(bKey); rows.push({ level: 1, kind: "Brand", name: nameOf(model.brands, leaf.brandId), scope: { brandId: leaf.brandId } }); }
    const buKey = leaf.brandId + "|" + leaf.buId;
    if (!seen.has(buKey)) { seen.add(buKey); rows.push({ level: 2, kind: "Business unit", name: nameOf(model.businessUnits, leaf.buId), scope: { brandId: leaf.brandId, buId: leaf.buId } }); }
    const rtKey = buKey + "|" + leaf.requestTypeId;
    if (!seen.has(rtKey)) { seen.add(rtKey); rows.push({ level: 3, kind: "Request type", name: leaf.rt.name, scope: { brandId: leaf.brandId, buId: leaf.buId, requestTypeId: leaf.requestTypeId } }); }
    // The finest level a volume can be stated at is the PROCESS — the journey
    // this demand actually runs through on that channel. (Queues are downstream
    // of it: a queue's load is derived from the steps, never entered.)
    const proc = processesOf(model, leaf.rt).find((pr) => pr.channelId === leaf.channelId);
    rows.push({
      level: 4, kind: "Process",
      name: (proc && proc.name) || nameOf(model.channels, leaf.channelId),
      sub: nameOf(model.channels, leaf.channelId),
      scope: { brandId: leaf.brandId, buId: leaf.buId, requestTypeId: leaf.requestTypeId, channelId: leaf.channelId },
      proc,
    });
  }
  const uncovered = p.validation.warnings.filter((w) => w.kind === "uncovered_volume");
  return (
    <>
      <h3>Volume & flow <small>type a number at any row</small></h3>
      {rows.length <= 1 ? <p className="hint">Assign request types first — the spine builds itself from them.</p> : (
        <div className="scrollx">
          <div className="volgrid" data-testid="cascade-grid">
            <div className="volrow head"><span className="volname">Level</span><span>Daily</span><span>Provenance</span><span>Shape</span><span>Flow</span></div>
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
                <VolRow key={keyOf(r.scope)} model={model} set={set} p={p} level={r.level} name={r.name} kind={r.kind} sub={r.sub} scope={r.scope}
                  node={p.nodes.get(keyOf(r.scope))} hasOwnShape={hasShapeAt(r.scope)}
                  inheritsShape={anc.some((a) => hasShapeAt(a))} proc={r.proc} />
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
      <Drawer title="Whole estate map" testid="estate-map"
        info="A generated picture of the whole estate — nothing is authored here. Queues are placed by journey depth; solid arrows are routing from process steps, dashed lines are shared capacity. Every validation issue is listed beneath with a link to the tab that fixes it."
        count={(() => { const n = p.validation.errors.length + p.validation.warnings.length + (p.notes || []).length; return n ? n + (n === 1 ? " issue" : " issues") : "no issues"; })()}>
        <EstateMap model={model} p={p} onJump={onJump} />
      </Drawer>
    </>
  );
}

// ---- 5 · Estate map — a pure generated artefact (U6), drawn at the foot of
// the Volume & flow tab.
// Nothing is authored here, ever. Queues are nodes placed by journey depth;
// flow edges come entirely from process steps (split % · sampling); capacity-
// sharing (supports, cross-skill, service teams) draws DASHED, visually
// distinct from flow. The validation panel lives here, each issue with a
// jump-link to the tab that fixes it.
const NODE_W = 168, NODE_H = 52, COL_W = 212, ROW_H = 76;
// Node boxes are a fixed 168px with a 44px gutter — anything longer collides
// with the next column rather than overflowing its own box.
const trunc = (s, n = 22) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function buildMap(model, p) {
  const depth = new Map();
  for (const rt of model.requestTypes || [])
    for (const proc of processesOf(model, rt))
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
    for (const proc of processesOf(model, rt))
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
  // Teams lay out on their own row, so the viewBox must cover whichever is
  // wider — otherwise a fourth shared team is silently clipped.
  const width = Math.max(40 + (maxD + 2) * COL_W, 40 + teams.length * COL_W);
  const height = teamY + (teams.length ? NODE_H + 30 : 6);
  return { pos, flow, cap, teams, width, height };
}

function EstateMap({ model, p, onJump }) {
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
      {(model.queues || []).length === 0 ? <p className="hint">The map draws itself once queues and processes exist.</p> : (
        <div className="scrollx">
          {/* No role="img": that would make the SVG an accessibility leaf and
              delete every node button from the tree. */}
          <svg className="mapsvg" data-testid="map-svg" aria-labelledby="mapttl" width={m.width} height={m.height} viewBox={`0 0 ${m.width} ${m.height}`}>
            <title id="mapttl">Queue map</title>
            <desc>{(model.queues || []).length} queues, {m.flow.length} routing links and {m.cap.length} capacity links, generated from the request-type processes.</desc>
            <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="var(--ink-3)" /></marker></defs>
            {m.flow.map((e, i) => edge(e, i, false))}
            {m.cap.map((e, i) => edge(e, i, true))}
            {(model.queues || []).map((q) => {
              const c = m.pos.get(q.id);
              const d = p.queues.get(q.id);
              return (
                <g key={q.id} className={"mnode" + (selQ === q.id ? " on" : "")} data-node={q.id}
                  tabIndex={0} role="button" aria-pressed={selQ === q.id}
                  aria-label={q.name + " — " + (QTYPE_LABELS[q.type] || q.type) + ", " + fmt(d ? d.volume : 0) + " per day"}
                  onClick={() => setSelQ(selQ === q.id ? null : q.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelQ(selQ === q.id ? null : q.id); } }}>
                  <rect x={c.x} y={c.y} width={NODE_W} height={NODE_H} rx="9" />
                  <text className="mname" x={c.x + 10} y={c.y + 21}>{trunc(q.name)}</text>
                  <text className="mmeta" x={c.x + 10} y={c.y + 38}>{fmt(d ? d.volume : 0)}/day · {QTYPE_LABELS[q.type] || q.type}</text>
                </g>
              );
            })}
            {m.teams.map((tm) => {
              const c = m.pos.get("team:" + tm.id);
              return (
                <g key={tm.id} className="mnode team" data-node={"team:" + tm.id}>
                  <rect x={c.x} y={c.y} width={NODE_W} height={NODE_H} rx="9" strokeDasharray="5 4" />
                  <text className="mname" x={c.x + 10} y={c.y + 21}>{trunc(tm.name)}</text>
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
const G_INFO = {
  "Simulation frame": "How long the simulation runs and what a working day looks like. Changing the horizon or the operating day re-scores every strategy in the decision matrix.",
  "Workforce policy": "Global hiring limits. The cap is the most heads that can start in any one week across the estate; the buffer is the headroom the sizing strategies aim for above bare requirement.",
  "Overtime": "How far the estate can push existing staff before hiring. The premium multiplies the hourly rate; the burnout load feeds the attrition model, so heavy overtime costs you people as well as money.",
  "Cost model": "Costs that are not per-agent. Manager cost and span of control set the overhead layered on top of the agent cost each queue carries.",
  "Customer behaviour": "What poor service costs you. These drive the churn and lost-value figures on Results — the difference between an SLA miss and a commercial number.",
  "Pattern libraries": "Reusable shapes. The system seasonality preset is the same library that powers the shape chips on the Volume tab.",
};
function G({ name, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={"drw" + (open ? " open" : "")}>
      <button className="drwhead" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span><b>{name}</b>{G_INFO[name] ? <span className="info" title={G_INFO[name]} aria-label={G_INFO[name]}>i</span> : null}</span>
        <span className="chev">▼</span>
      </button>
      <div className="drwbody"><div className="fields">{children}</div></div>
    </div>
  );
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
      <h3>Defaults <small>what every queue inherits</small></h3>
      <G name="Simulation frame" defaultOpen>
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
        <div className="field"><label>Season starts</label>
          <select value={season.startMonth || 0} aria-label="Season start month"
            onChange={(e) => updEC("seasonality", { startMonth: n0(e.target.value) })}>
            {MONTHS.map((mn, i) => <option key={mn} value={i}>{mn}</option>)}
          </select></div>
        <div className="field" style={{ gridColumn: "1/-1" }}><label>Presets</label>
          <p className="hint">The same library powers the shape chips on the Volume tab.</p></div>
      </G>
    </>
  );
}
