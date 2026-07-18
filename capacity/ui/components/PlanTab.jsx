import { useState } from "react";
import { Ribbon } from "./Ribbon.jsx";
import { Card } from "./primitives.jsx";
import { HolisticPanel } from "./HolisticPanel.jsx";
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

// Per-queue status card for the scrubbed week.
function QueueCard({ q, s }) {
  const voice = q.type === "voice";
  return (
    <div className={"qcard " + s.status}>
      <div className="qn">
        <span>{q.name}</span>
        <span className="spacer" />
        <span className="qtype">{q.type}</span>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="l">Coverage</div><div className="v">{pct(s.cover)}</div></div>
        <div className="kpi"><div className="l">Status</div><div className="v"><span className={"badge " + s.status}>{s.status}</span></div></div>
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
        <div className="kpi"><div className="l">Paid / req</div><div className="v">{num(s.paid, 0)}/{num(s.reqFte, 0)}</div></div>
      </div>
    </div>
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
          <div className="stat"><div className="l">Paid FTE</div><div className="v">{num(week.totals.paid, 0)} <small>/ {num(week.totals.reqFte, 0)} req</small></div></div>
          <div className="stat"><div className="l">Horizon all-in</div><div className="v">{money(cur, sm.allIn)}</div></div>
        </div>
      </Card>

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
