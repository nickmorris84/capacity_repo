import { useState } from "react";
import { Card } from "./primitives.jsx";
import { HierTable } from "./HierTable.jsx";
import { buildVerdict, buildAudienceBlocks, buildRiskRegister, queueSummaryMetric, sumQueueSummary } from "../reporting.js";
import { strategyList, groupList, resolveStrategyName, groupName } from "../views.js";
import { money, moneyFull, pct, num } from "../format.js";

const Stat = ({ l, v, sub }) => (
  <div className="stat"><div className="l">{l}</div><div className="v">{v}{sub ? <small> {sub}</small> : null}</div></div>
);

/* §19 decision matrix — rows = groups, columns = strategies, BOTH in config
   definition order and never reordered by selection or results. Cell = RAG +
   all-in £ + flags. Computed on demand ("Run matrix"), cached, greyed with a
   "stale — re-run" banner on any config change. The selected cell (group ×
   strategy) is the global context pair rendered live on every tab. */
function DecisionMatrix({ config, matrix, matrixStale, onRunMatrix, onSelectCell, activeGroupId, activeStrategy }) {
  const cur = config.engine.currency;
  const groups = groupList(config);
  const strategies = strategyList(config);
  return (
    <Card title="Decision matrix" sub="groups × strategies" hint="Every scenario group against every hiring strategy. Rows and columns stay in definition order. Click a cell to make that pair the live context across all tabs.">
      {(matrixStale) && (
        <div className="mx-stale" data-testid="matrix-stale">
          <span>{matrix ? "Config changed — the matrix is stale." : "Matrix not yet computed."}</span>
          <button type="button" className="btn sm primary" onClick={onRunMatrix} data-testid="run-matrix">Run matrix</button>
        </div>
      )}
      {!matrixStale && (
        <div className="btnbar" style={{ marginBottom: 8 }}>
          <button type="button" className="btn sm" onClick={onRunMatrix} data-testid="run-matrix">Re-run matrix</button>
          <span className="note" style={{ padding: "6px 10px" }}>Cached. Click any cell to select the (group × strategy) context.</span>
        </div>
      )}
      <div className="tbl-wrap">
        <table className="matrix" data-testid="decision-matrix">
          <thead>
            <tr>
              <th className="row-h" />
              {strategies.map((s) => <th key={s.id} data-testid={"mx-col-" + s.id}>{s.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <th className="row-h" data-testid={"mx-row-" + g.id}>{g.name}</th>
                {strategies.map((s) => {
                  const cell = matrix && matrix.cells[g.id] && matrix.cells[g.id][s.id];
                  const sel = g.id === activeGroupId && s.id === activeStrategy;
                  const flags = cell ? [cell.redWeeks ? `${cell.redWeeks} red` : null, cell.tipping ? "⚠ tip" : null, cell.capInfeasible ? "⚠ cap" : null].filter(Boolean).join(" · ") : "";
                  return (
                    <td key={s.id} style={{ padding: 0 }}>
                      <button type="button" className={"mx-cell " + (cell ? cell.status : "") + (sel ? " sel" : "")}
                        onClick={() => onSelectCell(g.id, s.id)} data-testid={"mx-" + g.id + "-" + s.id} aria-pressed={sel}>
                        <div className="mx-all">{cell ? money(cur, cell.allIn) : "—"}</div>
                        <div className="mx-flags">{cell ? (flags || "holds") : "not run"}</div>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function QueueSummaryTable({ sim, config }) {
  const cur = config.engine.currency;
  const columns = [
    { key: "volume", label: "Volume", fmt: (m) => num(m.volume, 0) },
    { key: "required", label: "Required", fmt: (m) => num(m.required, 1) },
    { key: "active", label: "Active", fmt: (m) => num(m.active, 1) },
    { key: "cover", label: "Coverage", fmt: (m) => pct(m.coverN ? m.coverSum / m.coverN : 0) },
    { key: "weeksRed", label: "Weeks red", fmt: (m) => num(m.weeksRed, 0), cls: (m) => (m.weeksRed ? "st-red" : "st-green") },
    { key: "churn", label: "Churn £", fmt: (m) => money(cur, m.churn) },
  ];
  return <HierTable config={config} testid="queue-summary" columns={columns} metric={(q) => queueSummaryMetric(sim, q)} aggregate={sumQueueSummary} />;
}

export function SummaryTab({ sim, sims, stratIds, config, activeStrategy, activeGroupId, onSetActive, matrix, matrixStale, onRunMatrix, onSelectCell }) {
  const cur = config.engine.currency;
  const verdict = buildVerdict(sims, activeStrategy, activeGroupId, config);
  const blocks = buildAudienceBlocks(sim, config);
  const risks = buildRiskRegister(sim, config); // §20a — re-scores from config.settings.risk at render
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
        <span className="note" style={{ padding: "6px 10px" }}>Leadership one-pager — {resolveStrategyName(config, activeStrategy)} · group {groupName(config, activeGroupId)}. Print or save to PDF from the context bar above.</span>
      </div>

      <DecisionMatrix config={config} matrix={matrix} matrixStale={matrixStale} onRunMatrix={onRunMatrix} onSelectCell={onSelectCell} activeGroupId={activeGroupId} activeStrategy={activeStrategy} />

      <Card title="Verdict & key findings">
        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.55 }}>{verdict.paragraph}</p>
        <div className="findings">
          {sim.summary.findings.map((fd, i) => <div key={i} className={"finding " + fd.tone}><span className="pip" /><span>{fd.text}</span></div>)}
          {sim.summary.findings.length === 0 && <div className="empty">The plan holds across the horizon.</div>}
        </div>
      </Card>

      <Card title="Queue summary" sub="under the active strategy" hint="Brand → Voice / Digital / Support → queue, with channel and brand subtotal rows.">
        <QueueSummaryTable sim={sim} config={config} />
      </Card>

      <div className="grid cols-2">
        <Card title="Finance">
          <div className="stat-row" style={{ flexDirection: "column", gap: 12 }}>
            <Stat l="Run cost" v={money(cur, f.runCost)} />
            <Stat l="OT cost" v={money(cur, sim.weeks.reduce((a, w) => a + (w.totals.otCost || 0), 0))} />
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
            <Stat l="Peak training debt" v={num(Math.max(0, ...config.queues.map((q) => Math.max(0, ...sim.weeks.map((w) => w.queues[q.id].trainingDebt || 0)))), 0) + "/100"} />
          </div>
        </Card>
        <Card title="Business" hint="Per-queue SLA target vs simulated attainment, RAG'd (§24.10), plus incident readiness.">
          <Stat l="Cap infeasible" v={bz.capInfeasible ? "yes" : "no"} />
          <div className="tbl-wrap" style={{ marginTop: 10 }}>
            <table className="data" data-testid="business-box">
              <thead><tr><th>Queue</th><th>SLA target</th><th>Attainment</th><th>RAG</th></tr></thead>
              <tbody>
                {config.queues.map((q) => {
                  const pq = (sim.summary.perQueue || {})[q.id] || {};
                  const target = pq.slaTarget != null ? pq.slaTarget : (q.slaAttainmentTarget != null ? q.slaAttainmentTarget : 0.9);
                  const att = pq.slaAttainment != null ? pq.slaAttainment : null;
                  const rag = pq.slaRag || (att == null ? null : att >= target ? "green" : att >= target * 0.9 ? "amber" : "red");
                  return (
                    <tr key={q.id}>
                      <td style={{ textAlign: "left", fontWeight: 600 }}>{q.name}</td>
                      <td>{pct(target)}</td>
                      <td>{att == null ? "–" : pct(att)}</td>
                      <td><span className={"badge " + (rag || "amber")} data-testid={"biz-rag-" + q.id}>{rag || "–"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

      <Card title="Risk register" sub={`${risks.length} risk(s) · thresholds in Settings`}>
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
                  <td style={{ textAlign: "left", fontWeight: 600 }}>{r.band && <span className={"badge " + r.band} style={{ marginRight: 6 }}>{r.band}</span>}{r.risk}</td>
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
