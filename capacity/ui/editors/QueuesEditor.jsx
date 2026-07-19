import { NumField, TextField, SelectField, Card, Hint } from "../components/primitives.jsx";
import { PresetBar, IntradaySliders } from "./PresetBar.jsx";
import { makeIntradayPreset } from "../presets.js";
import { supportersOf } from "../../engine/engine.js";

// Starting-HC field that allows a blank value (→ null) so the queue draws from
// the global starting-HC spread (§14.4).
function HCField({ value, onChange, disabled }) {
  return (
    <label className="field">
      <span className="lab">Starting HC <Hint text="Leave blank to draw a workload-weighted share of the global starting HC (set in Settings)." /></span>
      <input type="number" value={value == null ? "" : value} placeholder="(global share)" disabled={disabled}
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
      <div className="lab" style={{ marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }}>
        Supports (outbound) <Hint text="Queues this one lends spare hours to. Lower priority number = served first; within a tier, spare splits by deficit. Max share caps one recipient's take of this queue's spare." />
      </div>
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
      <SelectField
        label="Add a queue to support"
        value=""
        onChange={(v) => v && ops.addSupport(q.id, v)}
        options={[{ value: "", label: "Choose a queue…" }, ...others.filter((x) => !(q.supports || []).some((s) => s.queueId === x.id)).map((x) => ({ value: x.id, label: x.name }))]}
      />
      <div className="lab" style={{ margin: "12px 0 4px" }}>Supported by (inbound)</div>
      {inbound.length ? (
        <div className="rowflex">{inbound.map((s) => <span key={s.queueId} className="pill">{nameOf(s.queueId)} · pri {s.priority}{s.maxSharePct != null ? ` · ≤${s.maxSharePct}%` : ""}</span>)}</div>
      ) : <p className="note">No queue currently supports this one.</p>}
    </div>
  );
}

function QueueCard({ config, q, ops, intradayPresets, setIntradayPresets, defaultOpen }) {
  const eng = config.engine;
  const supported = q.resourcing === "supported";
  const wf = q.wf, burn = q.burn;
  return (
    <details className="erow" open={defaultOpen}>
      <summary>
        <span className="chev">▶</span>
        <strong>{q.name}</strong>
        {supported && <span className="badge amber">supported</span>}
        <span className="spacer" />
        <span className="btnbar" onClick={(e) => e.preventDefault()}>
          <button type="button" className="btn sm" onClick={() => ops.duplicateQueue(q.id)}>Duplicate</button>
          <button type="button" className="btn sm danger" onClick={() => ops.deleteQueue(q.id)}>Delete</button>
        </span>
      </summary>
      <div className="erow-b">
        {/* Description */}
        <Card title="Description">
          <div className="fieldrow">
            <TextField label="Name" value={q.name} onChange={(v) => ops.patchQueue(q.id, ["name"], v)} />
            <NumField label="Base daily volume" value={q.dailyVolume} onChange={(v) => ops.patchQueue(q.id, ["dailyVolume"], v)} />
            <NumField label="AHT / handle time" unit="s" value={q.aht} onChange={(v) => ops.patchQueue(q.id, ["aht"], v)} />
          </div>
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
              <SelectField label="Deflects to" value={q.deflectsTo || ""} onChange={(v) => ops.patchQueue(q.id, ["deflectsTo"], v || null)}
                options={[{ value: "", label: "— none —" }, ...config.queues.filter((x) => x.type === "voice").map((x) => ({ value: x.id, label: x.name }))]} />
            </div>
          )}
          <div className="fieldrow">
            <NumField label="Fully loaded cost" unit="/yr" value={q.agentCost} onChange={(v) => ops.patchQueue(q.id, ["agentCost"], v)} />
            <NumField label="Shrinkage" unit="%" value={+(q.shrinkage * 100).toFixed(1)} onChange={(v) => ops.patchQueue(q.id, ["shrinkage"], v / 100)} />
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="lab" style={{ marginBottom: 6 }}>Arrival pattern</div>
            <PresetBar presets={intradayPresets} applyLabel="Intraday preset"
              onApply={(p) => ops.patchQueue(q.id, ["profile"], [...p.curve])}
              onSaveAs={(name) => setIntradayPresets((lib) => [...lib, makeIntradayPreset(name, q.profile)])} />
            <IntradaySliders curve={q.profile} eng={eng} onChange={(next) => ops.patchQueue(q.id, ["profile"], next)} />
          </div>
        </Card>

        {/* Resourcing */}
        <Card title="Resourcing" hint="Supported queues get no headcount or hiring of their own; they are served only from supporter spare hours and service teams.">
          <div className="rowflex">
            <SelectField label="Mode" value={q.resourcing || "resourced"} onChange={(v) => ops.setResourcing(q.id, v)}
              options={[{ value: "resourced", label: "Resourced" }, { value: "supported", label: "Supported" }]} />
            {supported && <span className="badge amber" style={{ alignSelf: "flex-end", marginBottom: 8 }}>supported — no HC or hiring</span>}
          </div>
        </Card>

        {/* Workforce (migrated from the removed Workforce tab) */}
        <Card title="Workforce">
          <div className="fieldrow">
            <HCField value={supported ? 0 : q.fte} disabled={supported} onChange={(v) => ops.patchQueue(q.id, ["fte"], v)} />
            <NumField label="Attrition" unit="%/mo" value={+(wf.attrition * 100).toFixed(2)} onChange={(v) => ops.patchQueue(q.id, ["wf", "attrition"], v / 100)} />
            <NumField label="Req-to-start" unit="wk" value={wf.reqToStart} onChange={(v) => ops.patchQueue(q.id, ["wf", "reqToStart"], v)} />
            <NumField label="Training" unit="wk" value={wf.trainingWeeks} onChange={(v) => ops.patchQueue(q.id, ["wf", "trainingWeeks"], v)} />
          </div>
          <div className="fieldrow">
            <NumField label="Burnout occ. threshold" unit="%" value={+(burn.occThreshold * 100).toFixed(0)} onChange={(v) => ops.patchQueue(q.id, ["burn", "occThreshold"], v / 100)} />
            <NumField label="Burnout sensitivity" value={burn.sensitivity} step="0.1" onChange={(v) => ops.patchQueue(q.id, ["burn", "sensitivity"], v)} />
            <NumField label="Max attrition ×" value={burn.maxAttritionMult} step="0.1" onChange={(v) => ops.patchQueue(q.id, ["burn", "maxAttritionMult"], v)} />
          </div>
          <div style={{ marginTop: 8 }}>
            <div className="lab" style={{ marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }}>
              Manual hires (strategy S4 / manual) <Hint text="Per-queue requisitions by week — used by manual-plan strategies, ignoring the cap." />
              <span className="spacer" />
              <button type="button" className="btn sm" onClick={() => ops.addHire(q.id)} disabled={supported}>+ Add hire</button>
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
        </Card>

        {/* Interdependencies */}
        <Card title="Interdependencies">
          <SupportsEditor config={config} q={q} ops={ops} />
        </Card>
      </div>
    </details>
  );
}

/* Queues editor (§14 restructure): Voice and Digital sections, plus a Service
   teams section relocated from the removed Workforce tab. Each queue card holds
   Description, Resourcing, Workforce and Interdependencies. */
export function QueuesEditor({ config, ops, intradayPresets, setIntradayPresets }) {
  const voice = config.queues.filter((q) => q.type === "voice");
  const digital = config.queues.filter((q) => q.type === "digital");
  const section = (label, list) => (
    <div>
      <div className="section-title">{label} <span className="pill">{list.length}</span></div>
      <div className="rows">
        {list.length === 0 ? <p className="note">No {label.toLowerCase()} queues.</p>
          : list.map((q, i) => <QueueCard key={q.id} config={config} q={q} ops={ops} intradayPresets={intradayPresets} setIntradayPresets={setIntradayPresets} defaultOpen={i === 0} />)}
      </div>
    </div>
  );
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="btnbar">
        <button type="button" className="btn primary" onClick={() => ops.addQueue()}>+ Add queue</button>
        <span className="note" style={{ padding: "6px 10px" }}>{config.queues.length} queue(s). New queues default to Voice — change the channel in the card.</span>
      </div>
      {section("Voice", voice)}
      {section("Digital", digital)}
      <ServiceTeams config={config} ops={ops} />
    </div>
  );
}

// Service teams (relocated from the removed Workforce/Money tab).
function ServiceTeams({ config, ops }) {
  return (
    <div>
      <div className="section-title">Service teams <span className="pill">{config.serviceTeams.length}</span>
        <button type="button" className="btn sm primary" style={{ marginLeft: 10 }} onClick={ops.addServiceTeam}>+ Add team</button>
      </div>
      {config.serviceTeams.length === 0 ? <p className="note">No service teams.</p> : (
        <div className="rows">
          {config.serviceTeams.map((t, ti) => (
            <div className="erow" key={t.id}>
              <div className="erow-h"><strong>{t.name}</strong><span className="spacer" /><button type="button" className="btn sm danger" onClick={() => ops.deleteServiceTeam(t.id)}>Delete</button></div>
              <div className="erow-b">
                <div className="fieldrow">
                  <TextField label="Name" value={t.name} onChange={(v) => ops.patchServiceTeam(ti, ["name"], v)} />
                  <NumField label="Size" value={t.size} onChange={(v) => ops.patchServiceTeam(ti, ["size"], v)} />
                  <NumField label="Premium" unit="%" value={+(t.premiumPct * 100).toFixed(0)} onChange={(v) => ops.patchServiceTeam(ti, ["premiumPct"], v / 100)} />
                  <NumField label="Proficiency" unit="%" value={+(t.proficiency * 100).toFixed(0)} onChange={(v) => ops.patchServiceTeam(ti, ["proficiency"], v / 100)} />
                </div>
                <div className="fieldrow">
                  <NumField label="Trigger occ." unit="%" value={+(t.triggerOccupancy * 100).toFixed(0)} onChange={(v) => ops.patchServiceTeam(ti, ["triggerOccupancy"], v / 100)} />
                  <NumField label="Max hours" unit="/wk" value={t.maxHoursPerWeek} onChange={(v) => ops.patchServiceTeam(ti, ["maxHoursPerWeek"], v)} />
                  <NumField label="Agent cost" unit="/yr" value={t.agentCost} onChange={(v) => ops.patchServiceTeam(ti, ["agentCost"], v)} />
                </div>
                <div>
                  <div className="lab" style={{ marginBottom: 6 }}>Covers queues</div>
                  <div className="rowflex">
                    {config.queues.map((q) => (
                      <label key={q.id} className="switch">
                        <input type="checkbox" checked={(t.coversQueues || []).includes(q.id)} onChange={(e) => {
                          const cur = t.coversQueues || [];
                          ops.patchServiceTeam(ti, ["coversQueues"], e.target.checked ? [...cur, q.id] : cur.filter((id) => id !== q.id));
                        }} />
                        <span className="track" aria-hidden="true" /><span>{q.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
