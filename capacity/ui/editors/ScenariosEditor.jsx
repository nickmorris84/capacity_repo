import { useState } from "react";
import { NumField, TextField, SelectField, Toggle, Card, Hint } from "../components/primitives.jsx";
import { groupScenarioIds } from "../views.js";

const LEGACY_LABELS = {
  growth: "Growth %/mo", launch: "Product launch", p1: "P1 incident",
  forecastError: "Forecast error", attritionShock: "Attrition shock",
  hiringFreeze: "Hiring freeze", reducedTraining: "Reduced training",
  growthManual: "Manual weekly growth", freezeManual: "Manual freeze",
};

// Sparse week grid — click weeks to add/remove entries; optional value editor.
function WeekGrid({ horizon, value, onToggle, render }) {
  return (
    <div className="rowflex" style={{ gap: 4, flexWrap: "wrap" }} data-testid="week-grid">
      {Array.from({ length: horizon }, (_, w) => {
        const on = value(w);
        return (
          <div key={w} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <button type="button" className={"wk-cell" + (on ? " sel" : "")} data-st={on ? "green" : undefined}
              style={on ? undefined : { background: "var(--panel-2)", color: "var(--muted)" }}
              onClick={() => onToggle(w)} aria-pressed={on} aria-label={"Week " + (w + 1)}>{w + 1}</button>
            {on && render ? render(w) : null}
          </div>
        );
      })}
    </div>
  );
}

// §19 unified scenario parameter block.
function UnifiedParams({ s, ti, ops, horizon, config }) {
  const p = s.p || {};
  const set = (k, v) => ops.patchScenario(ti, ["p", k], v);
  const scope = s.scope || "all";
  return (
    <>
      <div className="fieldrow">
        <SelectField label="Tag" value={s.tag || "custom"} onChange={(v) => ops.patchScenario(ti, ["tag"], v)}
          options={["growth", "launch", "digitization", "p1", "custom"].map((v) => ({ value: v, label: v }))} />
        <SelectField label="Parameter" value={s.parameter} onChange={(v) => ops.patchScenario(ti, ["parameter"], v)}
          options={[{ value: "volume", label: "Volume" }, { value: "aht", label: "AHT" }, { value: "sla", label: "SLA" }, { value: "profileShares", label: "Profile shares" }, { value: "people", label: "People" }]} />
        <SelectField label="Mechanism" value={s.mechanism} onChange={(v) => ops.patchScenario(ti, ["mechanism"], v)}
          options={[{ value: "step", label: "Step" }, { value: "growthRate", label: "Growth rate" }, { value: "manualSeries", label: "Manual series" }]} />
        <SelectField label="Granularity" value={s.granularity || "week"} onChange={(v) => ops.patchScenario(ti, ["granularity"], v)}
          options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
      </div>
      <div className="fieldrow">
        <NumField label="Start week" value={s.startWeek + 1} min={1} onChange={(v) => ops.patchScenario(ti, ["startWeek"], Math.max(0, v - 1))} />
        <NumField label="Stop week" value={s.stopWeek == null ? "" : s.stopWeek + 1} onChange={(v) => ops.patchScenario(ti, ["stopWeek"], v ? v - 1 : null)} hint="Blank = runs to the horizon." />
        <SelectField label="Scope" value={scope === "all" || scope.kind === "all" ? "all" : scope.kind} onChange={(v) => ops.patchScenario(ti, ["scope"], v === "all" ? "all" : { kind: v, channel: "voice", brandId: (config.brands[0] || {}).id, queueIds: [] })}
          options={[{ value: "all", label: "All queues" }, { value: "template", label: "Channel" }, { value: "brand", label: "Brand" }, { value: "queues", label: "Queue list" }]} />
      </div>
      {s.mechanism === "step" && s.parameter !== "people" && s.parameter !== "profileShares" && (
        <NumField label="Step value" unit="%" value={+((p.value || 0) * 100).toFixed(1)} onChange={(v) => set("value", v / 100)} />
      )}
      {s.mechanism === "growthRate" && (
        <NumField label="Growth rate" unit="%/mo" value={+((p.rate || 0) * 100).toFixed(1)} onChange={(v) => set("rate", v / 100)} />
      )}
      {s.parameter === "people" && (
        <SelectField label="People change" value={p.kind || "attritionDelta"} onChange={(v) => set("kind", v)}
          options={[{ value: "attritionDelta", label: "Attrition delta" }, { value: "hiringFreeze", label: "Hiring freeze" }, { value: "trainingShrinkage", label: "Training shrinkage" }, { value: "headcountStep", label: "Headcount step" }]} />
      )}
      {s.mechanism === "manualSeries" && (
        <div style={{ marginTop: 8 }}>
          <div className="lab" style={{ marginBottom: 6 }}>Manual series — click a {s.granularity || "week"} to add it, then set its value</div>
          <WeekGrid horizon={horizon} value={(w) => (p.series || {})[w] != null} onToggle={(w) => {
            const ser = { ...(p.series || {}) };
            if (ser[w] != null) delete ser[w]; else ser[w] = 0.1;
            set("series", ser);
          }} render={(w) => (
            <input type="number" className="inp" style={{ width: 48, fontSize: 11, padding: "2px 4px" }} value={+(((p.series || {})[w] || 0) * 100).toFixed(0)}
              onChange={(e) => set("series", { ...(p.series || {}), [w]: Number(e.target.value) / 100 })} aria-label={"Period " + (w + 1) + " value"} />
          )} />
        </div>
      )}
    </>
  );
}

// Legacy-typed scenario parameters (kept so old configs and quick adds work).
function LegacyParams({ s, ti, ops, horizon }) {
  const set = (k, v) => ops.patchScenario(ti, ["p", k], v);
  const p = s.p || {};
  switch (s.type) {
    case "growth": return <NumField label="Rate" unit="%/mo" value={+((p.rate || 0) * 100).toFixed(1)} onChange={(v) => set("rate", v / 100)} />;
    case "growthManual": {
      const wp = p.weeklyPct || {};
      return (
        <div style={{ gridColumn: "1 / -1", width: "100%" }}>
          <div className="lab" style={{ marginBottom: 6 }}>Weekly % overrides — click a week, then set its %</div>
          <WeekGrid horizon={horizon} value={(w) => wp[w] != null} onToggle={(w) => { const n = { ...wp }; if (n[w] != null) delete n[w]; else n[w] = 0.1; set("weeklyPct", n); }}
            render={(w) => <input type="number" className="inp" style={{ width: 48, fontSize: 11, padding: "2px 4px" }} value={+(wp[w] * 100).toFixed(0)} onChange={(e) => set("weeklyPct", { ...wp, [w]: Number(e.target.value) / 100 })} aria-label={"Week " + (w + 1) + " %"} />} />
        </div>
      );
    }
    case "freezeManual": {
      const weeks = p.weeks || [];
      return (
        <div style={{ gridColumn: "1 / -1", width: "100%" }}>
          <div className="lab" style={{ marginBottom: 6 }}>Tick the weeks with no hiring</div>
          <WeekGrid horizon={horizon} value={(w) => weeks.includes(w)} onToggle={(w) => set("weeks", weeks.includes(w) ? weeks.filter((x) => x !== w) : [...weeks, w].sort((a, b) => a - b))} />
        </div>
      );
    }
    case "launch": return <><NumField label="Ramp" unit="wk" value={p.ramp} onChange={(v) => set("ramp", v)} /><NumField label="Peak" unit="%" value={+(p.peak * 100).toFixed(0)} onChange={(v) => set("peak", v / 100)} /><NumField label="Decay" unit="wk" value={p.decay} onChange={(v) => set("decay", v)} /></>;
    case "p1": return <><NumField label="Spike" unit="%" value={+(p.spike * 100).toFixed(0)} onChange={(v) => set("spike", v / 100)} /><NumField label="Days" value={p.days} min={1} max={7} onChange={(v) => set("days", v)} /></>;
    case "forecastError": return <NumField label="Error" unit="%" value={+(p.error * 100).toFixed(0)} onChange={(v) => set("error", v / 100)} />;
    case "attritionShock": return <NumField label="Added attrition" unit="%/mo" value={+(p.add * 100).toFixed(1)} onChange={(v) => set("add", v / 100)} />;
    case "hiringFreeze": return <NumField label="Duration" unit="wk" value={p.weeks} onChange={(v) => set("weeks", v)} />;
    case "reducedTraining": return <><NumField label="Cut weeks" value={p.cutWeeks} onChange={(v) => set("cutWeeks", v)} /><NumField label="AHT penalty" unit="%" value={+(p.ahtPenalty * 100).toFixed(0)} onChange={(v) => set("ahtPenalty", v / 100)} /></>;
    default: return null;
  }
}

// §19 groups manager (replaces scenario views).
function GroupsManager({ config, ops }) {
  const [name, setName] = useState("");
  const enabledIds = config.scenarios.filter((s) => s.enabled).map((s) => s.id);
  return (
    <Card title="Scenario groups" hint="A group bundles scenarios; it becomes a row of the decision matrix and a choice in the context bar. Built-ins: Plan of record (tracks the enabled set) and No scenarios."
      right={<div className="rowflex"><input type="text" className="inp" style={{ width: 160 }} placeholder="new group name" value={name} onChange={(e) => setName(e.target.value)} data-testid="group-name" /><button type="button" className="btn sm primary" disabled={!name.trim()} onClick={() => { ops.addGroup(name.trim(), enabledIds); setName(""); }} data-testid="add-group">Save enabled as group</button></div>}>
      <div className="rows">
        {(config.groups || []).map((g) => {
          const ids = groupScenarioIds(config, g.id);
          const editable = !g.builtin && Array.isArray(g.scenarioIds);
          return (
            <div className="erow" key={g.id}>
              <div className="erow-h">
                {g.builtin ? <span className="pill">built-in</span> : <span className="tag soft">saved</span>}
                {editable ? <input type="text" className="inp" style={{ maxWidth: 240 }} value={g.name} aria-label="Group name" onChange={(e) => ops.renameGroup(g.id, e.target.value)} /> : <strong>{g.name}</strong>}
                <span className="pill">{ids.length} scenario(s)</span>
                <span className="spacer" />
                {!g.builtin && <button type="button" className="btn sm danger" onClick={() => ops.deleteGroup(g.id)}>Delete</button>}
              </div>
              <div className="erow-b">
                {!Array.isArray(g.scenarioIds) && <p className="note">Tracks the live enabled set.</p>}
                {editable && (
                  <div className="rowflex" style={{ flexWrap: "wrap" }}>
                    {config.scenarios.map((s) => (
                      <label key={s.id} className="switch">
                        <input type="checkbox" checked={g.scenarioIds.includes(s.id)} onChange={(e) => ops.toggleGroupScenario(g.id, s.id, e.target.checked)} />
                        <span className="track" aria-hidden="true" /><span>{s.name}</span>
                      </label>
                    ))}
                    {config.scenarios.length === 0 && <span className="note" style={{ padding: "6px 10px" }}>No scenarios to add.</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// §19 "what is in force each week" — a compact timeline of the enabled set.
function ParameterTimeline({ config }) {
  const N = config.engine.horizonWeeks;
  const enabled = config.scenarios.filter((s) => s.enabled);
  if (!enabled.length) return <p className="note">No scenarios enabled — nothing in force.</p>;
  const fires = (s, w) => {
    const start = s.startWeek || 0;
    const stop = s.stopWeek != null ? s.stopWeek : (s.p && s.p.stopWeek != null ? s.p.stopWeek : null);
    if (w < start) return false;
    if (stop != null && w >= stop) return false;
    return true;
  };
  const weeks = Array.from({ length: Math.min(N, 52) }, (_, w) => w);
  return (
    <div className="tbl-wrap">
      <table className="data" data-testid="parameter-timeline">
        <thead><tr><th style={{ textAlign: "left" }}>Scenario</th>{weeks.filter((w) => w % 4 === 0).map((w) => <th key={w}>{w + 1}</th>)}</tr></thead>
        <tbody>
          {enabled.map((s) => (
            <tr key={s.id}>
              <td style={{ textAlign: "left", fontWeight: 600 }}>{s.name}</td>
              {weeks.filter((w) => w % 4 === 0).map((w) => <td key={w} className={fires(s, w) ? "st-green" : ""}>{fires(s, w) ? "●" : "·"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScenariosEditor({ config, ops }) {
  const horizon = config.engine.horizonWeeks;
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="btnbar">
        <SelectField label="Add scenario" value="" onChange={(v) => v && (v === "unified" ? ops.addUnifiedScenario() : ops.addScenario(v))}
          options={[{ value: "", label: "Choose a type…" }, { value: "unified", label: "Unified" }, ...Object.entries(LEGACY_LABELS).map(([value, label]) => ({ value, label }))]} />
        <span className="note" style={{ padding: "6px 10px", alignSelf: "flex-end" }}>{config.scenarios.filter((s) => s.enabled).length} enabled of {config.scenarios.length}.</span>
      </div>

      <div className="rows" data-testid="scenario-rows">
        {config.scenarios.map((s, ti) => (
          <div className="erow" key={s.id}>
            <div className="erow-h">
              <Toggle checked={s.enabled} onChange={(v) => ops.patchScenario(ti, ["enabled"], v)} />
              <strong>{s.name}</strong>
              <span className="pill">{s.type === "unified" ? `${s.parameter} · ${s.mechanism}` : (LEGACY_LABELS[s.type] || s.type)}</span>
              {s.enabled && <span className="tag soft">enabled</span>}
              <span className="spacer" />
              <button type="button" className="btn sm danger" onClick={() => ops.deleteScenario(s.id)}>Delete</button>
            </div>
            <div className="erow-b">
              <div className="fieldrow">
                <TextField label="Name" value={s.name} onChange={(v) => ops.patchScenario(ti, ["name"], v)} />
                {s.type !== "unified" && <NumField label="Start week" value={s.startWeek + 1} min={1} onChange={(v) => ops.patchScenario(ti, ["startWeek"], Math.max(0, v - 1))} />}
                {s.type !== "unified" && (
                  <SelectField label="Applies to" value={s.queueIds === "all" ? "all" : "some"} onChange={(v) => ops.patchScenario(ti, ["queueIds"], v === "all" ? "all" : [])}
                    options={[{ value: "all", label: "All queues" }, { value: "some", label: "Specific queues" }]} />
                )}
              </div>
              {s.type === "unified" ? <UnifiedParams s={s} ti={ti} ops={ops} horizon={horizon} config={config} /> : <div className="fieldrow"><LegacyParams s={s} ti={ti} ops={ops} horizon={horizon} /></div>}
              {s.type !== "unified" && s.queueIds !== "all" && (
                <div className="rowflex" style={{ flexWrap: "wrap" }}>
                  {config.queues.map((q) => (
                    <label key={q.id} className="switch">
                      <input type="checkbox" checked={(s.queueIds || []).includes(q.id)} onChange={(e) => {
                        const cur = Array.isArray(s.queueIds) ? s.queueIds : [];
                        ops.patchScenario(ti, ["queueIds"], e.target.checked ? [...cur, q.id] : cur.filter((id) => id !== q.id));
                      }} />
                      <span className="track" aria-hidden="true" /><span>{q.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {s.type === "unified" && (s.scope && s.scope.kind === "queues") && (
                <div className="rowflex" style={{ flexWrap: "wrap" }}>
                  {config.queues.map((q) => (
                    <label key={q.id} className="switch">
                      <input type="checkbox" checked={(s.scope.queueIds || []).includes(q.id)} onChange={(e) => {
                        const cur = s.scope.queueIds || [];
                        ops.patchScenario(ti, ["scope"], { ...s.scope, queueIds: e.target.checked ? [...cur, q.id] : cur.filter((id) => id !== q.id) });
                      }} />
                      <span className="track" aria-hidden="true" /><span>{q.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {config.scenarios.length === 0 && <div className="empty">No scenarios. Add one above.</div>}
      </div>

      <GroupsManager config={config} ops={ops} />
      <Card title="Parameter timeline" sub="what is in force each week" hint="Which enabled scenarios fire in each 4-weekly checkpoint across the horizon.">
        <ParameterTimeline config={config} />
      </Card>
    </div>
  );
}
