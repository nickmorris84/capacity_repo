import {
  LineChart, Line, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { Card } from "./primitives.jsx";
import { buildVerdict, buildAudienceBlocks, buildRiskRegister, columnsFor, buildWeeklyRows } from "../reporting.js";
import { STRATEGIES, strategyStats, strategyName, viewName } from "../views.js";
import { money, moneyFull, pct, num } from "../format.js";

// Report charts render at a FIXED pixel width — recharts' ResponsiveContainer
// collapses to 0 in print, so the report never uses it (SPEC §8).
const RW = 640, RH = 240;

function AllInChart({ strategySims, cur }) {
  const live = STRATEGIES.filter((s) => strategySims[s.id]).map((s) => ({ id: s.id, name: `${s.id} · ${s.name}`, sim: strategySims[s.id] }));
  const len = live.reduce((m, s) => Math.max(m, s.sim.weeks.length), 0);
  const colors = ["#0e7c86", "#d98a0b", "#5a54c9", "#c0417a"];
  const data = [];
  for (let w = 0; w < len; w++) {
    const row = { wk: w + 1 };
    live.forEach((s) => { let c = 0; for (let i = 0; i <= w && i < s.sim.weeks.length; i++) c += s.sim.weeks[i].totals.allInCost; row[s.id] = Math.round(c); });
    data.push(row);
  }
  return (
    <div className="report-chart" data-testid="report-chart" data-fixed-width={RW}>
      <LineChart width={RW} height={RH} data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
        <XAxis dataKey="wk" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
        <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(v) => money(cur, v)} />
        <Tooltip formatter={(v) => money(cur, v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {live.map((s, i) => <Line key={s.id} type="monotone" dataKey={s.id} name={s.name} stroke={colors[i % colors.length]} dot={false} strokeWidth={2} isAnimationActive={false} />)}
      </LineChart>
    </div>
  );
}

function QueueCharts({ sim, queue }) {
  const cover = sim.weeks.map((w) => ({ wk: w.week + 1, cover: +(w.queues[queue.id].cover * 100).toFixed(1) }));
  const hc = sim.weeks.map((w) => {
    const s = w.queues[queue.id];
    return { wk: w.week + 1, trained: +s.trained.toFixed(1), ramping: +s.ramp.toFixed(1), training: +s.training.toFixed(1), required: +s.reqFte.toFixed(1) };
  });
  return (
    <>
      <div className="report-chart" data-testid="report-chart" data-fixed-width={RW}>
        <LineChart width={RW} height={RH} data={cover} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="wk" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={{ fontSize: 11 }} width={40} tickFormatter={(v) => v + "%"} />
          <Tooltip formatter={(v) => v + "%"} />
          <ReferenceLine y={100} stroke="#1f9d55" strokeDasharray="4 2" />
          <Line type="monotone" dataKey="cover" name="Coverage" stroke="#0e7c86" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </div>
      <div className="report-chart" data-testid="report-chart" data-fixed-width={RW}>
        <ComposedChart width={RW} height={RH} data={hc} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis dataKey="wk" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={{ fontSize: 11 }} width={40} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="trained" stackId="hc" stroke="#0e7c86" fill="#0e7c86" fillOpacity={0.75} isAnimationActive={false} />
          <Area type="monotone" dataKey="ramping" stackId="hc" stroke="#12a3b0" fill="#57c3cc" fillOpacity={0.7} isAnimationActive={false} />
          <Area type="monotone" dataKey="training" stackId="hc" stroke="#d98a0b" fill="#f0c774" fillOpacity={0.7} isAnimationActive={false} />
          <Line type="monotone" dataKey="required" name="Required" stroke="#0f1720" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </div>
    </>
  );
}

export function ReportTab({ sim, strategySims, config, activeStrategy, activeViewId }) {
  const cur = config.engine.currency;
  const verdict = buildVerdict(strategySims, activeStrategy, activeViewId, config);
  const blocks = buildAudienceBlocks(sim, config);
  const risks = buildRiskRegister(sim, config);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="btnbar">
        <button type="button" className="btn primary" onClick={() => window.print()}>Print / Save as PDF</button>
        <span className="note" style={{ padding: "6px 10px" }}>iPhone: Print → pinch out on the preview → Share → Save to Files.</span>
      </div>

      <div className="report" data-testid="report">
        <div className="report-section card"><div className="card-b">
          <h2 style={{ marginTop: 0 }}>Capacity plan — executive report</h2>
          <p style={{ color: "var(--muted)", marginTop: -6 }}>Strategy {activeStrategy} ({strategyName(activeStrategy)}) · view {viewName(config, activeViewId)} · {sim.weeks.length}-week horizon</p>
          <p style={{ fontSize: 14, lineHeight: 1.55 }}>{verdict.paragraph}</p>
          <div className="stat-row">
            <div className="stat"><div className="l">All-in cost</div><div className="v">{money(cur, blocks.finance.allIn)}</div></div>
            <div className="stat"><div className="l">Run cost</div><div className="v">{money(cur, blocks.finance.runCost)}</div></div>
            <div className="stat"><div className="l">Churn cost</div><div className="v">{money(cur, blocks.finance.churn)}</div></div>
            <div className="stat"><div className="l">Customers lost</div><div className="v">{num(blocks.business.customersLost, 0)}</div></div>
          </div>
        </div></div>

        <div className="report-section card"><div className="card-b">
          <h3>Key findings</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {sim.summary.findings.map((f, i) => <li key={i} style={{ marginBottom: 6, color: f.tone === "red" ? "var(--red)" : f.tone === "amber" ? "var(--amber)" : "var(--text)" }}>{f.text}</li>)}
            {sim.summary.findings.length === 0 && <li>The plan holds across the horizon.</li>}
          </ul>
        </div></div>

        <div className="report-section card"><div className="card-b">
          <h3>Risk register</h3>
          <div className="tbl-wrap">
            <table className="data">
              <thead><tr><th>Risk</th><th>Week</th><th>Severity</th><th>Lever</th></tr></thead>
              <tbody>
                {risks.map((r, i) => (
                  <tr key={i}><td style={{ textAlign: "left" }}>{r.risk}</td><td>{r.week ?? "–"}</td><td>{r.severityMoney != null ? money(cur, r.severityMoney) : (r.sla || "–")}</td><td style={{ textAlign: "left", whiteSpace: "normal" }}>{r.lever}</td></tr>
                ))}
                {risks.length === 0 && <tr><td colSpan={4} className="empty">No material risks.</td></tr>}
              </tbody>
            </table>
          </div>
        </div></div>

        <div className="report-section card"><div className="card-b">
          <h3>Strategy comparison</h3>
          <div className="tbl-wrap">
            <table className="data">
              <thead><tr><th>Strategy</th><th>Red wks</th><th>End HC</th><th>Run cost</th><th>Churn</th><th>All-in</th><th>Feasible</th></tr></thead>
              <tbody>
                {STRATEGIES.filter((s) => strategySims[s.id]).map((s) => {
                  const st = strategyStats(strategySims[s.id]);
                  return <tr key={s.id}><td style={{ textAlign: "left" }}>{s.id} {s.name}</td><td>{st.redWeeks}</td><td>{num(st.endHC, 0)}</td><td>{money(cur, st.runCost)}</td><td>{money(cur, st.churn)}</td><td>{money(cur, st.allIn)}</td><td>{st.feasible ? "yes" : "no"}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <h4>Cumulative all-in cost by strategy</h4>
          <AllInChart strategySims={strategySims} cur={cur} />
        </div></div>

        {config.queues.map((q) => (
          <div className="report-section card" key={q.id}><div className="card-b">
            <h3>{q.name}</h3>
            <QueueKpis sim={sim} queue={q} config={config} />
            <QueueCharts sim={sim} queue={q} />
          </div></div>
        ))}

        <div className="report-section card"><div className="card-b">
          <h3>Assumptions</h3>
          <Assumptions config={config} />
        </div></div>
      </div>
    </div>
  );
}

function QueueKpis({ sim, queue, config }) {
  const rows = buildWeeklyRows(sim, queue, config);
  const last = rows[rows.length - 1];
  const cur = config.engine.currency;
  const redWeeks = rows.filter((r) => r.status === "red").length;
  const worst = queue.type === "voice"
    ? { l: "Worst ASA", v: Math.round(Math.max(...rows.map((r) => r.asa))) + "s" }
    : { l: "Worst SL", v: pct(Math.min(...rows.map((r) => r.sl))) };
  return (
    <div className="stat-row" style={{ marginBottom: 8 }}>
      <div className="stat"><div className="l">Red weeks</div><div className="v">{redWeeks}</div></div>
      <div className="stat"><div className="l">{worst.l}</div><div className="v">{worst.v}</div></div>
      <div className="stat"><div className="l">End paid / req</div><div className="v">{num(last.paid, 0)}/{num(last.reqFte, 0)}</div></div>
      <div className="stat"><div className="l">Total churn</div><div className="v">{money(cur, rows.reduce((a, r) => a + r.churnCost, 0))}</div></div>
    </div>
  );
}

function Assumptions({ config }) {
  const e = config.engine;
  const items = [
    ["Horizon", `${e.horizonWeeks} weeks`],
    ["Hours", `${e.dayStart}:00–${e.dayEnd}:00, ${e.intervalMin}-min intervals`],
    ["Occupancy ceiling", pct(e.occupancyCeiling)],
    ["Global hiring cap", `${config.hiring.cap}/wk`],
    ["Buffer (S2)", pct(config.hiring.buffer)],
    ["Redial / deflection", `${pct(config.loops.redial)} / ${pct(config.loops.deflection)}`],
    ["£ per lost customer", moneyFull(e.currency, config.cx.costPerLostCustomer)],
  ];
  return (
    <div className="tbl-wrap">
      <table className="data">
        <tbody>{items.map(([k, v]) => <tr key={k}><td style={{ textAlign: "left", fontWeight: 600 }}>{k}</td><td style={{ textAlign: "left" }}>{v}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
