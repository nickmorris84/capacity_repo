import { useState } from "react";
import { Card } from "./primitives.jsx";
import { PrintButton } from "../print.jsx";
import { buildVerdict, buildAudienceBlocks, buildRiskRegister, buildQueueSummary } from "../reporting.js";
import { strategyList, strategyStats, resolveStrategyName, viewName } from "../views.js";
import { money, moneyFull, pct, num } from "../format.js";

const Stat = ({ l, v, sub }) => (
  <div className="stat"><div className="l">{l}</div><div className="v">{v}{sub ? <small> {sub}</small> : null}</div></div>
);

const endCoverage = (sim) => {
  if (!sim) return 0;
  const last = sim.weeks[sim.weeks.length - 1];
  const qs = sim.config.queues;
  return qs.length ? qs.reduce((a, q) => a + last.queues[q.id].cover, 0) / qs.length : 0;
};

// §14: strategy overview cards — name, all-in, weeks red, end coverage, Set active.
function StrategyCards({ sims, stratIds, config, activeStrategyId, onSetActive }) {
  const cur = config.engine.currency;
  return (
    <div className="qcards" data-testid="strategy-cards">
      {stratIds.map((id) => {
        const sim = sims[id];
        const st = strategyStats(sim);
        const active = id === activeStrategyId;
        return (
          <div key={id} className={"qcard " + (st ? (st.redWeeks ? "red" : "green") : "")}>
            <div className="qn"><span>{resolveStrategyName(config, id)}</span><span className="spacer" />{active && <span className="tag">active</span>}</div>
            <div className="kpis">
              <div className="kpi"><div className="l">All-in</div><div className="v">{st ? money(cur, st.allIn) : "…"}</div></div>
              <div className="kpi"><div className="l">Weeks red</div><div className="v">{st ? st.redWeeks : "…"}</div></div>
              <div className="kpi"><div className="l">End coverage</div><div className="v">{pct(endCoverage(sim))}</div></div>
              <div className="kpi"><div className="l">Feasible</div><div className="v">{st ? (st.feasible ? "yes" : "no") : "…"}</div></div>
            </div>
            <button type="button" className={"btn sm" + (active ? " primary" : "")} style={{ marginTop: 10, width: "100%" }} disabled={active} onClick={() => onSetActive(id)} data-testid={"set-active-" + id}>
              {active ? "Active" : "Set active"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function QueueSummaryTable({ sim, config }) {
  const cur = config.engine.currency;
  const qs = buildQueueSummary(sim, config);
  const row = (r, cls) => (
    <tr key={r.id} className={cls}>
      <td style={{ textAlign: "left", fontWeight: cls ? 700 : 600 }}>{r.name}{r.resourcing === "supported" ? " (supported)" : ""}</td>
      <td>{num(r.volume, 0)}</td>
      <td>{num(r.required, 1)}</td>
      <td>{num(r.active, 1)}</td>
      <td>{pct(r.cover)}</td>
      <td className={r.weeksRed ? "st-red" : "st-green"}>{r.weeksRed}</td>
      <td>{money(cur, r.churn)}</td>
    </tr>
  );
  return (
    <div className="tbl-wrap">
      <table className="data" data-testid="queue-summary">
        <thead><tr><th>Queue</th><th>Volume</th><th>Required</th><th>Active</th><th>Coverage</th><th>Weeks red</th><th>Churn £</th></tr></thead>
        <tbody>
          {qs.rows.filter((r) => r.type === "voice").map((r) => row(r, ""))}
          {qs.rows.some((r) => r.type === "voice") && row(qs.voice, "grp")}
          {qs.rows.filter((r) => r.type === "digital").map((r) => row(r, ""))}
          {qs.rows.some((r) => r.type === "digital") && row(qs.digital, "grp")}
          {row(qs.total, "grp total")}
        </tbody>
      </table>
    </div>
  );
}

export function SummaryTab({ sim, sims, stratIds, config, activeStrategy, activeViewId, onSetActive }) {
  const cur = config.engine.currency;
  const verdict = buildVerdict(sims, activeStrategy, activeViewId, config);
  const blocks = buildAudienceBlocks(sim, config);
  const risks = buildRiskRegister(sim, config);
  const [sort, setSort] = useState({ key: "severityValue", dir: -1 });
  const f = blocks.finance, hr = blocks.hr, bz = blocks.business;

  const sortedRisks = [...risks].sort((a, b) => {
    const dir = sort.dir;
    if (sort.key === "week") return dir * ((a.week || 999) - (b.week || 999));
    if (sort.key === "risk") return dir * a.risk.localeCompare(b.risk);
    return dir * ((a.severityValue || 0) - (b.severityValue || 0));
  });
  const setSortKey = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : (key === "risk" ? 1 : -1) }));
  const arrow = (key) => (sort.key === key ? (sort.dir < 0 ? " ↓" : " ↑") : "");

  return (
    <div className="grid summary-print" style={{ gap: 16 }} data-testid="summary-panel">
      <div className="btnbar">
        <PrintButton label="Print / PDF Summary" testid="summary-print" className="btn primary" />
        <span className="note" style={{ padding: "6px 10px" }}>A leadership-ready one-pager under {resolveStrategyName(config, activeStrategy)} · view {viewName(config, activeViewId)}.</span>
      </div>

      <Card title="Strategy overview" hint="Every strategy at a glance under the active view. Set any one active to drive the whole app.">
        <StrategyCards sims={sims} stratIds={stratIds} config={config} activeStrategyId={activeStrategy} onSetActive={onSetActive} />
      </Card>

      <Card title="Verdict & key findings">
        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.55 }}>{verdict.paragraph}</p>
        <div className="findings">
          {sim.summary.findings.map((fd, i) => <div key={i} className={"finding " + fd.tone}><span className="pip" /><span>{fd.text}</span></div>)}
          {sim.summary.findings.length === 0 && <div className="empty">The plan holds across the horizon.</div>}
        </div>
      </Card>

      <Card title="Queue summary" sub="under the active strategy" hint="Per queue with Voice, Digital and Total subtotals.">
        <QueueSummaryTable sim={sim} config={config} />
      </Card>

      <div className="grid cols-2">
        <Card title="Finance">
          <div className="stat-row" style={{ flexDirection: "column", gap: 12 }}>
            <Stat l="Run cost" v={money(cur, f.runCost)} />
            <Stat l="Churn cost" v={money(cur, f.churn)} />
            <Stat l="Idle pay" v={money(cur, f.idle)} />
            <Stat l="All-in" v={money(cur, f.allIn)} />
            <Stat l="Cost / contact" v={moneyFull(cur, f.costPerContact)} />
            <Stat l="Break-even week" v={f.breakEven ?? "–"} />
          </div>
        </Card>
        <Card title="HR">
          <div className="stat-row" style={{ flexDirection: "column", gap: 12 }}>
            <Stat l="Total reqs raised" v={num(hr.totalReqs, 0)} />
            <Stat l="Global cap" v={hr.cap} sub="/wk" />
            <Stat l="Avg leavers" v={num(hr.avgLeavers, 1)} sub="/wk" />
            <Stat l="Tipping margin" v={num(hr.tippingMargin, 1)} sub={hr.tippingPoint ? "· tipped" : "/wk"} />
            <Stat l="Peak burnout" v={num(hr.peakBurn, 0) + "/100"} />
            <Stat l="Avg in training" v={num(hr.avgTraining, 1)} />
          </div>
        </Card>
        <Card title="Business" hint="SLA attainment and incident readiness.">
          <div className="stat-row" style={{ flexDirection: "column", gap: 12 }}>
            <Stat l="Incident (P1) in view" v={bz.p1Enabled ? "yes — stress applied" : "no"} />
            <Stat l="Cap infeasible" v={bz.capInfeasible ? "yes" : "no"} />
            <div>
              <div className="l" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>SLA attainment by queue</div>
              {bz.perQueueSla.map((s) => (
                <div key={s.name} className="rowflex" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span>{s.name}</span><strong>{pct(s.attainment)}</strong>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title="CX" hint="Customer experience economics.">
          <div className="stat-row" style={{ flexDirection: "column", gap: 12 }}>
            <Stat l="Customers lost" v={num(bz.customersLost, 0)} />
            <Stat l="Churn cost" v={money(cur, f.churn)} />
            <Stat l="Deflected → voice" v={num(bz.totalDeflected, 0)} />
            <Stat l="Repeat-contact uplift" v={"×" + num(config.cx.repeatUplift, 2)} />
          </div>
        </Card>
      </div>

      <Card title="Risk register" sub={`${risks.length} risk(s)`}>
        <div className="tbl-wrap">
          <table className="data" data-testid="risk-table">
            <thead>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => setSortKey("risk")}>Risk{arrow("risk")}</th>
                <th>Driver</th>
                <th style={{ cursor: "pointer" }} onClick={() => setSortKey("week")}>Week{arrow("week")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => setSortKey("severityValue")}>Severity{arrow("severityValue")}</th>
                <th>SLA impact</th>
                <th>Suggested lever</th>
              </tr>
            </thead>
            <tbody>
              {sortedRisks.map((r, i) => (
                <tr key={i}>
                  <td style={{ textAlign: "left", fontWeight: 600 }}>{r.risk}</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal", maxWidth: 280 }}>{r.driver}</td>
                  <td>{r.week ?? "–"}</td>
                  <td>{r.severityMoney != null ? money(cur, r.severityMoney) : "—"}</td>
                  <td style={{ textAlign: "left" }}>{r.sla || "–"}</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal", maxWidth: 240 }}>{r.lever}</td>
                </tr>
              ))}
              {sortedRisks.length === 0 && <tr><td colSpan={6} className="empty">No material risks — the plan holds across the horizon.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
