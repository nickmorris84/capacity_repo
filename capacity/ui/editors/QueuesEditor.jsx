import { useState } from "react";
import { NumField, TextField, SelectField, Card, Hint } from "../components/primitives.jsx";
import { ApplyPreset, IntradaySliders } from "./PresetBar.jsx";
import { DependencyView } from "../components/DependencyView.jsx";
import { supportersOf, channelOf, generateWeeklySeries } from "../../engine/engine.js";
import { buildWeeklyRows, assumptionsColumns } from "../reporting.js";
import { MONTHS } from "../format.js";

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

// §24.2 sharing picker — share % of spare + the queues it shares with (any brand).
function SharingEditor({ config, q, ops }) {
  const on = !!q.sharing;
  const sh = q.sharing || { sharePct: 100, sharesWith: [] };
  const others = config.queues.filter((x) => x.id !== q.id);
  return (
    <div>
      <div className="rowflex" style={{ marginBottom: 8 }}>
        <label className="switch"><input type="checkbox" checked={on} onChange={(e) => ops.setSharing(q.id, e.target.checked)} data-testid="sharing-on" /><span className="track" aria-hidden="true" /><span>This queue shares its spare</span></label>
      </div>
      {on ? (
        <>
          <div className="fieldrow" style={{ maxWidth: 260 }}>
            <NumField label="Share of spare" unit="%" value={sh.sharePct == null ? 100 : sh.sharePct} onChange={(v) => ops.patchSharing(q.id, "sharePct", v)}
              hint="How much of this queue's spare capacity (above its own requirement) it offers to the queues below, split pro-rata by their shortfall." />
          </div>
          <div className="lab" style={{ margin: "10px 0 6px" }}>Shares with</div>
          <div className="rowflex" style={{ flexWrap: "wrap" }}>
            {others.map((x) => (
              <label key={x.id} className="switch">
                <input type="checkbox" checked={(sh.sharesWith || []).includes(x.id)} onChange={(e) => ops.toggleSharesWith(q.id, x.id, e.target.checked)} data-testid={"shares-" + q.id + "-" + x.id} />
                <span className="track" aria-hidden="true" /><span>{x.name} <span className="pill">{channelOf(x)}</span></span>
              </label>
            ))}
            {others.length === 0 && <p className="note">No other queues to share with.</p>}
          </div>
        </>
      ) : <p className="note">Not sharing. Turn on to lend this queue's spare to others in deficit.</p>}
    </div>
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

// §24.8 read-only view: scenario GROUPS whose scope targets this queue, and the
// factors inside them. Scope lives on the group (brands / channels / queues);
// an empty scope means the whole operation. Creation and targeting happen only
// on the Scenarios tab — this accordion never edits anything.
function groupTargetsQueue(group, q) {
  const sc = group.scope;
  if (!sc) return true;
  const anyTarget = (sc.brandIds || []).length || (sc.channels || []).length || (sc.queueIds || []).length;
  if (!anyTarget) return true;
  return (sc.brandIds || []).includes(q.brandId)
    || (sc.channels || []).includes(channelOf(q))
    || (sc.queueIds || []).includes(q.id);
}
function ScenariosAffecting({ config, q }) {
  const groups = (config.groups || []).filter((g) => Array.isArray(g.scenarioIds) && g.scenarioIds.length && groupTargetsQueue(g, q));
  const rows = groups.map((g) => ({
    group: g,
    factors: g.scenarioIds.map((id) => config.scenarios.find((s) => s.id === id)).filter(Boolean),
  })).filter((r) => r.factors.length);
  if (!rows.length) return <p className="note">No scenario groups currently target this queue. Create and target groups on the Scenarios tab.</p>;
  return (
    <div className="rows" style={{ gap: 8 }} data-testid="q-scenarios-readonly">
      <p className="note">Read-only. Scenario groups are created and targeted on the Scenarios tab; this shows the ones that reach this queue.</p>
      {rows.map(({ group, factors }) => (
        <div key={group.id} className="rowflex" style={{ flexWrap: "wrap", gap: 6 }}>
          <span className="tag soft">{group.name}</span>
          {factors.map((s) => <span key={s.id} className="pill">{s.name}{s.enabled ? "" : " (off)"}</span>)}
        </div>
      ))}
    </div>
  );
}

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

// §24.6 volume section — CSV paste | single figure + seasonality wizard | inherit.
function VolumesSection({ config, q, ops, seasonalityPresets }) {
  const [wizBase, setWizBase] = useState(q.dailyVolume != null ? q.dailyVolume : 500);
  const [wizPattern, setWizPattern] = useState("");
  const [csv, setCsv] = useState("");
  const mode = Array.isArray(q.weeklyVolumes) ? "series" : (q.dailyVolume == null ? "inherit" : "single");
  const runWizard = () => {
    const preset = seasonalityPresets.find((p) => p.id === wizPattern);
    const months = preset ? preset.months : new Array(12).fill(1);
    const series = generateWeeklySeries(config, Number(wizBase) || 0, months, config.engine.horizonWeeks);
    ops.setQueueVolume(q.id, "series", series);
  };
  const pasteCsv = () => {
    const arr = csv.split(/[\s,]+/).map((x) => Number(x)).filter((x) => !Number.isNaN(x));
    if (arr.length) ops.setQueueVolume(q.id, "series", arr);
  };
  return (
    <div className="acc-b">
      <div className="fieldrow" style={{ maxWidth: 320, marginBottom: 8 }}>
        <SelectField label="Volume source" value={mode} data-testid="vol-mode" onChange={(v) => {
          if (v === "single") ops.setQueueVolume(q.id, "single", q.dailyVolume != null ? q.dailyVolume : 500);
          else if (v === "inherit") ops.setQueueVolume(q.id, "inherit");
          else if (v === "series") ops.setQueueVolume(q.id, "series", Array.isArray(q.weeklyVolumes) ? q.weeklyVolumes : generateWeeklySeries(config, q.dailyVolume || 500, new Array(12).fill(1), config.engine.horizonWeeks));
        }}
          options={[{ value: "single", label: "Single figure" }, { value: "series", label: "Weekly series (CSV / wizard)" }, { value: "inherit", label: "Inherit from brand" }]} />
      </div>

      {mode === "single" && (
        <div className="fieldrow" style={{ maxWidth: 240 }}>
          <NumField label="Base daily volume" value={q.dailyVolume} onChange={(v) => ops.patchQueue(q.id, ["dailyVolume"], v)} />
        </div>
      )}

      {mode === "inherit" && (
        <div className="fieldrow" style={{ maxWidth: 240 }}>
          <NumField label="Brand share" value={q.volumeShare == null ? 1 : q.volumeShare} onChange={(v) => ops.patchQueue(q.id, ["volumeShare"], v)} hint="This queue's proportional share of its brand's volume, split across brand queues that inherit." />
        </div>
      )}

      {mode === "series" && (
        <>
          <div className="rowflex" style={{ marginBottom: 8 }}>
            <NumField label="Weekly figure" value={wizBase} onChange={setWizBase} />
            <div style={{ minWidth: 180 }}>
              <SelectField label="Seasonality pattern" value={wizPattern} onChange={setWizPattern}
                options={[{ value: "", label: "Flat" }, ...seasonalityPresets.map((p) => ({ value: p.id, label: p.name }))]} />
            </div>
            <button type="button" className="btn sm primary" onClick={runWizard} data-testid="vol-wizard-run" style={{ alignSelf: "flex-end" }}>Run seasonality wizard</button>
          </div>
          <p className="note" style={{ marginBottom: 8 }} data-testid="vol-wizard-note">
            The wizard multiplies your weekly figure by the chosen pattern's monthly multipliers, anchored to the Settings week-1 date, to fill every week. Every week stays editable below.
          </p>
          <div className="rowflex" style={{ marginBottom: 8 }}>
            <input type="text" className="inp" style={{ flex: 1, minWidth: 220 }} placeholder="paste a CSV weekly list (52+)" value={csv} onChange={(e) => setCsv(e.target.value)} data-testid="vol-csv" />
            <button type="button" className="btn sm" onClick={pasteCsv} data-testid="vol-csv-apply">Apply CSV</button>
          </div>
          {Array.isArray(q.weeklyVolumes) && (
            <div className="fieldrow" data-testid="vol-series" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(74px, 1fr))" }}>
              {q.weeklyVolumes.slice(0, config.engine.horizonWeeks).map((v, w) => (
                <div key={w} style={{ width: 74 }}><NumField label={"W" + (w + 1)} value={Math.round(v)} onChange={(nv) => ops.patchWeeklyVolume(q.id, w, nv)} /></div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QueueCard({ config, q, ops, sim, intradayPresets, seasonalityPresets, defaultOpen }) {
  const eng = config.engine, wf = q.wf, burn = q.burn;
  const res = q.resourcing || "dedicated";
  const unmanned = res === "unmanned";
  const ch = channelOf(q);
  const chLabel = ch.charAt(0).toUpperCase() + ch.slice(1);
  const bdg = badgeFor(res);
  const isDigital = q.type === "digital";
  const workflow = isDigital && q.subtype === "workflow";
  const voiceQueues = config.queues.filter((x) => channelOf(x) === "voice" && x.id !== q.id);
  return (
    <details className="erow" open={defaultOpen}>
      <summary>
        <span className="chev">▶</span>
        <strong>{q.name}</strong>
        {isDigital && <span className="qtype">{q.subtype === "workflow" ? "workflow" : "customer"}</span>}
        {bdg && <span className={"badge " + bdg}>{res}</span>}
        <span className="spacer" />
        <span className="btnbar" onClick={(e) => e.preventDefault()}>
          <button type="button" className="btn sm" onClick={() => ops.duplicateQueue(q.id)}>Duplicate</button>
          <button type="button" className="btn sm danger" onClick={() => ops.deleteQueue(q.id)}>Delete</button>
        </span>
      </summary>
      <div className="erow-b">
        {/* 1 — Description */}
        <details className="acc-sec" open={defaultOpen}>
          <summary><strong>Description</strong></summary>
          <div className="acc-b">
            <div className="fieldrow">
              <TextField label="Name" value={q.name} onChange={(v) => ops.patchQueue(q.id, ["name"], v)} />
              <SelectField label="Channel" value={q.channelId || ""} onChange={(v) => v && ops.attachQueueChannel(q.id, v)} id={"queue-channel-" + q.id}
                options={[{ value: "", label: "— pick a channel —" }, ...(config.channelDefs || []).map((d) => ({ value: d.id, label: d.name }))]} />
              {isDigital && (
                <SelectField label="Digital subtype" value={q.subtype || "customer"} onChange={(v) => ops.setQueueSubtype(q.id, v)} id={"subtype-" + q.id}
                  options={[{ value: "customer", label: "Customer (live)" }, { value: "workflow", label: "Workflow (backlog)" }]} />
              )}
              <NumField label={workflow ? "Handle time / item" : "AHT"} unit="s" value={q.aht} onChange={(v) => ops.patchQueue(q.id, ["aht"], v)} />
            </div>
            <p className="note">Attaching a channel sets this queue's channel group ({chLabel}) and inherits its template sections. Create channels in Settings → Channels.{isDigital ? (workflow ? " Workflow: backlog processing — no concurrency; SLA in hours." : " Customer: live interaction — concurrency and a minutes SLA.") : ""}</p>
          </div>
        </details>

        {/* 2 — Volumes */}
        <details className="acc-sec">
          <summary><strong>Volumes</strong></summary>
          <VolumesSection config={config} q={q} ops={ops} seasonalityPresets={seasonalityPresets} />
        </details>

        {/* Arrival pattern (part of demand shaping) */}
        <details className="acc-sec">
          <summary><strong>Arrival pattern</strong></summary>
          <div className="acc-b">
            <div className="rowflex">
              <ApplyPreset presets={intradayPresets} onApply={(p) => { ops.patchQueue(q.id, ["profile"], [...p.curve]); ops.patchQueue(q.id, ["arrivalPresetId"], p.id); }} label="Apply arrival pattern" />
              <span className="note" style={{ padding: "6px 10px" }}>Apply a pattern to link it live; editing that pattern in Settings re-simulates this queue. Hand-tuning below unlinks it.</span>
            </div>
            <IntradaySliders curve={q.profile} eng={eng} onChange={(next) => { ops.patchQueue(q.id, ["profile"], next); ops.patchQueue(q.id, ["arrivalPresetId"], null); }} />
          </div>
        </details>

        {/* 3 — Workforce (monthly cost; shrinkage lives here) */}
        <details className="acc-sec">
          <summary><InheritHeader q={q} section="workforce" label="Workforce" ops={ops} source={chLabel + " template"} /></summary>
          <div className="acc-b">
            <div className="fieldrow">
              <NumField label="Agent cost" unit="/mo" value={q.agentCostMonthly != null ? q.agentCostMonthly : (q.agentCost != null ? Math.round(q.agentCost / 12) : 0)} onChange={(v) => { ops.patchQueue(q.id, ["agentCostMonthly"], v); ops.patchQueue(q.id, ["agentCost"], v * 12); }} hint="Fully-loaded monthly cost per agent. The engine works weekly (× 12 ÷ 52)." />
              <NumField label="Shrinkage" unit="%" value={+(q.shrinkage * 100).toFixed(1)} onChange={(v) => ops.patchQueue(q.id, ["shrinkage"], v / 100)} hint="Paid time not on contacts — leave, sickness, meetings." />
              <NumField label="Attrition" unit="%/mo" value={+(wf.attrition * 100).toFixed(2)} onChange={(v) => ops.patchQueue(q.id, ["wf", "attrition"], v / 100)} />
            </div>
            <div className="fieldrow">
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

        {/* 4 — SLA (patience helper; shrinkage NOT here) */}
        <details className="acc-sec">
          <summary><InheritHeader q={q} section="sla" label="SLA" ops={ops} source={chLabel + " template"} /></summary>
          <div className="acc-b">
            {q.type === "voice" ? (
              <div className="fieldrow">
                <NumField label="ASA target" unit="s" value={q.asaTarget} onChange={(v) => ops.patchQueue(q.id, ["asaTarget"], v)} />
                <NumField label="Max abandon" unit="%" value={+(q.maxAbandon * 100).toFixed(2)} onChange={(v) => ops.patchQueue(q.id, ["maxAbandon"], v / 100)} />
                <NumField label="Patience" unit="s" value={q.patience} onChange={(v) => ops.patchQueue(q.id, ["patience"], v)} hint="Average seconds a caller waits before hanging up — drives abandonment; behaviour, not a target." />
              </div>
            ) : workflow ? (
              <div className="fieldrow">
                <NumField label="SLA within" unit="h" value={q.workflowSlaHours != null ? q.workflowSlaHours : 24} onChange={(v) => ops.patchQueue(q.id, ["workflowSlaHours"], v)} id={"q-sla-hours-" + q.id} />
                <NumField label="SLA target" unit="%" value={+((q.workflowSlaPct != null ? q.workflowSlaPct : 0.9) * 100).toFixed(0)} onChange={(v) => ops.patchQueue(q.id, ["workflowSlaPct"], v / 100)} />
                <NumField label="Backlog limit" value={q.backlogLimit} onChange={(v) => ops.patchQueue(q.id, ["backlogLimit"], v)} />
              </div>
            ) : (
              <div className="fieldrow">
                <NumField label="Concurrency" value={q.concurrency} onChange={(v) => ops.patchQueue(q.id, ["concurrency"], v)} id={"q-concurrency-" + q.id} />
                <NumField label="SLA within" unit="min" value={q.digitalSlaMinutes} onChange={(v) => ops.patchQueue(q.id, ["digitalSlaMinutes"], v)} />
                <NumField label="SLA target" unit="%" value={+(q.digitalSlaPct * 100).toFixed(1)} onChange={(v) => ops.patchQueue(q.id, ["digitalSlaPct"], v / 100)} />
                <NumField label="Backlog limit" value={q.backlogLimit} onChange={(v) => ops.patchQueue(q.id, ["backlogLimit"], v)} />
              </div>
            )}
            <div className="fieldrow" style={{ maxWidth: 220 }}>
              <NumField label="SLA attainment target" unit="%" value={+((q.slaAttainmentTarget != null ? q.slaAttainmentTarget : 0.9) * 100).toFixed(0)} onChange={(v) => ops.patchQueue(q.id, ["slaAttainmentTarget"], v / 100)} hint="Share of weeks that must hold SLA for the Business box to read green." />
            </div>
          </div>
        </details>

        {/* 5 — Knock-on (two figures, §24.1) */}
        <details className="acc-sec">
          <summary><strong>Knock-on</strong></summary>
          <div className="acc-b">
            <div className="fieldrow">
              <NumField label="Repeat contacts" unit="%" value={+(((q.knock || {}).repeatPct || 0) * 100).toFixed(0)} onChange={(v) => ops.patchKnock(q.id, "repeatPct", v / 100)} hint="Share of failed contacts that retry THIS queue next day." data-testid="knock-repeat" />
              <NumField label="Converts to calls" unit="%" value={+(((q.knock || {}).convertPct || 0) * 100).toFixed(0)} onChange={(v) => ops.patchKnock(q.id, "convertPct", v / 100)} hint="Share of failed contacts that turn into a call on the target voice queue." />
              <SelectField label="Call queue" value={(q.knock || {}).convertTarget || ""} onChange={(v) => ops.patchKnock(q.id, "convertTarget", v || null)}
                options={[{ value: "", label: "— none —" }, ...voiceQueues.map((x) => ({ value: x.id, label: x.name }))]} />
            </div>
          </div>
        </details>

        {/* 6 — Sharing (§24.2) */}
        <details className="acc-sec">
          <summary><strong>Sharing</strong></summary>
          <div className="acc-b"><SharingEditor config={config} q={q} ops={ops} /></div>
        </details>

        {/* 7 — Dependencies / mode */}
        <details className="acc-sec" open={defaultOpen}>
          <summary><strong>Dependencies &amp; mode</strong></summary>
          <div className="acc-b">
            <div className="fieldrow">
              <SelectField label="Brand" value={q.brandId} onChange={(v) => ops.setQueueBrand(q.id, v)} options={config.brands.map((b) => ({ value: b.id, label: b.name }))} id={"queue-brand-" + q.id} />
              <SelectField label="Resourcing" value={res} onChange={(v) => ops.setResourcing(q.id, v)} options={RES_OPTIONS} />
              <NumField label="Priority" value={q.priority} min={1} onChange={(v) => ops.patchQueue(q.id, ["priority"], Math.max(1, Math.round(v)))} />
              <HCField value={q.fte} disabled={unmanned} onChange={(v) => ops.patchQueue(q.id, ["fte"], v)} />
            </div>
            {unmanned && <span className="badge red">unmanned — served only via sharing / leverage</span>}
            {res === "leveraged" && <span className="badge amber">leveraged — donates to its targets</span>}
            <hr className="sep" style={{ margin: "12px 0" }} />
            <SupportsEditor config={config} q={q} ops={ops} />
          </div>
        </details>

        {/* Seasonality overlay */}
        <details className="acc-sec">
          <summary><InheritHeader q={q} section="seasonality" label="Seasonality" ops={ops} source="system pattern" /></summary>
          <div className="acc-b">
            {q.overrides && q.overrides.seasonality ? (
              <>
                <div className="rowflex" style={{ marginBottom: 8 }}>
                  <button type="button" className="btn sm" onClick={() => ops.patchQueue(q.id, ["seasonal"], Array.isArray(q.seasonal) ? q.seasonal : new Array(12).fill(1))}>Initialise overlay</button>
                  <ApplyPreset presets={seasonalityPresets} onApply={(p) => { ops.patchQueue(q.id, ["seasonal"], [...p.months]); ops.patchQueue(q.id, ["seasonalPresetId"], p.id); }} label="Apply seasonality pattern" />
                  {q.seasonalPresetId ? <span className="pill" data-testid={"q-seasonal-linked-" + q.id}>linked</span> : <span className="note" style={{ padding: "6px 10px" }}>Multiplies on top of the system pattern. Apply a pattern to link it live.</span>}
                </div>
                {Array.isArray(q.seasonal) && <div className="fieldrow">{q.seasonal.map((v, i) => <div key={i} style={{ width: 72 }}><NumField label={"M" + (i + 1)} unit="%" value={+(v * 100).toFixed(0)} onChange={(nv) => { const n = q.seasonal.slice(); n[i] = nv / 100; ops.patchQueue(q.id, ["seasonal"], n); ops.patchQueue(q.id, ["seasonalPresetId"], null); }} /></div>)}</div>}
              </>
            ) : <p className="note">Inheriting the system seasonality only. Turn on Override to add a queue overlay.</p>}
          </div>
        </details>

        {/* Scenarios affecting + Assumptions */}
        <details className="acc-sec">
          <summary><strong>Scenarios affecting this queue</strong></summary>
          <div className="acc-b"><ScenariosAffecting config={config} q={q} /></div>
        </details>
        <details className="acc-sec">
          <summary><strong>Assumptions over time</strong></summary>
          <div className="acc-b"><AssumptionsMini sim={sim} config={config} q={q} /></div>
        </details>
      </div>
    </details>
  );
}

// System seasonality — the multiplier applied to every queue.
function SystemSeasonality({ config, ops, seasonalityPresets }) {
  const seas = config.seasonality;
  const usingPreset = seas.systemPresetId ? seasonalityPresets.find((p) => p.id === seas.systemPresetId) : null;
  return (
    <Card title="System seasonality" hint="One multiplier per calendar month, applied to every queue from the week-1 date across the horizon. Apply a pattern to link it live — editing that pattern in Settings then re-simulates every queue. Hand-editing a month unlinks it.">
      <div className="rowflex" style={{ marginBottom: 12 }}>
        <ApplyPreset presets={seasonalityPresets} onApply={(p) => { ops.patch(["seasonality", "system"], [...p.months]); ops.patch(["seasonality", "systemPresetId"], p.id); }} label="Apply seasonality pattern" id="system-seasonality-apply" />
        {usingPreset
          ? <span className="pill" data-testid="system-seasonality-linked">Linked · {usingPreset.name}</span>
          : <span className="note" style={{ padding: "6px 10px" }}>Create and edit patterns in Settings → Seasonality patterns.</span>}
      </div>
      <div className="fieldrow">
        {MONTHS.map((m, i) => (
          <div key={m} style={{ width: 82 }}>
            <NumField label={m} unit="%" value={+((seas.system[i] || 0) * 100).toFixed(0)}
              onChange={(v) => { const n = seas.system.slice(); n[i] = v / 100; ops.patch(["seasonality", "system"], n); ops.patch(["seasonality", "systemPresetId"], null); }} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* Queues editor (§24 rebuild, top-down). A dependency view (graph | table) at
   the top, then system seasonality, then queues grouped Brand → Voice / Digital
   / Support, each a top-to-bottom creation flow: Description → Volumes →
   Workforce → SLA → Knock-on → Sharing → Dependencies/mode. Brand & channel
   creation lives in Settings. */
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
            return <QueueCard key={q.id} config={config} q={q} ops={ops} sim={sim} intradayPresets={intradayPresets} seasonalityPresets={seasonalityPresets} defaultOpen={open} />;
          })}
        </div>
      </div>
    ) : null;
    return (
      <div key={b.id} className="grid" style={{ gap: 8 }} data-testid={"brand-section-" + b.id}>
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
        <span className="note" style={{ padding: "6px 10px" }}>{config.queues.length} queue(s). New queues default to Voice / the first brand — change in the card. Create brands in Settings.</span>
      </div>
      <DependencyView config={config} sim={sim} />
      <SystemSeasonality config={config} ops={ops} seasonalityPresets={seasonalityPresets} />
      {config.brands.map((b) => brandSection(b))}
    </div>
  );
}
