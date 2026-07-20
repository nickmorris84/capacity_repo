import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Chart } from "./primitives.jsx";
import { totalsDelta, allInOverlay, perQueueBlocks } from "../saved-runs.js";
import { money, pct, num, secs } from "../format.js";

/* Run comparison blocks (§26.4 — comparison lives on the landing). These are
   the §10 compare builders' renderers, extracted from the retired Snapshots
   tab; Session B replaces this panel with the §26.7 verdict-first compare.
   Deltas are versus the first ticked run. */
const SERIES = ["#8a6d10", "#4655c9", "#2f8f5b", "#b23c2a"];

export function TotalsDelta({ runs, cur }) {
  const { rows, metrics } = totalsDelta(runs);
  const fmt = (k, v) => (k === "endPaid" ? num(v, 0) : money(cur, v));
  return (
    <div className="tbl-wrap">
      <table className="data" data-testid="totals-delta">
        <thead><tr><th>Run</th>{metrics.map((m) => <th key={m.key}>{m.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ textAlign: "left", fontWeight: 600 }}>{r.name}{r.baseline ? " (baseline)" : ""}</td>
              {metrics.map((m) => (
                <td key={m.key}>
                  {fmt(m.key, r.values[m.key])}
                  {!r.baseline && <span style={{ color: r.deltas[m.key] > 0 ? "var(--risk-text)" : "var(--green-text)", fontSize: 11, marginLeft: 6 }}>{r.deltas[m.key] > 0 ? "▲" : "▼"}{fmt(m.key, Math.abs(r.deltas[m.key]))}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AllInOverlay({ runs, cur }) {
  const data = allInOverlay(runs);
  return (
    <Chart title="" height={240}>
      {(w, h) => (
        <LineChart width={w} height={h} data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ecebe6" />
          <XAxis dataKey="wk" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(v) => money(cur, v)} />
          <Tooltip formatter={(v) => money(cur, v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {runs.map((r, i) => <Line key={r.slug} type="monotone" dataKey={r.slug} name={r.name} stroke={SERIES[i % SERIES.length]} dot={false} strokeWidth={2} isAnimationActive={false} />)}
        </LineChart>
      )}
    </Chart>
  );
}

export function PerQueue({ runs, cur }) {
  const blocks = perQueueBlocks(runs);
  return (
    <div className="grid" style={{ gap: 12 }} data-testid="per-queue-compare">
      {blocks.map((b) => (
        <div key={b.name} className="erow">
          <div className="erow-h"><strong>{b.name}</strong></div>
          <div className="erow-b">
            <div className="tbl-wrap">
              <table className="data">
                <thead><tr><th>Run</th><th>Red wks</th><th>Avg cover</th><th>Worst</th><th>Cost</th><th>Churn</th></tr></thead>
                <tbody>
                  {b.cells.map((c, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: "left" }}>{c.run.name}</td>
                      {c.present ? (
                        <>
                          <td className={c.redWeeks ? "st-red" : "st-green"}>{c.redWeeks}</td>
                          <td>{pct(c.avgCover)}</td>
                          <td>{c.worst.fmt === "s" ? secs(c.worst.value) : pct(c.worst.value)}</td>
                          <td>{money(cur, c.cost)}</td>
                          <td>{money(cur, c.churn)}</td>
                        </>
                      ) : <td colSpan={5} className="empty">not in this run</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
