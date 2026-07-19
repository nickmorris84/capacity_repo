import { useState } from "react";
import { BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Card, Chart, SelectField } from "./primitives.jsx";
import { intervalLabel, pct, num, secs } from "../format.js";

/* Required vs available agents per 30-min interval for the first day of a chosen
   week, plus the full interval detail table. Reads `sim` only (E4). */
export function IntradayTab({ sim }) {
  const cfg = sim.config;
  const eng = cfg.engine;
  const [qid, setQid] = useState(cfg.queues[0] ? cfg.queues[0].id : "");
  const [wk, setWk] = useState(0);

  const q = cfg.queues.find((x) => x.id === qid) || cfg.queues[0];
  if (!q) return <div className="empty">No queues configured.</div>;
  const week = sim.weeks[Math.min(wk, sim.weeks.length - 1)];
  const day = week.intraday;
  const byInterval = (day && day.res[q.id] && day.res[q.id].byInterval) || [];
  const voice = q.type === "voice";

  const data = byInterval.map((iv) => ({
    t: intervalLabel(iv.i, eng),
    required: +iv.req.toFixed(2),
    available: +iv.agents.toFixed(2),
    arrivals: Math.round(iv.arrivals),
  }));

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card title="Intraday view" sub="first day of the selected week" hint="Pick a queue, then click any week in the strip — coloured by that queue's SLA verdict — to load its first-day intraday profile.">
        <div className="fieldrow" style={{ maxWidth: 320, marginBottom: 12 }}>
          <SelectField
            label="Queue"
            value={q.id}
            onChange={setQid}
            options={cfg.queues.map((x) => ({ value: x.id, label: x.name }))}
          />
        </div>
        <div className="lab" style={{ marginBottom: 6 }}>Weeks — {q.name} (click to load)</div>
        <div className="week-strip" data-testid="week-strip">
          {sim.weeks.map((w) => {
            const st = w.queues[q.id].status;
            const sel = w.week === Math.min(wk, sim.weeks.length - 1);
            return (
              <button
                key={w.week}
                type="button"
                className={"wk-cell" + (sel ? " sel" : "")}
                data-st={st}
                aria-pressed={sel}
                aria-label={`Week ${w.week + 1}: ${st}`}
                onClick={() => setWk(w.week)}
              >{w.week + 1}</button>
            );
          })}
        </div>
      </Card>

      <Chart title={`Required vs available agents — ${q.name}`} hint="Available agent-hours are laid along the requirement curve (engineering note E2), so quiet intervals still receive proportionally more agents. Bars are required; the line is available.">
        {(w, h) => (
          <ComposedChart width={w} height={h} data={data} margin={{ top: 8, right: 14, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
            <XAxis dataKey="t" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={{ fontSize: 11 }} width={40} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="required" name="Required agents" fill="#0e7c86" isAnimationActive={false} />
            <Line type="monotone" dataKey="available" name="Available agents" stroke="#d98a0b" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        )}
      </Chart>

      <Card title="Interval detail" sub={`${q.name} · week ${Math.min(wk, sim.weeks.length - 1) + 1}`}>
        <div className="tbl-wrap" style={{ maxHeight: 460 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Interval</th>
                <th>Arrivals</th>
                <th>Required</th>
                <th>Available</th>
                {voice ? <><th>ASA</th><th>Abandon</th><th>SL</th></> : <><th>Backlog</th><th>Response</th><th>Served</th></>}
                <th>Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {byInterval.map((iv) => (
                <tr key={iv.i}>
                  <td>{intervalLabel(iv.i, eng)}</td>
                  <td>{Math.round(iv.arrivals)}</td>
                  <td>{num(iv.req, 1)}</td>
                  <td>{num(iv.agents, 1)}</td>
                  {voice ? (
                    <>
                      <td>{secs(iv.asa)}</td>
                      <td>{pct(iv.abandon, 1)}</td>
                      <td>{pct(iv.sl)}</td>
                    </>
                  ) : (
                    <>
                      <td>{num(iv.backlog, 0)}</td>
                      <td>{num((iv.resp || 0), 1)}m</td>
                      <td>{num(iv.served || 0, 0)}</td>
                    </>
                  )}
                  <td>{pct(iv.occ)}</td>
                </tr>
              ))}
              {byInterval.length === 0 && (
                <tr><td colSpan={8} className="empty">No intraday detail for this selection.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
