import { Card, Hint } from "./primitives.jsx";
import { ComparisonChart } from "./ComparisonChart.jsx";
import { HolisticPanel } from "./HolisticPanel.jsx";
import { STRATEGIES, STRATEGY_IDS, strategyStats, recommendStrategy, viewName } from "../views.js";
import { money, num } from "../format.js";

const MAX_OVERLAY = 4;

// Side-by-side S1–S4 comparison for the active view (SPEC §3 columns).
function ComparisonTable({ strategySims, activeStrategy, onActivate, currency }) {
  const statsById = {};
  for (const id of STRATEGY_IDS) statsById[id] = strategyStats(strategySims[id]);
  const recommended = recommendStrategy(statsById);

  return (
    <div className="tbl-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Strategy</th>
            <th>Red weeks</th>
            <th>End HC</th>
            <th>Run cost</th>
            <th>Churn</th>
            <th>All-in</th>
            <th>Feasibility</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {STRATEGIES.map((strat) => {
            const s = statsById[strat.id];
            if (!s) return (
              <tr key={strat.id}><td>{strat.id}</td><td colSpan={7} className="empty">computing…</td></tr>
            );
            const isActive = strat.id === activeStrategy;
            const isRec = strat.id === recommended;
            return (
              <tr key={strat.id} style={isActive ? { background: "rgba(14,124,134,.08)" } : undefined}>
                <td>
                  <strong>{strat.id}</strong> {strat.name}
                  {isActive ? <span className="tag" style={{ marginLeft: 6 }}>active</span> : null}
                  {isRec ? <span className="tag soft" style={{ marginLeft: 6 }}>recommended</span> : null}
                </td>
                <td className={s.redWeeks > 0 ? "st-red" : "st-green"}>{s.redWeeks}</td>
                <td>{num(s.endHC, 0)}</td>
                <td>{money(currency, s.runCost)}</td>
                <td>{money(currency, s.churn)}</td>
                <td><strong>{money(currency, s.allIn)}</strong></td>
                <td className={s.feasible ? "st-green" : "st-red"}>
                  {s.feasible ? "Feasible" : s.flags.capInfeasible ? "Cap-bound" : s.flags.tippingPoint ? "Tipping point" : "Breaches SLA"}
                </td>
                <td>
                  <button type="button" className={"btn sm" + (isActive ? " primary" : "")} disabled={isActive} onClick={() => onActivate(strat.id)}>
                    {isActive ? "Active" : "Make active"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StrategiesTab({ simSet, config, activeStrategy, activeViewId, onActivateStrategy, comparison, setComparison }) {
  const cur = config.engine.currency;
  const { strategySims, viewSims, activeSim } = simSet;
  const { dimension, overlayViewIds } = comparison;

  // Build the overlay series for whichever dimension is selected.
  let series, chartTitle, chartHint;
  if (dimension === "strategies") {
    series = STRATEGIES.map((strat) => ({ key: strat.id, name: `${strat.id} · ${strat.name}`, sim: strategySims[strat.id] }));
    chartTitle = `Cumulative all-in cost by strategy — view: ${viewName(config, activeViewId)}`;
    chartHint = "Each line is one hiring strategy simulated under the active scenario view. The lowest line that holds SLA is the recommended plan.";
  } else {
    series = overlayViewIds.map((vid) => ({ key: vid, name: viewName(config, vid), sim: viewSims[vid] }));
    chartTitle = `Cumulative all-in cost by view — strategy: ${activeStrategy}`;
    chartHint = "Each line is one scenario view simulated under the active hiring strategy — the cost of the same plan across different futures.";
  }

  const toggleOverlayView = (vid) => {
    setComparison((c) => {
      const has = c.overlayViewIds.includes(vid);
      if (has) return { ...c, overlayViewIds: c.overlayViewIds.filter((x) => x !== vid) };
      if (c.overlayViewIds.length >= MAX_OVERLAY) return c; // cap at 4 (keeps ≤8 sims)
      return { ...c, overlayViewIds: [...c.overlayViewIds, vid] };
    });
  };

  return (
    <div
      className="grid"
      style={{ gap: 16 }}
      data-testid="strategies-panel"
      data-compute-ms={Math.round(simSet.computeMs || 0)}
      data-compute-sims={simSet.computeCount || 0}
      data-active-allin={Math.round(activeSim ? activeSim.summary.allIn : 0)}
    >
      <Card title="Strategy comparison" sub={`active view: ${viewName(config, activeViewId)}`} hint="All four strategies are re-run on every change. The active strategy drives every other tab.">
        <ComparisonTable strategySims={strategySims} activeStrategy={activeStrategy} onActivate={onActivateStrategy} currency={cur} />
      </Card>

      <Card
        title="Overlay comparison"
        hint="A single toggle chooses the comparison dimension: strategies within the active view, or views within the active strategy — never both, so the simulation count stays within budget."
        right={
          <div className="btnbar" role="group" aria-label="Comparison dimension">
            <button
              type="button"
              className={"btn sm" + (dimension === "strategies" ? " primary" : "")}
              aria-pressed={dimension === "strategies"}
              onClick={() => setComparison((c) => ({ ...c, dimension: "strategies" }))}
            >Compare strategies</button>
            <button
              type="button"
              className={"btn sm" + (dimension === "views" ? " primary" : "")}
              aria-pressed={dimension === "views"}
              onClick={() => setComparison((c) => ({ ...c, dimension: "views" }))}
            >Compare views</button>
          </div>
        }
      >
        {dimension === "views" && (
          <div className="rowflex" style={{ marginBottom: 12 }}>
            <span className="lab" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Overlay views <Hint text="Pick up to four scenario views to overlay for the active strategy." />
            </span>
            {config.views.map((v) => {
              const on = overlayViewIds.includes(v.id);
              const disabled = !on && overlayViewIds.length >= MAX_OVERLAY;
              return (
                <label key={v.id} className="switch" style={disabled ? { opacity: 0.5 } : undefined}>
                  <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggleOverlayView(v.id)} />
                  <span className="track" aria-hidden="true" />
                  <span>{v.name}</span>
                </label>
              );
            })}
            <span className="pill">{overlayViewIds.length}/{MAX_OVERLAY}</span>
          </div>
        )}
        <ComparisonChart series={series} currency={cur} title={chartTitle} hint={chartHint} />
      </Card>

      {activeSim && <HolisticPanel sim={activeSim} />}
    </div>
  );
}
