import { useState } from "react";
import { NumField, TextField, SelectField, Toggle, Card, Hint } from "../components/primitives.jsx";
import { groupScenarioIds, channelOfQueue } from "../views.js";

const CHANNELS = [{ key: "voice", label: "Voice" }, { key: "digital", label: "Digital" }, { key: "support", label: "Support" }];

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

// §24.8 a single factor (unified scenario) inside a group — scope lives on the
// group, so the factor block carries no scope of its own.
function FactorParams({ s, ti, ops, horizon }) {
  const p = s.p || {};
  const set = (k, v) => ops.patchScenario(ti, ["p", k], v);
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

// §24.8 scope targets — brands / channels / queues; the group's factors inherit.
function ScopeEditor({ config, group, ops }) {
  const scope = group.scope || {};
  const chip = (kind, id, label, on) => (
    <label key={kind + id} className="switch">
      <input type="checkbox" checked={on} onChange={(e) => ops.toggleGroupScopeTarget(group.id, kind, id, e.target.checked)} data-testid={"scope-" + kind + "-" + id} />
      <span className="track" aria-hidden="true" /><span>{label}</span>
    </label>
  );
  const anyTarget = (scope.brandIds || []).length || (scope.channels || []).length || (scope.queueIds || []).length;
  return (
    <div>
      <div className="lab" style={{ marginBottom: 6 }}>Targets <Hint text="Brands, channels or queues this group's factors apply to. Empty = the whole operation." /></div>
      <div className="rowflex" style={{ flexWrap: "wrap", marginBottom: 6 }}>
        {(config.brands || []).map((b) => chip("brand", b.id, "Brand: " + b.name, (scope.brandIds || []).includes(b.id)))}
      </div>
      <div className="rowflex" style={{ flexWrap: "wrap", marginBottom: 6 }}>
        {CHANNELS.map((c) => chip("channel", c.key, c.label, (scope.channels || []).includes(c.key)))}
      </div>
      <div className="rowflex" style={{ flexWrap: "wrap" }}>
        {config.queues.map((q) => chip("queue", q.id, q.name, (scope.queueIds || []).includes(q.id)))}
      </div>
      {!anyTarget && <p className="note" style={{ marginTop: 6 }}>No targets — this group applies to the whole operation.</p>}
    </div>
  );
}

function GroupCard({ config, group, ops, horizon }) {
  const factorIds = Array.isArray(group.scenarioIds) ? group.scenarioIds : null;
  const editable = !group.builtin && factorIds != null;
  const factors = (factorIds || []).map((id) => config.scenarios.findIndex((s) => s.id === id)).filter((i) => i >= 0);
  return (
    <div className="erow" data-testid="group-card">
      <div className="erow-h">
        {group.builtin ? <span className="pill">built-in</span> : <span className="tag soft">group</span>}
        {editable ? <input type="text" className="inp" style={{ maxWidth: 240 }} value={group.name} aria-label="Group name" onChange={(e) => ops.renameGroup(group.id, e.target.value)} /> : <strong>{group.name}</strong>}
        <span className="pill">{groupScenarioIds(config, group.id).length} factor(s)</span>
        <span className="spacer" />
        {editable && <button type="button" className="btn sm primary" onClick={() => ops.addFactor(group.id)} data-testid={"add-factor-" + group.id}>+ Add factor</button>}
        {!group.builtin && <button type="button" className="btn sm danger" onClick={() => ops.deleteGroup(group.id)}>Delete</button>}
      </div>
      <div className="erow-b">
        {!factorIds && <p className="note">Built-in group — tracks the live enabled set of every group's factors.</p>}
        {editable && (
          <>
            <ScopeEditor config={config} group={group} ops={ops} />
            <hr className="sep" style={{ margin: "12px 0" }} />
            <div className="rows" data-testid="scenario-rows">
              {factors.map((ti) => {
                const s = config.scenarios[ti];
                return (
                  <div className="erow" key={s.id}>
                    <div className="erow-h">
                      <Toggle checked={s.enabled} onChange={(v) => ops.patchScenario(ti, ["enabled"], v)} />
                      <input type="text" className="inp" style={{ maxWidth: 220 }} value={s.name} aria-label="Factor name" onChange={(e) => ops.patchScenario(ti, ["name"], e.target.value)} />
                      <span className="pill">{s.parameter} · {s.mechanism}</span>
                      <span className="spacer" />
                      <button type="button" className="btn sm danger" onClick={() => ops.deleteScenario(s.id)}>Remove</button>
                    </div>
                    <div className="erow-b"><FactorParams s={s} ti={ti} ops={ops} horizon={horizon} /></div>
                  </div>
                );
              })}
              {factors.length === 0 && <p className="note">No factors yet. Add one above.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// §19 "what is in force each week" — a compact timeline of the enabled set.
function ParameterTimeline({ config }) {
  const N = config.engine.horizonWeeks;
  const enabled = config.scenarios.filter((s) => s.enabled);
  if (!enabled.length) return <p className="note">No factors enabled — nothing in force.</p>;
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
        <thead><tr><th style={{ textAlign: "left" }}>Factor</th>{weeks.filter((w) => w % 4 === 0).map((w) => <th key={w}>{w + 1}</th>)}</tr></thead>
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

/* Scenarios tab (§24.8), group-first. Everything is a scenario GROUP: a named,
   scoped bundle of factors. Create a group, target it at brands / channels /
   queues, then add factors inside it — there are no orphan line-item scenarios.
   Built-in groups (Plan of record, No scenarios) remain. */
export function ScenariosEditor({ config, ops }) {
  const [name, setName] = useState("");
  const horizon = config.engine.horizonWeeks;
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="btnbar">
        <input type="text" className="inp" style={{ maxWidth: 220 }} placeholder="new scenario group name" value={name} onChange={(e) => setName(e.target.value)} data-testid="group-name" />
        <button type="button" className="btn primary" onClick={() => { ops.addGroup(name.trim() || "New group", []); setName(""); }} data-testid="add-group">+ New scenario group</button>
        <span className="note" style={{ padding: "6px 10px" }}>A group scopes its factors to brands, channels or queues. {config.groups.length} group(s).</span>
      </div>

      <div className="rows" data-testid="groups">
        {(config.groups || []).map((g) => <GroupCard key={g.id} config={config} group={g} ops={ops} horizon={horizon} />)}
      </div>

      <Card title="Parameter timeline" sub="what is in force each week" hint="Which enabled factors fire in each 4-weekly checkpoint across the horizon.">
        <ParameterTimeline config={config} />
      </Card>
    </div>
  );
}
