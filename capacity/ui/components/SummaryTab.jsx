import { useState } from "react";
import { Card } from "./primitives.jsx";
import { buildVerdict, buildAudienceBlocks, buildRiskRegister } from "../reporting.js";
import { strategyName, viewName } from "../views.js";
import { money, moneyFull, pct, num } from "../format.js";

const Stat = ({ l, v, sub }) => (
  <div className="stat"><div className="l">{l}</div><div className="v">{v}{sub ? <small> {sub}</small> : null}</div></div>
);

/* Summary tab (SPEC §7): auto-written verdict, Finance / HR / Business blocks,
   and a sortable risk register. Reads the active simulation + all strategy sims. */
export function SummaryTab({ sim, strategySims, config, activeStrategy, activeViewId }) {
  const cur = config.engine.currency;
  const verdict = buildVerdict(strategySims, activeStrategy, activeViewId, config);
  const blocks = buildAudienceBlocks(sim, config);
  const risks = buildRiskRegister(sim, config);
  const [sort, setSort] = useState({ key: "severityValue", dir: -1 });

  const sortedRisks = [...risks].sort((a, b) => {
    const dir = sort.dir;
    if (sort.key === "week") return dir * ((a.week || 999) - (b.week || 999));
    if (sort.key === "risk") return dir * a.risk.localeCompare(b.risk);
    return dir * ((a.severityValue || 0) - (b.severityValue || 0));
  });
  const setSortKey = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : (key === "risk" ? 1 : -1) }));
  const arrow = (key) => (sort.key === key ? (sort.dir < 0 ? " ↓" : " ↑") : "");

  const f = blocks.finance, hr = blocks.hr, bz = blocks.business;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card title="Verdict" sub={`${strategyName(activeStrategy)} · ${viewName(config, activeViewId)}`} hint="Auto-written from the active strategy and view. The recommendation is the lowest all-in cost that holds SLA, or the least-bad option if none does.">
        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.55 }}>{verdict.paragraph}</p>
        <div className="stat-row">
          <Stat l="Meets SLA" v={verdict.rag.green} sub="queue-wks" />
          <Stat l="At risk" v={verdict.rag.amber} sub="queue-wks" />
          <Stat l="Breach" v={verdict.rag.red} sub="queue-wks" />
          <Stat l="Recommended" v={verdict.recommended || "–"} />
        </div>
      </Card>

      <div className="grid cols-3">
        <Card title="Finance" hint="The money view: what it costs to run and what poor experience costs on top.">
          <div className="stat-row" style={{ flexDirection: "column", gap: 12 }}>
            <Stat l="Run cost" v={money(cur, f.runCost)} />
            <Stat l="Churn cost" v={money(cur, f.churn)} />
            <Stat l="Idle pay" v={money(cur, f.idle)} />
            <Stat l="All-in" v={money(cur, f.allIn)} />
            <Stat l="Cost / contact" v={moneyFull(cur, f.costPerContact)} />
            <Stat l="Break-even week" v={f.breakEven ?? "–"} />
          </div>
        </Card>

        <Card title="HR" hint="The people view: hiring against the cap, and the attrition/burnout trajectory.">
          <div className="stat-row" style={{ flexDirection: "column", gap: 12 }}>
            <Stat l="Total reqs raised" v={num(hr.totalReqs, 0)} />
            <Stat l="Global cap" v={hr.cap} sub="/wk" />
            <Stat l="Avg leavers" v={num(hr.avgLeavers, 1)} sub="/wk" />
            <Stat l="Tipping margin" v={num(hr.tippingMargin, 1)} sub={hr.tippingPoint ? "· tipped" : "/wk"} />
            <Stat l="Peak burnout" v={num(hr.peakBurn, 0) + "/100"} />
            <Stat l="Avg in training" v={num(hr.avgTraining, 1)} />
          </div>
        </Card>

        <Card title="Business / CX" hint="The customer view: SLA attainment, lost customers, incident readiness and deflection.">
          <div className="stat-row" style={{ flexDirection: "column", gap: 12 }}>
            <Stat l="Customers lost" v={num(bz.customersLost, 0)} />
            <Stat l="Deflected → voice" v={num(bz.totalDeflected, 0)} />
            <Stat l="P1 stress in view" v={bz.p1Enabled ? "yes" : "no"} />
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
      </div>

      <Card title="Risk register" sub={`${risks.length} risk(s)`} hint="Auto-generated and sortable. Severity is the projected £ (or SLA weeks) at stake; the lever is the cheapest mitigation.">
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
