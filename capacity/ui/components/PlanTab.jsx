import { useState } from "react";
import { Ribbon } from "./Ribbon.jsx";
import { Card } from "./primitives.jsx";
import { HolisticPanel } from "./HolisticPanel.jsx";
import { HierTable } from "./HierTable.jsx";
import { CoverageChart, HeadcountChart, VolumeChart, CostChart, IdleChurnChart, BurnoutChart } from "./charts.jsx";
import { money, pct, num, secs } from "../format.js";

// Findings strip — colour-coded advisory cards from the engine summary.
function Findings({ findings }) {
  if (!findings || !findings.length) return <div className="empty">No findings — the plan holds across the horizon.</div>;
  return (
    <div className="findings">
      {findings.map((f, i) => (
        <div key={i} className={"finding " + f.tone}>
          <span className="pip" />
          <span>{f.text}</span>
        </div>
      ))}
    </div>
  );
}

// Per-queue status card for the scrubbed week — now carries weekly volume and
// uses Active (§14.6).
function QueueCard({ q, s }) {
  const voice = q.type === "voice";
  return (
    <div className={"qcard " + s.status}>
      <div className="qn">
        <span>{q.name}</span>
        <span className="spacer" />
        {q.resourcing === "supported" && <span className="badge amber" title={undefined}>supported</span>}
        <span className="qtype">{q.type}</span>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="l">Volume</div><div className="v">{num(s.volume, 0)}</div></div>
        <div className="kpi"><div className="l">Coverage</div><div className="v">{pct(s.cover)}</div></div>
        {voice ? (
          <>
            <div className="kpi"><div className="l">ASA</div><div className="v">{secs(s.asa)}</div></div>
            <div className="kpi"><div className="l">Abandon</div><div className="v">{pct(s.abandon, 1)}</div></div>
          </>
        ) : (
          <>
            <div className="kpi"><div className="l">Response</div><div className="v">{num(s.respMin, 1)}m</div></div>
            <div className="kpi"><div className="l">In SLA</div><div className="v">{pct(s.sl)}</div></div>
          </>
        )}
        <div className="kpi"><div className="l">Occupancy</div><div className="v">{pct(s.occ)}</div></div>
        <div className="kpi"><div className="l">Active / req</div><div className="v">{num(s.active != null ? s.active : s.trained + s.ramp, 0)}/{num(s.reqFte, 0)}</div></div>
      </div>
    </div>
  );
}

// §14.6 / §20 hiring summary — Brand → Voice / Digital / Support → queue, with
// channel and brand subtotal rows via the shared hierarchy table.
function hiringMetric(sim, q) {
  const h = sim.summary.hiring;
  const r = (h && h.queues[q.id]) || { volume: 0, required: 0, hiring: 0, training: 0, active: 0, churnCount: 0 };
  const series = sim.weeks.map((w) => w.queues[q.id]);
  const avgActive = series.reduce((a, s) => a + (s.active != null ? s.active : (s.trained || 0) + (s.ramp || 0)), 0) / Math.max(1, series.length);
  return { volume: r.volume, required: r.required, hiring: r.hiring, training: r.training, active: r.active, churnCount: r.churnCount, avgActive };
}
function sumHiring(list) {
  return list.reduce((t, m) => ({
    volume: t.volume + m.volume, required: t.required + m.required, hiring: t.hiring + m.hiring,
    training: t.training + m.training, active: t.active + m.active, churnCount: t.churnCount + m.churnCount, avgActive: t.avgActive + m.avgActive,
  }), { volume: 0, required: 0, hiring: 0, training: 0, active: 0, churnCount: 0, avgActive: 0 });
}
function HiringSummary({ sim, cur }) {
  const h = sim.summary.hiring;
  if (!h) return null;
  const columns = [
    { key: "volume", label: "Volume", fmt: (m) => num(m.volume, 0) },
    { key: "required", label: "Required", fmt: (m) => num(m.required, 1) },
    { key: "hiring", label: "Hiring", fmt: (m) => num(m.hiring, 1) },
    { key: "training", label: "Training", fmt: (m) => num(m.training, 1) },
    { key: "active", label: "Active", fmt: (m) => num(m.active, 1) },
    { key: "churnCount", label: "Churn #", fmt: (m) => num(m.churnCount, 1) },
    { key: "churnPct", label: "Churn %", fmt: (m) => pct(m.avgActive > 1e-9 ? m.churnCount / m.avgActive : 0, 1) },
  ];
  return (
    <Card title="Hiring summary" hint="Volume, required HC, hiring (requisitions raised over the horizon), training and active heads, and agent churn — Brand → Voice / Digital / Support → queue with channel and brand subtotal rows.">
      <HierTable config={sim.config} testid="hiring-summary" firstLabel="Scope" columns={columns} metric={(q) => hiringMetric(sim, q)} aggregate={sumHiring} />
    </Card>
  );
}

export function PlanTab({ sim, viewLabel }) {
  const cfg = sim.config;
  const [selectedWeek, setSelectedWeek] = useState(0);
  const wk = Math.min(selectedWeek, sim.weeks.length - 1);
  const week = sim.weeks[wk];
  const sm = sim.summary;
  const cur = cfg.engine.currency;

  return (
    <div
      className="grid"
      style={{ gap: 16 }}
      data-testid="plan-panel"
      data-active-strategy={sm.strategy}
      data-active-allin={Math.round(sm.allIn)}
    >
      <Card title="Findings" hint="Auto-written from the active strategy. Red demands a decision; amber is a watch item.">
        <Findings findings={sm.findings} />
      </Card>

      <Card
        title="RAG ribbon"
        sub="week × queue — click any cell to scrub the dashboard"
        hint="Each square is a queue-week's SLA verdict. Dots mark weeks where an enabled scenario fires."
      >
        <Ribbon sim={sim} selectedWeek={wk} onScrub={setSelectedWeek} />
      </Card>

      <Card title={`Queue status — week ${wk + 1}`} sub={`${sm.strategy} active · view: ${viewLabel || "Plan of record"}`}>
        <div className="qcards">
          {cfg.queues.map((q) => (
            <QueueCard key={q.id} q={q} s={week.queues[q.id]} />
          ))}
        </div>
        <hr className="sep" style={{ margin: "14px 0" }} />
        <div className="stat-row">
          <div className="stat"><div className="l">Week run cost</div><div className="v">{money(cur, week.totals.totalCost)}</div></div>
          <div className="stat"><div className="l">Week churn cost</div><div className="v">{money(cur, week.totals.churnCost)}</div></div>
          <div className="stat"><div className="l">Active FTE</div><div className="v">{num(week.totals.active != null ? week.totals.active : week.totals.paid, 0)} <small>/ {num(week.totals.reqFte, 0)} req</small></div></div>
          <div className="stat"><div className="l">Horizon all-in</div><div className="v">{money(cur, sm.allIn)}</div></div>
        </div>
      </Card>

      <HiringSummary sim={sim} cur={cur} />

      <div className="grid cols-2">
        <CoverageChart sim={sim} selectedWeek={wk} />
        <HeadcountChart sim={sim} selectedWeek={wk} />
        <VolumeChart sim={sim} selectedWeek={wk} />
        <CostChart sim={sim} selectedWeek={wk} />
        <IdleChurnChart sim={sim} selectedWeek={wk} />
        <BurnoutChart sim={sim} selectedWeek={wk} />
      </div>

      <HolisticPanel sim={sim} />
    </div>
  );
}
