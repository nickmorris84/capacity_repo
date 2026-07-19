import { NumField, TextField, SelectField, Card, Hint, Toggle } from "../components/primitives.jsx";
import { PresetBar, IntradaySliders } from "./PresetBar.jsx";
import { makeIntradayPreset } from "../presets.js";
import { supportersOf, channelOf } from "../../engine/engine.js";
import { buildWeeklyRows, assumptionsColumns } from "../reporting.js";

const RES_OPTIONS = [
  { value: "dedicated", label: "Dedicated" },
  { value: "leveraged", label: "Leveraged" },
  { value: "unmanned", label: "Unmanned" },
];
const badgeFor = (r) => (r === "unmanned" ? "red" : r === "leveraged" ? "amber" : null);

// §16 inheritance indicator + override toggle for an accordion section.
function InheritHeader({ q, section, label, ops, source }) {
  const overridden = !!(q.overrides && q.overrides[section]);
  return (
    <span className="rowflex" style={{ gap: 8, alignItems: "center" }}>
      <strong>{label}</strong>
      <span className={"inherit-ind " + (overridden ? "overridden" : "inherited")} data-testid={"inherit-" + section}>
        {overridden ? "overridden" : "inherited from " + source}
      </span>
      <span className="spacer" />
      <label className="switch" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={overridden} onChange={(e) => ops.setOverride(q.id, section, e.target.checked)} data-testid={"override-" + section} />
        <span className="track" aria-hidden="true" /><span style={{ fontSize: 11 }}>Override</span>
      </label>
    </span>
  );
}

function HCField({ value, onChange, disabled }) {
  return (
    <label className="field">
      <span className="lab">Starting HC <Hint text="Leave blank to draw a workload-weighted share of the global starting HC (Settings). Unmanned queues have no HC." /></span>
      <input type="number" value={disabled ? "" : (value == null ? "" : value)} placeholder={disabled ? "(unmanned — no HC)" : "(global share)"} disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="hc-input" />
    </label>
  );
}

function SupportsEditor({ config, q, ops }) {
  const others = config.queues.filter((x) => x.id !== q.id);
  const inbound = supportersOf(config, q.id);
  const nameOf = (id) => (config.queues.find((x) => x.id === id) || { name: id }).name;
  return (
    <div>
      <div className="lab" style={{ marginBottom: 6 }}>Supports / dependency list (outbound) <Hint text="Queues this one lends spare hours to. Lower priority = served first; within a tier spare splits by deficit." /></div>
      {(q.supports || []).length === 0 ? <p className="note" style={{ marginBottom: 8 }}>Not supporting any queue.</p> : (
        <div className="rows" style={{ marginBottom: 8 }}>
          {q.supports.map((s, i) => (
            <div className="rowflex" key={i}>
              <span style={{ minWidth: 130, fontWeight: 600 }}>{nameOf(s.queueId)}</span>
              <div style={{ width: 96 }}><NumField label="Priority" value={s.priority} min={1} onChange={(v) => ops.patchSupport(q.id, i, "priority", Math.max(1, v))} /></div>
              <div style={{ width: 110 }}><NumField label="Max share" unit="%" value={s.maxSharePct == null ? 100 : s.maxSharePct} onChange={(v) => ops.patchSupport(q.id, i, "maxSharePct", v)} /></div>
              <button type="button" className="btn sm danger" style={{ alignSelf: "flex-end" }} onClick={() => ops.deleteSupport(q.id, i)}>Remove</button>
            </div>
          ))}
        </div>
      )}
      <SelectField label="Add a queue to support" value="" onChange={(v) => v && ops.addSupport(q.id, v)}
        options={[{ value: "", label: "Choose a queue…" }, ...others.filter((x) => !(q.supports || []).some((s) => s.queueId === x.id)).map((x) => ({ value: x.id, label: x.name }))]} />
      <div className="lab" style={{ margin: "12px 0 4px" }}>Supported by (inbound)</div>
      {inbound.length ? <div className="rowflex">{inbound.map((s) => <span key={s.queueId} className="pill">{nameOf(s.queueId)} · pri {s.priority}</span>)}</div> : <p className="note">No queue currently supports this one.</p>}
    </div>
  );
}

// Read-only list of scenarios that touch this queue (§16 audit).
function ScenariosAffecting({ config, q }) {
  const hits = config.scenarios.filter((s) => {
    if (s.type === "unified") {
      const sc = s.scope;
      if (!sc || sc === "all" || sc.kind === "all") return true;
      if (sc.kind === "template") return channelOf(q) === sc.channel;
      if (sc.kind === "brand") return q.brandId === sc.brandId;
      if (sc.kind === "queues") return (sc.queueIds || []).includes(q.id);
      return false;
    }
    return s.queueIds === "all" || (Array.isArray(s.queueIds) && s.queueIds.includes(q.id));
  });
  if (!hits.length) return <p className="note">No scenarios currently target this queue.</p>;
  return <div className="rowflex" style={{ flexWrap: "wrap" }}>{hits.map((s) => <span key={s.id} className={"pill" + (s.enabled ? "" : "")}>{s.name}{s.enabled ? "" : " (off)"}</span>)}</div>;
}

// Per-queue assumptions-over-time mini table. E4: the sim can lag the live
// config for a beat after an edit, so render only when it already carries q.
function AssumptionsMini({ sim, config, q }) {
  if (!sim || !sim.weeks.length || !sim.weeks[0].queues[q.id]) return <p className="note">Recalculating…</p>;
  const cols = assumptionsColumns(q, config.engine.currency);
  const rows = buildWeeklyRows(sim, q, config).filter((_, i) => i % 4 === 0);
  return (
    <div className="tbl-wrap" style={{ maxHeight: 260 }}>
      <table className="data"><thead><tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.week}>{cols.map((c) => <td key={c.key} style={c.key === "scenarioTags" ? { textAlign: "left" } : undefined}>{c.fmt(r[c.key])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function QueueCard({ config, q, ops, sim, intradayPresets, setIntradayPresets, seasonalityPresets, setSeasonalityPresets, defaultOpen }) {
  const eng = config.engine, wf = q.wf, burn = q.burn;
  const res = q.resourcing || "dedicated";
  const unmanned = res === "unmanned";
  const ch = channelOf(q);
  const chLabel = ch.charAt(0).toUpperCase() + ch.slice(1);
  const bdg = badgeFor(res);
  return (
    <details className="erow" open={defaultOpen}>
      <summary>
        <span className="chev">▶</span>
        <strong>{q.name}</strong>
        {bdg && <span className={"badge " + bdg}>{res}</span>}
        <span className="spacer" />
        <span className="btnbar" onClick={(e) => e.preventDefault()}>
          <button type="button" className="btn sm" onClick={() => ops.duplicateQueue(q.id)}>Duplicate</button>
          <button type="button" className="btn sm danger" onClick={() => ops.deleteQueue(q.id)}>Delete</button>
        </span>
      </summary>
      <div className="erow-b">
        {/* Resourcing & headcount — always visible so the mode + HC are one glance */}
        <Card title="Resourcing & headcount">
          <div className="fieldrow">
            <SelectField label="Brand" value={q.brandId} onChange={(v) => ops.setQueueBrand(q.id, v)} options={config.brands.map((b) => ({ value: b.id, label: b.name }))} id={"queue-brand-" + q.id} />
            <SelectField label="Channel" value={ch} onChange={(v) => ops.patchQueue(q.id, ["channel"], v)} options={[{ value: "voice", label: "Voice" }, { value: "digital", label: "Digital" }, { value: "support", label: "Support" }]} />
            <SelectField label="Resourcing" value={res} onChange={(v) => ops.setResourcing(q.id, v)} options={RES_OPTIONS} />
            <NumField label="Priority" value={q.priority} min={1} onChange={(v) => ops.patchQueue(q.id, ["priority"], Math.max(1, Math.round(v)))} />
          </div>
          <div className="fieldrow">
            <HCField value={q.fte} disabled={unmanned} onChange={(v) => ops.patchQueue(q.id, ["fte"], v)} />
            {unmanned && <span className="badge red" style={{ alignSelf: "flex-end", marginBottom: 8 }}>unmanned — served only via recycling / pools</span>}
            {res === "leveraged" && <span className="badge amber" style={{ alignSelf: "flex-end", marginBottom: 8 }}>leveraged — donates to its targets</span>}
          </div>
        </Card>

        {/* Description */}
        <details className="acc-sec" open={defaultOpen}>
          <summary><strong>Description</strong></summary>
          <div className="acc-b">
            <div className="fieldrow">
              <TextField label="Name" value={q.name} onChange={(v) => ops.patchQueue(q.id, ["name"], v)} />
              <NumField label="Base daily volume" value={q.dailyVolume} onChange={(v) => ops.patchQueue(q.id, ["dailyVolume"], v)} />
              <NumField label="AHT" unit="s" value={q.aht} onChange={(v) => ops.patchQueue(q.id, ["aht"], v)} />
              <NumField label="Fully loaded cost" unit="/yr" value={q.agentCost} onChange={(v) => ops.patchQueue(q.id, ["agentCost"], v)} />
            </div>
          </div>
        </details>

        {/* SLAs */}
        <details className="acc-sec">
          <summary><InheritHeader q={q} section="sla" label="SLAs" ops={ops} source={chLabel + " template"} /></summary>
          <div className="acc-b">
            {q.type === "voice" ? (
              <div className="fieldrow">
                <NumField label="ASA target" unit="s" value={q.asaTarget} onChange={(v) => ops.patchQueue(q.id, ["asaTarget"], v)} />
                <NumField label="Max abandon" unit="%" value={+(q.maxAbandon * 100).toFixed(2)} onChange={(v) => ops.patchQueue(q.id, ["maxAbandon"], v / 100)} />
                <NumField label="Patience" unit="s" value={q.patience} onChange={(v) => ops.patchQueue(q.id, ["patience"], v)} />
              </div>
            ) : (
              <div className="fieldrow">
                <NumField label="Concurrency" value={q.concurrency} onChange={(v) => ops.patchQueue(q.id, ["concurrency"], v)} />
                <NumField label="SLA within" unit="min" value={q.digitalSlaMinutes} onChange={(v) => ops.patchQueue(q.id, ["digitalSlaMinutes"], v)} />
                <NumField label="SLA target" unit="%" value={+(q.digitalSlaPct * 100).toFixed(1)} onChange={(v) => ops.patchQueue(q.id, ["digitalSlaPct"], v / 100)} />
                <NumField label="Backlog limit" value={q.backlogLimit} onChange={(v) => ops.patchQueue(q.id, ["backlogLimit"], v)} />
              </div>
            )}
            <NumField label="Shrinkage" unit="%" value={+(q.shrinkage * 100).toFixed(1)} onChange={(v) => ops.patchQueue(q.id, ["shrinkage"], v / 100)} />
          </div>
        </details>

        {/* Arrival pattern */}
        <details className="acc-sec">
          <summary><strong>Arrival pattern</strong></summary>
          <div className="acc-b">
            <PresetBar presets={intradayPresets} applyLabel="Intraday preset"
              onApply={(p) => ops.patchQueue(q.id, ["profile"], [...p.curve])}
              onSaveAs={(name) => setIntradayPresets((lib) => [...lib, makeIntradayPreset(name, q.profile)])} />
            <IntradaySliders curve={q.profile} eng={eng} onChange={(next) => ops.patchQueue(q.id, ["profile"], next)} />
          </div>
        </details>

        {/* Workforce */}
        <details className="acc-sec">
          <summary><InheritHeader q={q} section="workforce" label="Workforce" ops={ops} source={chLabel + " template"} /></summary>
          <div className="acc-b">
            <div className="fieldrow">
              <NumField label="Attrition" unit="%/mo" value={+(wf.attrition * 100).toFixed(2)} onChange={(v) => ops.patchQueue(q.id, ["wf", "attrition"], v / 100)} />
              <NumField label="Req-to-start" unit="wk" value={wf.reqToStart} onChange={(v) => ops.patchQueue(q.id, ["wf", "reqToStart"], v)} />
              <NumField label="Training" unit="wk" value={wf.trainingWeeks} onChange={(v) => ops.patchQueue(q.id, ["wf", "trainingWeeks"], v)} />
              <NumField label="Burnout occ." unit="%" value={+(burn.occThreshold * 100).toFixed(0)} onChange={(v) => ops.patchQueue(q.id, ["burn", "occThreshold"], v / 100)} />
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="lab" style={{ marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }}>
                Manual hires (manual strategy) <span className="spacer" />
                <button type="button" className="btn sm" onClick={() => ops.addHire(q.id)} disabled={unmanned}>+ Add hire</button>
              </div>
              {(wf.hires || []).length === 0 ? <p className="note">No manual hires.</p> : (
                <div className="rows">
                  {wf.hires.map((h, hi) => (
                    <div className="rowflex" key={hi}>
                      <div style={{ width: 120 }}><NumField label="Week" value={h.week + 1} min={1} onChange={(v) => ops.patchHire(q.id, hi, "week", Math.max(0, v - 1))} /></div>
                      <div style={{ width: 120 }}><NumField label="Heads" value={h.heads} onChange={(v) => ops.patchHire(q.id, hi, "heads", v)} /></div>
                      <button type="button" className="btn sm danger" style={{ alignSelf: "flex-end" }} onClick={() => ops.deleteHire(q.id, hi)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </details>

        {/* Knock-on */}
        <details className="acc-sec">
          <summary><InheritHeader q={q} section="knockOn" label="Knock-on (repeat / spill)" ops={ops} source={chLabel + " template / Settings"} /></summary>
          <div className="acc-b">
            {q.overrides && q.overrides.knockOn ? (
              <div className="fieldrow">
                <NumField label="Repeat" unit="%" value={q.repeatPct == null ? "" : +(q.repeatPct * 100).toFixed(0)} onChange={(v) => ops.patchQueue(q.id, ["repeatPct"], v / 100)} />
                <NumField label="Spill" unit="%" value={q.spillPct == null ? "" : +(q.spillPct * 100).toFixed(0)} onChange={(v) => ops.patchQueue(q.id, ["spillPct"], v / 100)} />
                <SelectField label="Spill target" value={q.spillTargetQueue || q.deflectsTo || ""} onChange={(v) => ops.patchQueue(q.id, ["spillTargetQueue"], v || null)}
                  options={[{ value: "", label: "— none —" }, ...config.queues.filter((x) => x.id !== q.id).map((x) => ({ value: x.id, label: x.name }))]} />
              </div>
            ) : <p className="note">Inheriting the {chLabel} channel / Settings defaults. Turn on Override to set queue-specific repeat and spill.</p>}
          </div>
        </details>

        {/* Seasonality */}
        <details className="acc-sec">
          <summary><InheritHeader q={q} section="seasonality" label="Seasonality" ops={ops} source="system pattern" /></summary>
          <div className="acc-b">
            {q.overrides && q.overrides.seasonality ? (
              <>
                <div className="rowflex" style={{ marginBottom: 8 }}>
                  <button type="button" className="btn sm" onClick={() => ops.patchQueue(q.id, ["seasonal"], Array.isArray(q.seasonal) ? q.seasonal : new Array(12).fill(1))}>Initialise overlay</button>
                  <span className="note" style={{ padding: "6px 10px" }}>Queue overlay multiplies on top of the system pattern (Settings).</span>
                </div>
                {Array.isArray(q.seasonal) && <div className="fieldrow">{q.seasonal.map((v, i) => <div key={i} style={{ width: 72 }}><NumField label={"M" + (i + 1)} unit="%" value={+(v * 100).toFixed(0)} onChange={(nv) => { const n = q.seasonal.slice(); n[i] = nv / 100; ops.patchQueue(q.id, ["seasonal"], n); }} /></div>)}</div>}
              </>
            ) : <p className="note">Inheriting the system seasonality only. Turn on Override to add a queue overlay.</p>}
          </div>
        </details>

        {/* Scenarios affecting */}
        <details className="acc-sec">
          <summary><strong>Scenarios affecting this queue</strong></summary>
          <div className="acc-b"><ScenariosAffecting config={config} q={q} /></div>
        </details>

        {/* Dependencies */}
        <details className="acc-sec">
          <summary><strong>Dependencies</strong></summary>
          <div className="acc-b"><SupportsEditor config={config} q={q} ops={ops} /></div>
        </details>

        {/* Assumptions over time */}
        <details className="acc-sec">
          <summary><strong>Assumptions over time</strong></summary>
          <div className="acc-b"><AssumptionsMini sim={sim} config={config} q={q} /></div>
        </details>
      </div>
    </details>
  );
}

function BrandManager({ config, ops }) {
  return (
    <Card title="Brands (§15)" hint="A brand groups queues and carries one parameter block: its training profile. Queues adopt a brand in their Resourcing section."
      right={<button type="button" className="btn sm primary" onClick={() => ops.addBrand()} data-testid="add-brand">+ Add brand</button>}>
      <div className="rows">
        {config.brands.map((b) => (
          <div className="erow" key={b.id}>
            <div className="erow-h">
              <input type="text" className="inp" style={{ maxWidth: 220 }} value={b.name} aria-label="Brand name" onChange={(e) => ops.patchBrand(b.id, ["name"], e.target.value)} />
              <span className="pill">{config.queues.filter((q) => q.brandId === b.id).length} queue(s)</span>
              <span className="spacer" />
              {config.brands.length > 1 && <button type="button" className="btn sm danger" onClick={() => ops.deleteBrand(b.id)}>Delete</button>}
            </div>
            <div className="erow-b">
              <div className="rowflex" style={{ marginBottom: 8 }}>
                <Toggle checked={!!b.training} onChange={(v) => ops.toggleBrandTraining(b.id, v)} label="Brand training profile" />
                <NumField label="Brand daily volume" value={b.dailyVolume == null ? "" : b.dailyVolume} onChange={(v) => ops.patchBrand(b.id, ["dailyVolume"], v === 0 ? null : v)} hint="Optional — a brand volume split by proportional queue shares (queues with no explicit volume)." />
              </div>
              {b.training && (
                <div className="fieldrow">
                  <NumField label="Training weeks" value={b.training.trainingWeeks} onChange={(v) => ops.patchBrand(b.id, ["training", "trainingWeeks"], v)} />
                  <NumField label="Training shrinkage" unit="%" value={+((b.training.trainingShrinkagePct || 0) * 100).toFixed(1)} onChange={(v) => ops.patchBrand(b.id, ["training", "trainingShrinkagePct"], v / 100)} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PoolManager({ config, ops }) {
  const brandName = (id) => (config.brands.find((b) => b.id === id) || { name: "?" }).name;
  return (
    <Card title="Pools (§17)" hint="A pool is an explicit cross-brand / cross-channel sharing group. Members contribute spare (× their share) to any member in deficit, pro-rata, across brands."
      right={<button type="button" className="btn sm primary" onClick={() => ops.addPool()} data-testid="add-pool">+ Add pool</button>}>
      {(config.pools || []).length === 0 ? <p className="note">No pools. Add one to share spare capacity across brands and channels.</p> : (
        <div className="rows">
          {config.pools.map((p) => (
            <div className="erow" key={p.id}>
              <div className="erow-h">
                <input type="text" className="inp" style={{ maxWidth: 220 }} value={p.name} aria-label="Pool name" onChange={(e) => ops.renamePool(p.id, e.target.value)} />
                <span className="pill">{(p.members || []).length} member(s)</span>
                <span className="spacer" />
                <button type="button" className="btn sm danger" onClick={() => ops.deletePool(p.id)}>Delete</button>
              </div>
              <div className="erow-b">
                <div className="lab" style={{ marginBottom: 6 }}>Members (any brand / channel)</div>
                <div className="rowflex" style={{ flexWrap: "wrap" }}>
                  {config.queues.map((q) => {
                    const m = (p.members || []).find((x) => x.queueId === q.id);
                    return (
                      <label key={q.id} className="switch" style={{ minWidth: 200 }}>
                        <input type="checkbox" checked={!!m} onChange={(e) => ops.setPoolMember(p.id, q.id, e.target.checked)} data-testid={"pool-" + p.id + "-member-" + q.id} />
                        <span className="track" aria-hidden="true" />
                        <span>{q.name} <span className="pill">{brandName(q.brandId)}</span></span>
                        {m && <input type="number" className="inp" style={{ width: 60, marginLeft: 6 }} value={m.sharePct} aria-label="Share %" onChange={(e) => ops.patchPoolMember(p.id, q.id, Number(e.target.value))} />}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ChannelTemplates({ config, ops }) {
  const chans = config.channels || { voice: {}, digital: {}, support: {} };
  return (
    <Card title="Channel templates (§16)" hint="Section-level defaults each queue inherits unless it overrides them. Knock-on defaults set here flow to every queue of that channel that hasn't turned on its Knock-on override.">
      <div className="grid cols-2">
        {["voice", "digital", "support"].map((ch) => {
          const kn = (chans[ch] || {}).knockOn || {};
          return (
            <div className="erow" key={ch}>
              <div className="erow-h"><strong style={{ textTransform: "capitalize" }}>{ch}</strong><span className="pill">{config.queues.filter((q) => channelOf(q) === ch).length} queue(s)</span></div>
              <div className="erow-b">
                <div className="fieldrow">
                  <NumField label="Repeat default" unit="%" value={kn.repeatPct == null ? "" : +(kn.repeatPct * 100).toFixed(0)} onChange={(v) => ops.patchChannel(ch, ["knockOn", "repeatPct"], v === 0 ? 0 : v / 100)} />
                  <NumField label="Spill default" unit="%" value={kn.spillPct == null ? "" : +(kn.spillPct * 100).toFixed(0)} onChange={(v) => ops.patchChannel(ch, ["knockOn", "spillPct"], v === 0 ? 0 : v / 100)} />
                </div>
                <p className="note">Blank = inherit Settings / legacy loops.</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* Queues editor (§15–§18 restructure). Brand manager, pool manager and channel
   templates up top; queues grouped Brand → Voice/Digital/Support, each an
   accordion of Description, SLAs, Arrival, Workforce, Knock-on, Seasonality,
   Scenarios-affecting, Dependencies and Assumptions, with per-section
   inheritance indicators and dedicated/leveraged/unmanned resourcing. */
export function QueuesEditor({ config, ops, sim, intradayPresets, setIntradayPresets, seasonalityPresets, setSeasonalityPresets }) {
  let first = true;
  const brandSection = (b) => {
    const qs = config.queues.filter((q) => q.brandId === b.id);
    const byCh = (ch) => qs.filter((q) => channelOf(q) === ch);
    const chBlock = (label, list) => list.length ? (
      <div key={label}>
        <div className="section-title" style={{ marginTop: 6 }}>{label} <span className="pill">{list.length}</span></div>
        <div className="rows">
          {list.map((q) => {
            const open = first; first = false;
            return <QueueCard key={q.id} config={config} q={q} ops={ops} sim={sim} intradayPresets={intradayPresets} setIntradayPresets={setIntradayPresets} seasonalityPresets={seasonalityPresets} setSeasonalityPresets={setSeasonalityPresets} defaultOpen={open} />;
          })}
        </div>
      </div>
    ) : null;
    return (
      <div key={b.id} className="grid" style={{ gap: 8 }}>
        <div className="section-title" style={{ fontSize: 15, color: "var(--ink)" }}>Brand · {b.name} <span className="pill">{qs.length} queue(s)</span></div>
        {["voice", "digital", "support"].map((ch) => chBlock(ch.charAt(0).toUpperCase() + ch.slice(1), byCh(ch)))}
        {qs.length === 0 && <p className="note">No queues in this brand yet.</p>}
      </div>
    );
  };
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="btnbar">
        <button type="button" className="btn primary" onClick={() => ops.addQueue()}>+ Add queue</button>
        <span className="note" style={{ padding: "6px 10px" }}>{config.queues.length} queue(s). New queues default to Voice / the first brand — change in the card.</span>
      </div>
      <BrandManager config={config} ops={ops} />
      <PoolManager config={config} ops={ops} />
      <ChannelTemplates config={config} ops={ops} />
      {config.brands.map((b) => brandSection(b))}
    </div>
  );
}
