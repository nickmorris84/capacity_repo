import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Card, Chart, NumField, TextField, SelectField, Hint } from "./primitives.jsx";
import { strategyList, strategyObj, resolveStrategyName, isSchedule, scheduleSummary, strategyBlurb } from "../views.js";
import { money, pct, num } from "../format.js";

const SERIES = ["#0e7c86", "#d98a0b", "#5a54c9", "#c0417a", "#2f8f4e", "#b0602a", "#3a7bd5", "#8a51b0"];
const METRICS = [
  { id: "allin", label: "All-in cost", cost: true },
  { id: "hccost", label: "HC cost only", cost: true },
  { id: "coverage", label: "Coverage", cost: false },
];

function scopeQueues(config, scope) {
  if (scope === "overall") return config.queues;
  if (scope === "voice") return config.queues.filter((q) => q.type === "voice");
  if (scope === "digital") return config.queues.filter((q) => q.type === "digital");
  return config.queues.filter((q) => q.id === scope);
}
function weekValue(week, metric, scope, config) {
  if (metric === "coverage") {
    let act = 0, req = 0;
    for (const q of scopeQueues(config, scope)) { const s = week.queues[q.id]; act += s.active != null ? s.active : s.trained + s.ramp; req += s.reqFte; }
    return req > 0 ? act / req : 1;
  }
  if (scope === "overall") return metric === "allin" ? week.totals.allInCost : week.totals.totalCost;
  let v = 0;
  for (const q of scopeQueues(config, scope)) { const s = week.queues[q.id]; v += metric === "allin" ? s.cost + s.churnCost : s.cost; }
  return v;
}

// ---- comparison ----
function Comparison({ sims, stratIds, config }) {
  const cur = config.engine.currency;
  const [metric, setMetric] = useState("allin");
  const [scope, setScope] = useState("overall");
  const m = METRICS.find((x) => x.id === metric);
  const scopeOpts = [
    { value: "overall", label: "Overall" }, { value: "voice", label: "Voice" }, { value: "digital", label: "Digital" },
    ...config.queues.map((q) => ({ value: q.id, label: q.name })),
  ];
  const live = stratIds.filter((id) => sims[id]);
  const len = live.reduce((a, id) => Math.max(a, sims[id].weeks.length), 0);
  const data = [];
  for (let w = 0; w < len; w++) {
    const row = { wk: w + 1 };
    for (const id of live) {
      const sim = sims[id];
      if (w >= sim.weeks.length) continue;
      if (m.cost) { let c = 0; for (let i = 0; i <= w; i++) c += weekValue(sim.weeks[i], metric, scope, config); row[id] = Math.round(c); }
      else row[id] = +(weekValue(sim.weeks[w], metric, scope, config) * 100).toFixed(1);
    }
    data.push(row);
  }
  const fmtY = m.cost ? (v) => money(cur, v) : (v) => v + "%";
  const summary = live.map((id) => {
    const sim = sims[id];
    let val;
    if (m.cost) val = sim.weeks.reduce((a, wk) => a + weekValue(wk, metric, scope, config), 0);
    else val = sim.weeks.reduce((a, wk) => a + weekValue(wk, metric, scope, config), 0) / sim.weeks.length;
    return { id, val };
  });

  return (
    <Card
      title="Detailed comparison"
      hint="Compare strategies on a chosen metric and scope. Cost metrics are cumulative over the horizon; coverage is the active-vs-required ratio."
      right={
        <div className="rowflex">
          <select className="inp" style={{ width: 150 }} value={metric} onChange={(e) => setMetric(e.target.value)} data-testid="cmp-metric" aria-label="Metric">
            {METRICS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          <select className="inp" style={{ width: 150 }} value={scope} onChange={(e) => setScope(e.target.value)} data-testid="cmp-scope" aria-label="Scope">
            {scopeOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      }
    >
      <div data-testid="cmp-chart" data-series={live.length}>
        <Chart title="" height={280}>
          {(w, h) => (
            <LineChart width={w} height={h} data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
              <XAxis dataKey="wk" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
              <YAxis tick={{ fontSize: 11 }} width={54} tickFormatter={fmtY} />
              <Tooltip formatter={fmtY} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {live.map((id, i) => <Line key={id} type="monotone" dataKey={id} name={resolveStrategyName(config, id)} stroke={SERIES[i % SERIES.length]} dot={false} strokeWidth={2} isAnimationActive={false} />)}
            </LineChart>
          )}
        </Chart>
      </div>
      <div className="tbl-wrap" style={{ marginTop: 12 }}>
        <table className="data" data-testid="cmp-table">
          <thead><tr><th>Strategy</th><th>{m.label} ({m.cost ? "total" : "avg"})</th></tr></thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.id}><td style={{ textAlign: "left" }}>{resolveStrategyName(config, s.id)}</td><td>{m.cost ? money(cur, s.val) : pct(s.val)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---- strategy editor (§14.1) ----
function StrategyEditor({ config, ops, activeStrategyId }) {
  const [newType, setNewType] = useState("");
  const [schedName, setSchedName] = useState("");
  const list = strategyList(config);
  const active = strategyObj(config, activeStrategyId);

  return (
    <Card
      title="Strategies"
      hint="Built-ins S1–S4 plus your own. Custom strategies parameterise a base type; schedules pivot between strategies at set weeks."
      right={
        <div className="rowflex">
          <select className="inp" style={{ width: 160 }} value={newType} onChange={(e) => { if (e.target.value) { ops.addStrategy(e.target.value); setNewType(""); } }} data-testid="add-strategy" aria-label="Add strategy">
            <option value="">+ Add strategy…</option>
            <option value="meet">Meet requirement</option>
            <option value="buffer">Buffer above</option>
            <option value="backfill">Forward backfill</option>
            <option value="manual">Manual plan</option>
            <option value="schedule">Schedule</option>
          </select>
        </div>
      }
    >
      {isSchedule(active) && (
        <div className="rowflex" style={{ marginBottom: 12 }}>
          <input type="text" className="inp" style={{ maxWidth: 220 }} placeholder="name this schedule" value={schedName} onChange={(e) => setSchedName(e.target.value)} data-testid="save-schedule-name" />
          <button type="button" className="btn sm" disabled={!schedName.trim()} onClick={() => { ops.saveScheduleAsStrategy(schedName.trim(), active.segments || []); setSchedName(""); }} data-testid="save-schedule">Save current schedule as strategy</button>
        </div>
      )}
      <div className="rows">
        {list.map((s) => (
          <details className="erow" key={s.id}>
            <summary>
              <span className="chev">▶</span>
              <strong>{s.name}</strong>
              <span className="pill">{s.baseType}</span>
              {s.builtin && <span className="pill">built-in</span>}
              {s.id === activeStrategyId && <span className="tag soft">active</span>}
              <span className="spacer" />
              <span className="btnbar" onClick={(e) => e.preventDefault()}>
                <button type="button" className="btn sm" onClick={() => ops.duplicateStrategy(s.id)}>Duplicate</button>
                {!s.builtin && <button type="button" className="btn sm danger" onClick={() => ops.deleteStrategy(s.id)}>Delete</button>}
              </span>
            </summary>
            <div className="erow-b">
              <p className="note">{strategyBlurb(s)}</p>
              {s.baseType === "manual" && (
                <p className="note" data-testid={"strat-manual-note-" + s.id}>Manual (S4): simulates exactly the hiring plan you enter on each queue, and ignores the hiring cap.</p>
              )}
              {/* §24.4 editable parameters on EVERY strategy (built-ins included). */}
              <div className="fieldrow">
                {!s.builtin && <TextField label="Name" value={s.name} onChange={(v) => ops.patchStrategy(s.id, ["name"], v)} />}
                {s.baseType === "buffer" && (
                  <NumField label="Buffer" unit="%" id={"strat-buffer-" + s.id}
                    value={+(((s.bufferPct != null ? s.bufferPct : config.hiring.buffer)) * 100).toFixed(0)}
                    onChange={(v) => ops.patchStrategy(s.id, ["bufferPct"], v / 100)}
                    hint="Target = requirement × (1 + buffer). Editable per strategy." />
                )}
                {s.baseType === "backfill" && (
                  <NumField label="Forward months" id={"strat-fwd-" + s.id} min={1} max={6}
                    value={s.forwardMonths != null ? s.forwardMonths : 3}
                    onChange={(v) => ops.patchStrategy(s.id, ["forwardMonths"], Math.max(1, Math.min(6, Math.round(v || 3))))}
                    hint="How far ahead (1–6 months) the leaver projection looks when sizing replacement hiring." />
                )}
              </div>
              {["meet", "buffer", "backfill", "manual"].includes(s.baseType) && (
                <div>
                  <div className="lab" style={{ marginBottom: 6, display: "flex", gap: 6 }}>Excluded queues <Hint text="Queues this strategy raises no requisitions for." /></div>
                  <div className="rowflex">
                    {config.queues.map((q) => {
                      const on = (s.excludedQueueIds || []).includes(q.id);
                      return (
                        <label key={q.id} className="switch">
                          <input type="checkbox" checked={on} onChange={(e) => {
                            const cur = s.excludedQueueIds || [];
                            ops.patchStrategy(s.id, ["excludedQueueIds"], e.target.checked ? [...cur, q.id] : cur.filter((x) => x !== q.id));
                          }} />
                          <span className="track" aria-hidden="true" /><span>{q.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {s.baseType === "schedule" && (
                <div>
                  <div className="lab" style={{ marginBottom: 6 }}>Segments — {scheduleSummary(config, s) || "empty"}</div>
                  {(s.segments || []).map((seg, i) => (
                    <div className="rowflex" key={i} style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>from wk</span>
                      <input type="number" className="inp" style={{ width: 70 }} min={1} value={seg.fromWeek} onChange={(e) => ops.patchSegment(s.id, i, "fromWeek", Math.max(1, Number(e.target.value) || 1))} />
                      <select className="inp" style={{ flex: 1, maxWidth: 220 }} value={seg.strategyId} onChange={(e) => ops.patchSegment(s.id, i, "strategyId", e.target.value)}>
                        {list.filter((x) => x.id !== s.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                      <button type="button" className="btn sm danger" onClick={() => ops.deleteSegment(s.id, i)}>Remove</button>
                    </div>
                  ))}
                  <button type="button" className="btn sm" onClick={() => ops.addSegment(s.id)}>+ Segment</button>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </Card>
  );
}

export function StrategiesTab({ simSet, config, activeStrategy, ops }) {
  return (
    <div className="grid" style={{ gap: 16 }} data-testid="strategies-panel">
      <StrategyEditor config={config} ops={ops} activeStrategyId={activeStrategy} />
      <Comparison sims={simSet.sims} stratIds={simSet.stratIds} config={config} />
    </div>
  );
}
