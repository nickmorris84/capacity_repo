import { useState } from "react";
import { Ribbon } from "./Ribbon.jsx";
import { Card, SelectField } from "./primitives.jsx";
import { HolisticPanel } from "./HolisticPanel.jsx";
import { CoverageChart, HeadcountChart, VolumeChart, CostChart, IdleChurnChart, BurnoutChart } from "./charts.jsx";
import { columnsFor, buildWeeklyRows } from "../reporting.js";
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

// §14.6 hiring summary — per queue and Voice / Digital / Overall.
function HiringSummary({ sim, cur }) {
  const h = sim.summary.hiring;
  if (!h) return null;
  const q = sim.config.queues;
  const row = (label, r, cls) => (
    <tr key={label} className={cls}>
      <td style={{ textAlign: "left", fontWeight: cls ? 700 : 600 }}>{label}</td>
      <td>{num(r.volume, 0)}</td>
      <td>{num(r.required, 1)}</td>
      <td>{num(r.hiring, 1)}</td>
      <td>{num(r.training, 1)}</td>
      <td>{num(r.active, 1)}</td>
      <td>{num(r.churnCount, 1)}</td>
      <td>{pct(r.churnPct, 1)}</td>
    </tr>
  );
  return (
    <Card title="Hiring summary" hint="Volume, required HC, hiring (requisitions raised over the horizon), training and active heads, and agent churn — per queue and rolled up for Voice, Digital and Overall.">
      <div className="tbl-wrap">
        <table className="data" data-testid="hiring-summary">
          <thead>
            <tr><th>Scope</th><th>Volume</th><th>Required</th><th>Hiring</th><th>Training</th><th>Active</th><th>Churn #</th><th>Churn %</th></tr>
          </thead>
          <tbody>
            {q.map((qq) => row(qq.name + (qq.resourcing === "supported" ? " (supported)" : ""), h.queues[qq.id], ""))}
            {row("Voice", h.groups.voice, "grp")}
            {row("Digital", h.groups.digital, "grp")}
            {row("Overall", h.groups.overall, "grp total")}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// §20 Plan — the full per-queue weekly data table lives at the bottom (no
// mini-tabs), so the plan and its underlying numbers read on one page.
function PlanDataTable({ sim, cfg }) {
  const [qid, setQid] = useState(cfg.queues[0] ? cfg.queues[0].id : "");
  const queue = cfg.queues.find((q) => q.id === qid) || cfg.queues[0];
  if (!queue) return null;
  const cols = columnsFor(queue, cfg.engine.currency);
  const rows = buildWeeklyRows(sim, queue, cfg);
  return (
    <Card title="Weekly data table" sub="the numbers behind the plan" hint="The full per-queue weekly record — the same data the Data tab exposes, inline here for the plan of record.">
      <div className="fieldrow" style={{ maxWidth: 320, marginBottom: 10 }}>
        <SelectField label="Queue" value={queue.id} onChange={setQid} options={cfg.queues.map((q) => ({ value: q.id, label: q.name }))} />
      </div>
      <div className="tbl-wrap" style={{ maxHeight: 420 }}>
        <table className="data grouped" data-testid="plan-data-table">
          <thead><tr>{cols.map((c) => <th key={c.key} className={"grp-" + c.group.toLowerCase()}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.week}>{cols.map((c) => <td key={c.key} className={"grp-" + c.group.toLowerCase() + (c.key === "status" ? " st-" + row.status : "")}>{c.fmt(row[c.key])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
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

      <PlanDataTable sim={sim} cfg={cfg} />
    </div>
  );
}
