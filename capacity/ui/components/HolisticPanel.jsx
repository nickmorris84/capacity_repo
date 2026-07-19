import { useState } from "react";
import { Card } from "./primitives.jsx";
import { money, moneyMonthly, num } from "../format.js";
import { hierarchy, orderedQueues } from "../views.js";

/* Holistic requirement panel (SPEC §3 + §24). Summary blocks follow the
   Brand → Voice/Digital/Support hierarchy and spread evenly across the width;
   beneath sits an interactive table — every queue active by default, tap a
   queue chip to toggle it in or out and the capacity-required headline and the
   totals row recompute live. Caps context (§24.3) is shown inline, and the
   week-by-week cap-allocation trace is available as a detail below. */

// Per-queue horizon metrics, presented per month where they are costs (§24.7).
function queueMetrics(sim, q) {
  const series = sim.weeks.map((w) => w.queues[q.id]);
  const last = series[series.length - 1];
  const n = Math.max(1, series.length);
  const sumOf = (f) => series.reduce((a, s) => a + (f(s) || 0), 0);
  return {
    id: q.id, name: q.name,
    reqFte: last.reqFte,
    hires: sumOf((s) => s.reqsRaised),
    active: last.active != null ? last.active : last.trained + last.ramp,
    attrition: sumOf((s) => s.leavers),
    agentMonthly: (sumOf((s) => s.cost) / n) * (52 / 12),
    otMonthly: (sumOf((s) => s.otCost) / n) * (52 / 12),
    custMonthly: (sumOf((s) => s.churnCost) / n) * (52 / 12),
  };
}

function HierarchyBlocks({ sim }) {
  const cfg = sim.config;
  const cur = cfg.engine.currency;
  const rows = hierarchy(cfg);
  const agg = (queues) => {
    let req = 0, active = 0, pipe = 0;
    for (const q of queues) {
      const last = sim.weeks[sim.weeks.length - 1].queues[q.id];
      req += last.reqFte; active += last.active != null ? last.active : last.trained + last.ramp; pipe += last.pipeline || 0;
    }
    return { req, active, pipe };
  };
  const block = (label, sub, queues, key) => {
    const a = agg(queues);
    return (
      <div className="holo-block" key={key} data-testid={"holo-block-" + key}>
        <div className="holo-block-h"><strong>{label}</strong>{sub ? <span className="pill">{sub}</span> : null}</div>
        <div className="holo-mini">
          <div><span className="l">Required</span><span className="v">{num(a.req, 0)}</span></div>
          <div><span className="l">Active</span><span className="v">{num(a.active, 0)}</span></div>
          <div><span className="l">Pipeline</span><span className="v">{num(a.pipe, 0)}</span></div>
        </div>
      </div>
    );
  };
  return (
    <div className="holo-grid" data-testid="holo-hierarchy">
      {rows.map((row) => [
        block(row.brand.name, `${row.queues.length} queue(s)`, row.queues, row.brand.id),
        ...row.channels.map((c) => block(`${row.brand.name} · ${c.label}`, null, c.queues, row.brand.id + "-" + c.key)),
      ]).flat()}
    </div>
  );
}

function CapsContext({ sim }) {
  const cfg = sim.config;
  const caps = cfg.hiring.caps || { total: cfg.hiring.cap, segments: {}, brands: {} };
  const trace = sim.allocTrace || [];
  const binding = trace.filter((t) => t.binding);
  const levels = new Set();
  for (const t of binding) for (const l of (t.boundBy || [])) levels.add(l);
  const segEntries = Object.entries(caps.segments || {});
  return (
    <p className="note" data-testid="holo-caps" style={{ marginTop: 12 }}>
      Hiring caps — total {caps.total == null ? "∞" : caps.total + "/wk"}
      {segEntries.length ? `; ${segEntries.length} segment cap(s) set` : "; no segment caps"}.
      {binding.length
        ? ` The cap binds in ${binding.length} week(s); binding level(s): ${[...levels].join(", ") || "Total"}.`
        : " The plan fits within every cap across the horizon."}
    </p>
  );
}

export function HolisticPanel({ sim }) {
  const cfg = sim.config;
  const cur = cfg.engine.currency;
  const queues = orderedQueues(cfg);
  const [active, setActive] = useState(() => new Set(queues.map((q) => q.id)));
  const [showTrace, setShowTrace] = useState(false);

  const metrics = queues.map((q) => queueMetrics(sim, q));
  const on = (id) => active.has(id);
  const toggle = (id) => setActive((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const shown = metrics.filter((m) => on(m.id));
  const totals = shown.reduce((t, m) => ({
    reqFte: t.reqFte + m.reqFte, hires: t.hires + m.hires, active: t.active + m.active,
    attrition: t.attrition + m.attrition, agentMonthly: t.agentMonthly + m.agentMonthly,
    otMonthly: t.otMonthly + m.otMonthly, custMonthly: t.custMonthly + m.custMonthly,
  }), { reqFte: 0, hires: 0, active: 0, attrition: 0, agentMonthly: 0, otMonthly: 0, custMonthly: 0 });

  return (
    <Card
      title="Holistic requirement panel"
      hint="Required, active and pipeline headcount across the hierarchy, then an interactive per-queue table. Toggle a queue chip to include or exclude it — the capacity required and the totals recompute live."
      right={<button type="button" className="btn sm" onClick={() => setShowTrace((s) => !s)} data-testid="holo-toggle-trace">{showTrace ? "Hide cap trace" : "Show cap trace"}</button>}
    >
      <HierarchyBlocks sim={sim} />

      <div className="stat-row" style={{ marginTop: 14 }}>
        <div className="stat">
          <div className="l">Total capacity required (filtered)</div>
          <div className="v" data-testid="holo-capacity-required">{num(totals.reqFte, 0)}<small> FTE</small></div>
        </div>
        <div className="stat"><div className="l">Queues included</div><div className="v" data-testid="holo-active-count">{shown.length}<small>/{metrics.length}</small></div></div>
      </div>

      <div className="rowflex" style={{ marginTop: 10 }} data-testid="holo-chips">
        {metrics.map((m) => (
          <button type="button" key={m.id} className={"chip" + (on(m.id) ? " on" : "")} aria-pressed={on(m.id)}
            data-testid={"holo-chip-" + m.id} onClick={() => toggle(m.id)}>{m.name}</button>
        ))}
      </div>

      <div className="tbl-wrap" style={{ marginTop: 12 }}>
        <table className="data" data-testid="holo-table">
          <thead>
            <tr>
              <th>Queue</th><th>Capacity req.</th><th>Hires</th><th>Active</th><th>Attrition #</th>
              <th>Agent £/mo</th><th>OT £/mo</th><th>Customer £/mo</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.id}>
                <td style={{ textAlign: "left", fontWeight: 600 }}>{m.name}</td>
                <td>{num(m.reqFte, 1)}</td>
                <td>{num(m.hires, 1)}</td>
                <td>{num(m.active, 1)}</td>
                <td>{num(m.attrition, 1)}</td>
                <td>{money(cur, m.agentMonthly)}</td>
                <td>{money(cur, m.otMonthly)}</td>
                <td>{money(cur, m.custMonthly)}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={8} className="empty">No queues selected — tap a chip to include one.</td></tr>}
            <tr className="grp total">
              <td style={{ textAlign: "left" }}>Totals ({shown.length})</td>
              <td data-testid="holo-total-req">{num(totals.reqFte, 1)}</td>
              <td data-testid="holo-total-hires">{num(totals.hires, 1)}</td>
              <td data-testid="holo-total-active">{num(totals.active, 1)}</td>
              <td data-testid="holo-total-attrition">{num(totals.attrition, 1)}</td>
              <td data-testid="holo-total-agent">{money(cur, totals.agentMonthly)}</td>
              <td data-testid="holo-total-ot">{money(cur, totals.otMonthly)}</td>
              <td data-testid="holo-total-cust">{money(cur, totals.custMonthly)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <CapsContext sim={sim} />

      {showTrace && <AllocationTrace sim={sim} />}
    </Card>
  );
}

// The week-by-week cap-allocation trace (SPEC §3), retained as an on-demand
// detail: what each week wanted, what each queue got, and which level bound.
function AllocationTrace({ sim }) {
  const cfg = sim.config;
  const cur = cfg.engine.currency;
  const trace = sim.allocTrace || [];
  const binding = trace.filter((t) => t.binding);
  const rows = binding.length ? binding : trace.slice(0, 8);
  const qName = (id) => (cfg.queues.find((q) => q.id === id) || { name: id }).name;
  return (
    <div className="tbl-wrap" style={{ marginTop: 12, maxHeight: 340 }}>
      <table className="data" data-testid="holo-trace">
        <thead>
          <tr><th>Week</th><th>Cap</th><th>Wanted</th>{cfg.queues.map((q) => <th key={q.id}>{q.name}</th>)}<th>Bound by</th></tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.week} style={t.binding ? { background: "var(--red-s)" } : undefined}>
              <td>{t.week + 1}</td>
              <td>{t.cap == null ? "∞" : t.cap}</td>
              <td>{num(t.want, 0)}{t.binding ? " ⚠" : ""}</td>
              {cfg.queues.map((q) => {
                const g = t.grants[q.id] || 0, d = t.denied[q.id] || 0;
                return <td key={q.id} className={d > 0.05 ? "st-red" : undefined}>{g > 0.05 ? num(g, 0) : "–"}{d > 0.05 ? ` (−${num(d, 0)})` : ""}</td>;
              })}
              <td style={{ textAlign: "left" }}>{(t.boundBy || []).join(", ") || (t.binding ? "Total" : "–")}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4 + cfg.queues.length} className="empty">No allocation activity.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
