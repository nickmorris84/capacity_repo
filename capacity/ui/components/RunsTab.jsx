import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Card, Chart } from "./primitives.jsx";
import { totalsDelta, allInOverlay, perQueueBlocks } from "../saved-runs.js";
import { downloadText } from "../exports.js";
import { money, pct, num, secs } from "../format.js";

const SERIES = ["#0e7c86", "#d98a0b", "#5a54c9", "#c0417a"];
const dt = (iso) => { try { return iso.replace("T", " ").slice(0, 16); } catch (e) { return iso; } };

/* Runs tab (SPEC §10): the saved-run library + comparison. The compare tick set
   lives in App (lifted above the tabs) so switching tabs never clears it — the
   v3 defect this phase calls out. */
export function RunsTab({ runs, storageMode, storageNotice, compareSel, setCompareSel, onSave, onLoadSettings, onDelete, onRefresh, config }) {
  const [name, setName] = useState("");
  const cur = config.engine.currency;

  const toggle = (slug) => setCompareSel((sel) => (sel.includes(slug) ? sel.filter((s) => s !== slug) : [...sel, slug]));
  const selected = runs.filter((r) => compareSel.includes(r.slug));

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card
        title="Saved runs"
        sub={`storage: ${storageMode}`}
        hint="Save the current plan as a named run, then tick runs to compare them. Runs persist through the storage adapter; download a run to share it."
        right={<button type="button" className="btn sm" onClick={onRefresh}>Refresh</button>}
      >
        {storageNotice && <p className="note" style={{ marginBottom: 12, color: "var(--amber)" }}>{storageNotice}</p>}
        <div className="rowflex">
          <input type="text" className="inp" style={{ maxWidth: 260 }} placeholder="run name" value={name} onChange={(e) => setName(e.target.value)} data-testid="run-name" />
          <button type="button" className="btn primary" data-testid="save-run" disabled={!name.trim()} onClick={() => { onSave(name.trim()); setName(""); }}>Save current plan</button>
        </div>

        <div className="tbl-wrap" style={{ marginTop: 14 }}>
          <table className="data" data-testid="runs-table">
            <thead>
              <tr><th>Compare</th><th>Name</th><th>Saved</th><th>Strategy</th><th>All-in</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.slug}>
                  <td>
                    <label className="switch" style={{ justifyContent: "center" }}>
                      <input type="checkbox" checked={compareSel.includes(r.slug)} onChange={() => toggle(r.slug)} data-testid={"tick-" + r.slug} />
                      <span className="track" aria-hidden="true" />
                    </label>
                  </td>
                  <td style={{ textAlign: "left", fontWeight: 600 }}>{r.name}</td>
                  <td>{dt(r.savedAt)}</td>
                  <td>{r.strategy}</td>
                  <td>{money(cur, r.allIn)}</td>
                  <td>
                    <span className="btnbar">
                      <button type="button" className="btn sm" onClick={() => onLoadSettings(r)}>Load settings</button>
                      <button type="button" className="btn sm" onClick={() => downloadText(`${r.slug}.json`, JSON.stringify({ kind: "capacity-run", savedAt: r.savedAt, config: r.config, run: r.run }, null, 2), "application/json")}>Download</button>
                      <button type="button" className="btn sm danger" onClick={() => onDelete(r)}>Delete</button>
                    </span>
                  </td>
                </tr>
              ))}
              {runs.length === 0 && <tr><td colSpan={6} className="empty">No saved runs yet — save the current plan above.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {selected.length > 0 && (
        <Card title="Compare" sub={`${selected.length} run(s) ticked`} hint="Ticked runs compared side by side. Deltas are versus the first ticked run.">
          <TotalsDelta runs={selected} cur={cur} />
          <h4 style={{ margin: "18px 0 6px", fontSize: 13 }}>Cumulative all-in cost</h4>
          <AllInOverlay runs={selected} cur={cur} />
          <h4 style={{ margin: "18px 0 6px", fontSize: 13 }}>Per-queue comparison (matched by name)</h4>
          <PerQueue runs={selected} cur={cur} />
        </Card>
      )}
    </div>
  );
}

function TotalsDelta({ runs, cur }) {
  const { rows, metrics } = totalsDelta(runs);
  const fmt = (k, v) => (k === "endPaid" ? num(v, 0) : money(cur, v));
  return (
    <div className="tbl-wrap">
      <table className="data" data-testid="totals-delta">
        <thead>
          <tr><th>Run</th>{metrics.map((m) => <th key={m.key}>{m.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ textAlign: "left", fontWeight: 600 }}>{r.name}{r.baseline ? " (baseline)" : ""}</td>
              {metrics.map((m) => (
                <td key={m.key}>
                  {fmt(m.key, r.values[m.key])}
                  {!r.baseline && <span style={{ color: r.deltas[m.key] > 0 ? "var(--red)" : "var(--green)", fontSize: 11, marginLeft: 6 }}>
                    {r.deltas[m.key] > 0 ? "▲" : "▼"}{fmt(m.key, Math.abs(r.deltas[m.key]))}
                  </span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AllInOverlay({ runs, cur }) {
  const data = allInOverlay(runs);
  return (
    <Chart title="" height={240}>
      {(w, h) => (
        <LineChart width={w} height={h} data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
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

function PerQueue({ runs, cur }) {
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
            <Chart title="" height={180}>
              {(w, h) => (
                <LineChart width={w} height={h} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
                  <XAxis dataKey="wk" type="number" domain={[1, "dataMax"]} tick={{ fontSize: 11 }} allowDuplicatedCategory={false} />
                  <YAxis tick={{ fontSize: 11 }} width={40} tickFormatter={(v) => v + "%"} />
                  <Tooltip formatter={(v) => v + "%"} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {b.cells.filter((c) => c.present).map((c, i) => (
                    <Line key={i} data={c.coverSeries} dataKey="cover" name={c.run.name} stroke={SERIES[i % SERIES.length]} dot={false} strokeWidth={2} isAnimationActive={false} />
                  ))}
                </LineChart>
              )}
            </Chart>
          </div>
        </div>
      ))}
    </div>
  );
}
