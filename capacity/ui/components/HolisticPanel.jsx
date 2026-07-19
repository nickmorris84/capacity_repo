import { useState } from "react";
import { Card } from "./primitives.jsx";
import { money, num } from "../format.js";

/* Holistic requirement panel (SPEC §3): total required vs paid vs pipeline
   across the operation, the feasibility verdict, and the week-by-week
   cap-allocation trace the engine records — surfacing exactly the sentence the
   SPEC asks for: "Week 6: cap 18, plan wants 26; Billing took 12, WhatsApp 6;
   Tech goes short — projected £41k churn." */
export function HolisticPanel({ sim }) {
  const [showAll, setShowAll] = useState(false);
  const cfg = sim.config;
  const cur = cfg.engine.currency;
  const trace = sim.allocTrace || [];
  const qName = (id) => (cfg.queues.find((q) => q.id === id) || { name: id }).name;

  const last = sim.weeks[sim.weeks.length - 1].totals;
  const pipeline = cfg.queues.reduce((a, q) => a + (sim.weeks[sim.weeks.length - 1].queues[q.id].pipeline || 0), 0);

  const binding = trace.filter((t) => t.binding);
  const bindingWeeks = binding.map((t) => t.week + 1);
  const maxWant = binding.reduce((m, t) => Math.max(m, t.want), 0);
  const cap = cfg.hiring.cap;

  // Projected churn attributed to a binding week: the churn cost incurred by the
  // shorted queues over the lead-time window following the shortfall, read from
  // the (cap-constrained) active simulation.
  const churnForShort = (t) => {
    const shortIds = Object.keys(t.denied);
    if (!shortIds.length) return 0;
    let total = 0;
    for (const id of shortIds) {
      const q = cfg.queues.find((x) => x.id === id);
      const lead = q ? q.wf.reqToStart + q.wf.trainingWeeks + q.wf.learningCurve.length : 8;
      for (let w = t.week; w < Math.min(t.week + lead, sim.weeks.length); w++) {
        total += sim.weeks[w].queues[id].churnCost;
      }
    }
    return total;
  };

  const rows = showAll ? trace : (binding.length ? binding : trace.slice(0, 6));

  return (
    <Card
      title="Holistic requirement panel"
      hint="Required vs paid vs pipeline across the whole operation, and how the global hiring cap is rationed each week when demand for requisitions exceeds it."
      right={<button type="button" className="btn sm" onClick={() => setShowAll((s) => !s)}>{showAll ? "Binding weeks only" : "Show all weeks"}</button>}
    >
      <div className="stat-row">
        <div className="stat"><div className="l">Required FTE (final wk)</div><div className="v">{num(last.reqFte, 0)}</div></div>
        <div className="stat"><div className="l">Active FTE (final wk)</div><div className="v">{num(last.active != null ? last.active : last.paid, 0)}</div></div>
        <div className="stat"><div className="l">In pipeline (final wk)</div><div className="v">{num(pipeline, 0)}</div></div>
        <div className="stat"><div className="l">Global cap</div><div className="v">{cap}<small>/wk</small></div></div>
        <div className="stat"><div className="l">Cap-bound weeks</div><div className="v">{binding.length}</div></div>
      </div>

      <p className={"note"} style={{ marginTop: 12 }}>
        {binding.length
          ? `Feasibility: the cap allows +${cap}/wk, but this plan needs up to +${Math.round(maxWant)}/wk in week${bindingWeeks.length > 1 ? "s" : ""} ${formatWeekRange(bindingWeeks)} — infeasible. The shortfall lands as churn.`
          : `Feasibility: the plan fits within the +${cap}/wk cap across the whole horizon.`}
      </p>

      <QueuePanels sim={sim} />

      <div className="tbl-wrap" style={{ marginTop: 12, maxHeight: 380 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Week</th>
              <th>Cap</th>
              <th>Wanted</th>
              {cfg.queues.map((q) => <th key={q.id}>{q.name}</th>)}
              <th>Proj. churn</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const proj = t.binding ? churnForShort(t) : 0;
              return (
                <tr key={t.week} style={t.binding ? { background: "var(--red-s)" } : undefined}>
                  <td>{t.week + 1}</td>
                  <td>{t.cap == null ? "∞" : t.cap}</td>
                  <td>{num(t.want, 0)}{t.binding ? " ⚠" : ""}</td>
                  {cfg.queues.map((q) => {
                    const g = t.grants[q.id] || 0;
                    const d = t.denied[q.id] || 0;
                    return (
                      <td key={q.id} className={d > 0.05 ? "st-red" : undefined}>
                        {g > 0.05 ? num(g, 0) : "–"}
                        {d > 0.05 ? ` (−${num(d, 0)})` : ""}
                      </td>
                    );
                  })}
                  <td>{proj > 0 ? money(cur, proj) : "–"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={4 + cfg.queues.length} className="empty">No allocation activity.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ marginTop: 10 }}>
        When the cap binds, scarce requisitions go to the queue with the greatest marginal churn cost averted per FTE (tie-break: earliest projected breach). A number in brackets is the shortfall that queue was denied that week.
      </p>
    </Card>
  );
}

// §14.6: queues as coloured panels grouped Voice vs Digital, each showing its
// Ops cost (salary run cost) and Customer cost (churn) over the horizon.
function QueuePanels({ sim }) {
  const cfg = sim.config;
  const cur = cfg.engine.currency;
  const worst = (q) => {
    const sts = sim.weeks.map((w) => w.queues[q.id].status);
    return sts.includes("red") ? "red" : sts.includes("amber") ? "amber" : "green";
  };
  const panel = (q) => {
    const series = sim.weeks.map((w) => w.queues[q.id]);
    const ops = series.reduce((a, s) => a + s.cost, 0);
    const cust = series.reduce((a, s) => a + s.churnCost, 0);
    const last = series[series.length - 1];
    return (
      <div className={"qcard " + worst(q)} key={q.id} style={{ minWidth: 190 }}>
        <div className="qn"><span>{q.name}</span><span className="spacer" />{q.resourcing === "supported" && <span className="badge amber">supported</span>}</div>
        <div className="kpis">
          <div className="kpi"><div className="l">Ops cost</div><div className="v">{money(cur, ops)}</div></div>
          <div className="kpi"><div className="l">Customer cost</div><div className="v">{money(cur, cust)}</div></div>
          <div className="kpi"><div className="l">Active</div><div className="v">{num(last.active != null ? last.active : last.trained + last.ramp, 0)}</div></div>
          <div className="kpi"><div className="l">Required</div><div className="v">{num(last.reqFte, 0)}</div></div>
        </div>
      </div>
    );
  };
  const voice = cfg.queues.filter((q) => q.type === "voice");
  const digital = cfg.queues.filter((q) => q.type === "digital");
  return (
    <div style={{ marginTop: 12 }} data-testid="holistic-queue-panels">
      {voice.length > 0 && <><div className="section-title" style={{ margin: "6px 2px" }}>Voice</div><div className="qcards">{voice.map(panel)}</div></>}
      {digital.length > 0 && <><div className="section-title" style={{ margin: "12px 2px 6px" }}>Digital</div><div className="qcards">{digital.map(panel)}</div></>}
    </div>
  );
}

function formatWeekRange(weeks) {
  if (!weeks.length) return "";
  const sorted = [...weeks].sort((a, b) => a - b);
  // collapse contiguous runs into "a–b"
  const parts = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) { prev = sorted[i]; continue; }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = sorted[i];
  }
  parts.push(start === prev ? `${start}` : `${start}–${prev}`);
  return parts.join(", ");
}
