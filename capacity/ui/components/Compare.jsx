import { useState, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Chart } from "./primitives.jsx";
import { money, num, pct } from "../format.js";
import {
  CHIP_COLORS, runComparator, computeLive, headline, dirClass, verdict, configDiff,
  metrics, moneyOverlay, coverageOverlay, weeksRedPerQueue, perQueue,
} from "../compare.js";

/* §26.7 verdict-first Compare — a landing screen. Pick 2–4 comparators (each
   simulation's Runs + a "Live now" entry), one is the switchable reference, and
   every figure below re-bases against it. Live comparators are computed on
   demand and cached until the simulation's updatedAt changes; Runs are instant.
   Containment holds — wide content scrolls inside its own wrapper. */

function DeltaChip({ dir, delta, fmt }) {
  if (!delta || Math.abs(delta) < 1e-9) return <span className="delta-chip flat">±0</span>;
  const cls = dirClass(dir, delta);
  return <span className={"delta-chip " + cls}>{delta > 0 ? "▲" : "▼"}{fmt(Math.abs(delta))}</span>;
}

function Section({ title, children, defaultOpen }) {
  return (
    <details className="set-sec" open={defaultOpen || undefined}>
      <summary><span className="chev" aria-hidden="true">▸</span><span className="set-sec-t">{title}</span></summary>
      <div className="set-b">{children}</div>
    </details>
  );
}

export function Compare({ sims, records, onBack }) {
  // Comparator picker: Runs + a Live-now entry per simulation.
  const options = useMemo(() => {
    const out = [];
    for (const s of sims) {
      const rec = records[s.id];
      if (!rec) continue;
      out.push({ value: "live:" + s.id, label: `${s.name} · Live now`, simId: s.id });
      for (const r of rec.runs || []) out.push({ value: "run:" + r.id, label: `${s.name} · ${r.name}`, simId: s.id, runId: r.id });
    }
    return out;
  }, [sims, records]);

  const [selected, setSelected] = useState([]); // ordered comparator keys (2–4)
  const [refKey, setRefKey] = useState(null);
  const [computing, setComputing] = useState(false);
  const liveCache = useRef(new Map()); // simId -> { updatedAt, comparator }

  const toggle = (value) => {
    setSelected((sel) => {
      if (sel.includes(value)) { const next = sel.filter((v) => v !== value); if (refKey === value) setRefKey(next[0] || null); return next; }
      if (sel.length >= 4) return sel;
      const next = [...sel, value];
      if (!refKey) setRefKey(value);
      return next;
    });
  };

  // Build the comparator objects (live ones compute on demand + cache).
  const comparators = useMemo(() => {
    let didCompute = false;
    const built = selected.map((value, i) => {
      const [kind, id] = value.split(":");
      let c;
      if (kind === "run") {
        const rec = Object.values(records).find((r) => (r.runs || []).some((x) => x.id === id));
        const run = rec && rec.runs.find((x) => x.id === id);
        if (!rec || !run) return null;
        c = runComparator(rec, run);
      } else {
        const rec = records[id];
        if (!rec) return null;
        const cached = liveCache.current.get(id);
        if (cached && cached.updatedAt === rec.updatedAt) { c = cached.comparator; }
        else { c = computeLive(rec); liveCache.current.set(id, { updatedAt: rec.updatedAt, comparator: c }); didCompute = true; }
      }
      return { ...c, key: value, color: CHIP_COLORS[i % CHIP_COLORS.length] };
    }).filter(Boolean);
    if (didCompute) { /* surfaced via the progress note below on first build */ }
    return built;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, records]);

  const ref = comparators.find((c) => c.key === refKey) || comparators[0];
  const cur = (ref && ref.config && ref.config.engine && ref.config.engine.currency) || "£";
  const ready = comparators.length >= 2 && ref;

  return (
    <div className="app landing" data-testid="compare">
      <header className="topbar">
        <button type="button" className="backlink" onClick={onBack} data-testid="compare-back">← Simulations</button>
        <div className="brand"><span className="mark">C</span><span>Compare</span></div>
        <span className="spacer" />
      </header>
      <main className="main" style={{ maxWidth: 1100 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h"><h3>Comparators</h3><span className="sub">pick 2–4 · Runs render instantly, Live now computes on demand</span></div>
          <div className="card-b">
            <div className="cmp-picker" data-testid="compare-picker">
              {options.map((o) => {
                const on = selected.includes(o.value);
                const idx = selected.indexOf(o.value);
                return (
                  <label key={o.value} className={"cmp-opt" + (on ? " on" : "")}>
                    <input type="checkbox" checked={on} disabled={!on && selected.length >= 4} onChange={() => toggle(o.value)} data-testid={"cmp-pick-" + o.value} />
                    {on && <span className="cmp-chip" style={{ background: CHIP_COLORS[idx % CHIP_COLORS.length] }} aria-hidden="true" />}
                    <span>{o.label}</span>
                  </label>
                );
              })}
              {options.length === 0 && <p className="empty">No simulations to compare yet.</p>}
            </div>
          </div>
        </div>

        {!ready && <p className="note" data-testid="compare-hint">Tick at least two comparators above to compare them.</p>}

        {ready && (
          <>
            {/* 1 — headline strip + auto-verdict */}
            <HeadlineStrip comparators={comparators} ref_={ref} refKey={refKey} setRefKey={setRefKey} cur={cur} />

            {/* 2 — what changed */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-h"><h3>What changed</h3><span className="sub">exact config diff vs {ref.name}</span></div>
              <div className="card-b"><WhatChanged comparators={comparators} ref_={ref} cur={cur} /></div>
            </div>

            {/* 3 — Money / Service / People */}
            <div style={{ marginTop: 16 }} data-testid="compare-sections">
              <Section title="Money" defaultOpen>
                <MoneySection comparators={comparators} ref_={ref} cur={cur} />
              </Section>
              <Section title="Service">
                <ServiceSection comparators={comparators} ref_={ref} />
              </Section>
              <Section title="People">
                <PeopleSection comparators={comparators} ref_={ref} />
              </Section>
            </div>

            {/* 4 — per-queue accordion (largest |Δ| first) */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-h"><h3>Per-queue</h3><span className="sub">matched by name · largest all-in delta first</span></div>
              <div className="card-b"><PerQueueAccordion comparators={comparators} ref_={ref} cur={cur} /></div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function HeadlineStrip({ comparators, ref_, refKey, setRefKey, cur }) {
  const best = comparators.reduce((b, c) => (headline(c).allIn < headline(b).allIn ? c : b), comparators[0]);
  return (
    <div className="cmp-headline" data-testid="headline-strip">
      {comparators.map((c) => {
        const h = headline(c);
        const isRef = c.key === ref_.key;
        return (
          <div key={c.key} className={"cmp-card" + (c.key === best.key ? " best" : "")} data-testid={"headline-card-" + c.key} style={{ borderTopColor: c.color }}>
            <div className="cmp-card-h">
              <span className="cmp-chip" style={{ background: c.color }} aria-hidden="true" />
              <strong>{c.name}</strong>
              <span className="pill">{c.label}</span>
              {c.key === best.key && <span className="badge green">best all-in</span>}
            </div>
            <div className="cmp-kpis">
              <div className="stat"><span className="l">All-in</span><span className="v">{money(cur, h.allIn)}</span></div>
              <div className="stat"><span className="l">Weeks red</span><span className="v">{h.weeksRed}</span></div>
              <div className="stat"><span className="l">Customers lost</span><span className="v">{num(h.lost, 0)}</span></div>
            </div>
            <p className="cmp-verdict" data-testid={"verdict-" + c.key}>{verdict(c, ref_, cur)}</p>
            <label className="cmp-refpick">
              <input type="radio" name="cmp-ref" checked={isRef} onChange={() => setRefKey(c.key)} data-testid={"set-ref-" + c.key} />
              <span>{isRef ? "Reference" : "Set as reference"}</span>
            </label>
          </div>
        );
      })}
    </div>
  );
}

function WhatChanged({ comparators, ref_, cur }) {
  const others = comparators.filter((c) => c.key !== ref_.key);
  const fmtVal = (v) => (typeof v === "number" ? num(v, Math.abs(v) < 10 && v % 1 !== 0 ? 3 : 0) : String(v));
  return (
    <div className="grid" style={{ gap: 12 }}>
      {others.map((c) => {
        const changes = configDiff(ref_, c);
        return (
          <div key={c.key} className="erow" data-testid={"whatchanged-" + c.key}>
            <div className="erow-h"><span className="cmp-chip" style={{ background: c.color }} aria-hidden="true" /><strong>{c.name}</strong><span className="pill">{changes.length} change{changes.length === 1 ? "" : "s"}</span></div>
            <div className="erow-b">
              {changes.length === 0 ? <p className="note">Identical configuration to {ref_.name}.</p> : (
                <ul className="cmp-diff">
                  {changes.map((ch, i) => (
                    <li key={i}>
                      <span className="cmp-diff-k">{ch.label}</span>
                      {ch.from !== undefined && ch.to !== undefined
                        ? <span className="cmp-diff-v">{fmtVal(ch.from)} → {fmtVal(ch.to)}</span>
                        : ch.to !== undefined ? <span className="cmp-diff-v">+ {fmtVal(ch.to)}</span>
                        : <span className="cmp-diff-v">− {fmtVal(ch.from)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeltaTable({ comparators, ref_, rows, cur }) {
  const refM = metrics(ref_);
  const M = comparators.map((c) => ({ c, m: metrics(c) }));
  return (
    <div className="tbl-wrap">
      <table className="data" data-testid="delta-table">
        <thead><tr><th>Metric</th>{M.map(({ c }) => <th key={c.key}><span className="cmp-chip sm" style={{ background: c.color }} aria-hidden="true" />{c.name}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td style={{ textAlign: "left" }}>{r.label}</td>
              {M.map(({ c, m }) => {
                const isRef = c.key === ref_.key;
                const delta = m[r.key] - refM[r.key];
                return (
                  <td key={c.key} data-testid={`cell-${r.key}-${c.key}`}>
                    {r.fmt(m[r.key], cur)}
                    {!isRef && <DeltaChip dir={r.dir} delta={delta} fmt={(v) => r.fmt(v, cur)} />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoneySection({ comparators, ref_, cur }) {
  const data = moneyOverlay(comparators);
  const rows = [
    { key: "allIn", label: "All-in", dir: "higherBad", fmt: (v, c) => money(c, v) },
    { key: "cost", label: "Run cost", dir: "higherBad", fmt: (v, c) => money(c, v) },
    { key: "churn", label: "Churn cost", dir: "higherBad", fmt: (v, c) => money(c, v) },
    { key: "lost", label: "Customers lost", dir: "higherBad", fmt: (v) => num(v, 0) },
  ];
  return (
    <>
      <Chart title="Cumulative all-in cost" height={230}>
        {(w, h) => (
          <LineChart width={w} height={h} data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ecebe6" />
            <XAxis dataKey="wk" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tick={{ fontSize: 11 }} width={54} tickFormatter={(v) => money(cur, v)} />
            <Tooltip formatter={(v) => money(cur, v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {comparators.map((c) => <Line key={c.key} type="monotone" dataKey={c.key} name={c.name} stroke={c.color} dot={false} strokeWidth={2} isAnimationActive={false} />)}
          </LineChart>
        )}
      </Chart>
      <div style={{ marginTop: 12 }}><DeltaTable comparators={comparators} ref_={ref_} rows={rows} cur={cur} /></div>
    </>
  );
}

function ServiceSection({ comparators, ref_ }) {
  const data = coverageOverlay(comparators);
  const heat = weeksRedPerQueue(comparators);
  const maxRed = Math.max(1, ...heat.flatMap((r) => r.cells.map((cl) => cl.red || 0)));
  return (
    <>
      <Chart title="Average coverage (%)" height={220}>
        {(w, h) => (
          <LineChart width={w} height={h} data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ecebe6" />
            <XAxis dataKey="wk" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tick={{ fontSize: 11 }} width={44} tickFormatter={(v) => v + "%"} />
            <Tooltip formatter={(v) => v + "%"} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {comparators.map((c) => <Line key={c.key} type="monotone" dataKey={c.key} name={c.name} stroke={c.color} dot={false} strokeWidth={2} isAnimationActive={false} />)}
          </LineChart>
        )}
      </Chart>
      <h4 style={{ margin: "16px 0 8px", fontSize: 13 }}>Weeks red per queue</h4>
      <div className="tbl-wrap">
        <table className="data" data-testid="service-heat">
          <thead><tr><th>Queue</th>{comparators.map((c) => <th key={c.key}><span className="cmp-chip sm" style={{ background: c.color }} aria-hidden="true" />{c.name}</th>)}</tr></thead>
          <tbody>
            {heat.map((r) => (
              <tr key={r.name}>
                <td style={{ textAlign: "left" }}>{r.name}</td>
                {r.cells.map((cl) => (
                  <td key={cl.key} style={{ background: cl.red == null ? "transparent" : `rgba(178,60,42,${0.08 + 0.5 * (cl.red / maxRed)})` }}>
                    {cl.red == null ? "—" : cl.red}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PeopleSection({ comparators, ref_ }) {
  const rows = [
    { key: "endHC", label: "End headcount", dir: "neutral", fmt: (v) => num(v, 0) },
    { key: "attrition", label: "Total leavers", dir: "higherBad", fmt: (v) => num(v, 0) },
    { key: "burnoutPeak", label: "Peak burnout", dir: "higherBad", fmt: (v) => num(v, 0) + "/100" },
    { key: "avgCover", label: "Avg coverage", dir: "higherGood", fmt: (v) => pct(v, 1) },
  ];
  return <DeltaTable comparators={comparators} ref_={ref_} rows={rows} cur="£" />;
}

function PerQueueAccordion({ comparators, ref_, cur }) {
  const rows = perQueue(comparators, ref_);
  const refM = comparators.find((c) => c.key === ref_.key);
  return (
    <div className="rows" data-testid="per-queue-accordion">
      {rows.map((r) => (
        <details className="erow" key={r.name}>
          <summary><span className="chev">▶</span><strong>{r.name}</strong><span className="spacer" /><span className="pill">Δ up to {money(cur, r.maxAbs)}</span></summary>
          <div className="erow-b">
            <div className="tbl-wrap">
              <table className="data">
                <thead><tr><th>Comparator</th><th>All-in</th><th>Red wks</th><th>Avg cover</th></tr></thead>
                <tbody>
                  {r.cells.map((cl) => {
                    const c = comparators.find((x) => x.key === cl.key);
                    const isRef = cl.key === ref_.key;
                    const dCost = cl.m && r.cells.find((x) => x.key === ref_.key).m ? cl.m.cost - r.cells.find((x) => x.key === ref_.key).m.cost : 0;
                    return (
                      <tr key={cl.key}>
                        <td style={{ textAlign: "left" }}><span className="cmp-chip sm" style={{ background: c.color }} aria-hidden="true" />{c.name}</td>
                        {cl.m ? (
                          <>
                            <td>{money(cur, cl.m.cost)}{!isRef && <DeltaChip dir="higherBad" delta={dCost} fmt={(v) => money(cur, v)} />}</td>
                            <td className={cl.m.redWeeks ? "st-red" : "st-green"}>{cl.m.redWeeks}</td>
                            <td>{pct(cl.m.avgCover)}</td>
                          </>
                        ) : <td colSpan={3} className="empty">not in this comparator</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
