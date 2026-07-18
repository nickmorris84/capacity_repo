import {
  LineChart, Line, BarChart, Bar, ComposedChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { Chart } from "./primitives.jsx";
import { money } from "../format.js";
const SERIES = ["#0e7c86", "#d98a0b", "#5a54c9", "#c0417a", "#2f8f4e", "#b0602a", "#3a7bd5", "#8a51b0"];
const AX = { fontSize: 11 };
const common = { margin: { top: 8, right: 14, left: 4, bottom: 4 } };
const wkX = { dataKey: "wk", tick: AX, interval: "preserveStartEnd", minTickGap: 18 };

function markLine(selectedWeek) {
  if (selectedWeek == null) return null;
  return <ReferenceLine x={selectedWeek + 1} stroke="#0f1720" strokeDasharray="3 3" strokeOpacity={0.5} />;
}

// ---- Coverage vs 100% ----
export function CoverageChart({ sim, selectedWeek }) {
  const cfg = sim.config;
  const data = sim.weeks.map((w) => {
    const row = { wk: w.week + 1 };
    for (const q of cfg.queues) row[q.id] = +(w.queues[q.id].cover * 100).toFixed(1);
    return row;
  });
  return (
    <Chart title="Coverage vs 100%" hint="Available productive hours ÷ required hours, laid along the requirement curve. 100% means SLA is met in every interval; below is a uniform shortfall.">
      {(w, h) => (
        <LineChart width={w} height={h} data={data} {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis {...wkX} />
          <YAxis tick={AX} width={40} domain={[0, "auto"]} tickFormatter={(v) => v + "%"} />
          <Tooltip formatter={(v) => v + "%"} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={100} stroke="#1f9d55" strokeDasharray="4 2" />
          {markLine(selectedWeek)}
          {cfg.queues.map((q, i) => (
            <Line key={q.id} type="monotone" dataKey={q.id} name={q.name} stroke={SERIES[i % SERIES.length]} dot={false} strokeWidth={2} isAnimationActive={false} />
          ))}
        </LineChart>
      )}
    </Chart>
  );
}

// ---- Headcount bands vs required ----
export function HeadcountChart({ sim, selectedWeek }) {
  const data = sim.weeks.map((w) => ({
    wk: w.week + 1,
    trained: +w.totals.trained.toFixed(1),
    ramping: +w.totals.ramping.toFixed(1),
    training: +w.totals.inTraining.toFixed(1),
    required: +w.totals.reqFte.toFixed(1),
  }));
  return (
    <Chart title="Headcount — trained / ramping / training vs required" hint="Paid heads split by readiness. Trainees cost full salary but deliver zero; ramping agents deliver their learning-curve share. The line is required FTE.">
      {(w, h) => (
        <ComposedChart width={w} height={h} data={data} {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis {...wkX} />
          <YAxis tick={AX} width={40} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="trained" stackId="hc" stroke="#0e7c86" fill="#0e7c86" fillOpacity={0.75} isAnimationActive={false} />
          <Area type="monotone" dataKey="ramping" stackId="hc" stroke="#12a3b0" fill="#57c3cc" fillOpacity={0.7} isAnimationActive={false} />
          <Area type="monotone" dataKey="training" stackId="hc" stroke="#d98a0b" fill="#f0c774" fillOpacity={0.7} isAnimationActive={false} />
          <Line type="monotone" dataKey="required" stroke="#0f1720" strokeWidth={2} dot={false} isAnimationActive={false} />
          {markLine(selectedWeek)}
        </ComposedChart>
      )}
    </Chart>
  );
}

// ---- Volume composition (base / deflected / redial) ----
export function VolumeChart({ sim, selectedWeek }) {
  const cfg = sim.config;
  const data = sim.weeks.map((w) => {
    let base = 0, deflected = 0, redial = 0;
    for (const q of cfg.queues) {
      const s = w.queues[q.id];
      base += s.baseVolume; deflected += s.deflected || 0; redial += s.redial || 0;
    }
    return { wk: w.week + 1, base: Math.round(base), deflected: Math.round(deflected), redial: Math.round(redial) };
  });
  return (
    <Chart title="Volume composition" hint="Exogenous base volume (after seasonality and scenarios) plus endogenous load: digital→voice deflection and abandoned-caller redials.">
      {(w, h) => (
        <BarChart width={w} height={h} data={data} {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis {...wkX} />
          <YAxis tick={AX} width={48} tickFormatter={(v) => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="base" name="Base" stackId="v" fill="#0e7c86" isAnimationActive={false} />
          <Bar dataKey="deflected" name="Deflected" stackId="v" fill="#5a54c9" isAnimationActive={false} />
          <Bar dataKey="redial" name="Redial" stackId="v" fill="#d98a0b" isAnimationActive={false} />
          {markLine(selectedWeek)}
        </BarChart>
      )}
    </Chart>
  );
}

// ---- Cost breakdown ----
export function CostChart({ sim, selectedWeek }) {
  const cur = sim.config.engine.currency;
  const data = sim.weeks.map((w) => ({
    wk: w.week + 1,
    productive: Math.round(w.totals.productiveCost),
    training: Math.round(w.totals.trainCost),
    managers: Math.round(w.totals.managerCost),
    service: Math.round(w.totals.serviceCost || 0),
  }));
  return (
    <Chart title="Cost breakdown" hint="Weekly run cost by component: productive salary, trainee salary, management overhead, and service-team premium hours.">
      {(w, h) => (
        <BarChart width={w} height={h} data={data} {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis {...wkX} />
          <YAxis tick={AX} width={48} tickFormatter={(v) => money(cur, v)} />
          <Tooltip formatter={(v) => money(cur, v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="productive" name="Productive" stackId="c" fill="#0e7c86" isAnimationActive={false} />
          <Bar dataKey="training" name="Training" stackId="c" fill="#d98a0b" isAnimationActive={false} />
          <Bar dataKey="managers" name="Managers" stackId="c" fill="#5a54c9" isAnimationActive={false} />
          <Bar dataKey="service" name="Service team" stackId="c" fill="#2f8f4e" isAnimationActive={false} />
          {markLine(selectedWeek)}
        </BarChart>
      )}
    </Chart>
  );
}

// ---- Idle pay vs churn (with break-even) ----
export function IdleChurnChart({ sim, selectedWeek }) {
  const cur = sim.config.engine.currency;
  const data = sim.weeks.map((w) => ({
    wk: w.week + 1,
    idle: Math.round(w.totals.waste),
    churn: Math.round(w.totals.churnCost),
  }));
  // break-even: first week the two lines cross.
  let cross = null;
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1].idle - data[i - 1].churn;
    const b = data[i].idle - data[i].churn;
    if (a === 0 || (a < 0) !== (b < 0)) { cross = data[i].wk; break; }
  }
  return (
    <Chart title="Idle pay vs churn cost" hint="Over-staffing wastes salary; under-staffing loses customers. The break-even week is where the two curves cross — the cheapest place to sit.">
      {(w, h) => (
        <LineChart width={w} height={h} data={data} {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis {...wkX} />
          <YAxis tick={AX} width={48} tickFormatter={(v) => money(cur, v)} />
          <Tooltip formatter={(v) => money(cur, v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="idle" name="Idle pay" stroke="#3a7bd5" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="churn" name="Churn cost" stroke="#c0417a" strokeWidth={2} dot={false} isAnimationActive={false} />
          {cross != null && <ReferenceLine x={cross} stroke="#1f9d55" label={{ value: "break-even", fontSize: 10, fill: "#1f9d55", position: "top" }} />}
          {markLine(selectedWeek)}
        </LineChart>
      )}
    </Chart>
  );
}

// ---- Burnout ----
export function BurnoutChart({ sim, selectedWeek }) {
  const cfg = sim.config;
  const data = sim.weeks.map((w) => {
    const row = { wk: w.week + 1 };
    for (const q of cfg.queues) row[q.id] = Math.round(w.queues[q.id].burnout);
    return row;
  });
  return (
    <Chart title="Burnout index" hint="Accumulates while occupancy exceeds the threshold, multiplying attrition and adding absence shrinkage; recovers when occupancy eases.">
      {(w, h) => (
        <LineChart width={w} height={h} data={data} {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
          <XAxis {...wkX} />
          <YAxis tick={AX} width={36} domain={[0, 100]} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {cfg.queues.map((q, i) => (
            <Line key={q.id} type="monotone" dataKey={q.id} name={q.name} stroke={SERIES[i % SERIES.length]} dot={false} strokeWidth={2} isAnimationActive={false} />
          ))}
          {markLine(selectedWeek)}
        </LineChart>
      )}
    </Chart>
  );
}
