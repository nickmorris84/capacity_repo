import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Chart } from "./primitives.jsx";
import { money } from "../format.js";

const SERIES = ["#0e7c86", "#d98a0b", "#5a54c9", "#c0417a", "#2f8f4e", "#b0602a", "#3a7bd5", "#8a51b0"];

/* Overlay of cumulative all-in cost, one line per series. The caller supplies
   the series (either the four strategies for the active view, or the selected
   views for the active strategy — never both, per the SPEC dimension rule), so
   this component stays agnostic to which dimension is being compared. The
   `data-series` attribute exposes the live series count for the gate. */
export function ComparisonChart({ series, currency, title, hint }) {
  const live = series.filter((s) => s.sim);
  const len = live.reduce((m, s) => Math.max(m, s.sim.weeks.length), 0);
  const data = [];
  for (let w = 0; w < len; w++) {
    const row = { wk: w + 1 };
    for (const s of live) {
      const weeks = s.sim.weeks;
      let cum = 0;
      for (let i = 0; i <= w && i < weeks.length; i++) cum += weeks[i].totals.allInCost;
      row[s.key] = Math.round(cum);
    }
    data.push(row);
  }
  return (
    <div data-testid="comparison-chart" data-series={live.length}>
      <Chart title={title} hint={hint} height={280}>
        {(w, h) => (
          <LineChart width={w} height={h} data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
            <XAxis dataKey="wk" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(v) => money(currency, v)} />
            <Tooltip formatter={(v) => money(currency, v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {live.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        )}
      </Chart>
    </div>
  );
}
