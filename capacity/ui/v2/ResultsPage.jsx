/* v2.4 rebuild — Results page (Step 3). One context bar, five lenses (Summary ·
 * Plan · Intraday · Data · Flow), one shared week cursor. Built to
 * results-page-v2.html and driven by REAL engine output (via model/adapter.js →
 * the preserved engine). The decision matrix in Summary sets the context bar; the
 * Plan ribbon sets the week cursor; Intraday and Flow inherit it.
 */
import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from "react";
import { FAMILY_COLORS } from "./tokens.js";
import { computeBase, computeDetail, pickSelection } from "./compute.js";
import { useDeferred } from "./hooks.js";

const fmtGBP = (n) => "£" + Math.round(n).toLocaleString("en-GB");
const fmtM = (n) => "£" + (n / 1e6).toFixed(1) + "m";
const fmtN = (n) => Math.round(n).toLocaleString("en-GB");
const pct = (n) => Math.round(n * 100) + "%";
const RC = { green: "g", amber: "a", red: "r" };
const GLYPH = { green: "●", amber: "▲", red: "✕", g: "●", a: "▲", r: "✕" };

const NAV = [["home", "Home"], ["setup", "Setup"], ["levers", "Levers"], ["results", "Results"]];

export default function ResultsPage({ model, onNav = () => {} }) {
  const { value: base, pending } = useDeferred(model, computeBase);
  const [selected, setSelected] = useState(() => pickSelection(null, base));
  const sel = useMemo(() => pickSelection(selected, base), [selected, base]);
  const { detail, summary } = useMemo(() => computeDetail(base.cfg, sel), [base, sel]);
  const weeks = detail.weeks;
  const cfg = base.cfg;

  const [lens, setLens] = useState(0);
  const [week, setWeek] = useState(0); // 0-indexed shared cursor
  const [weight, setWeight] = useState(50);
  // Shared cursor setter: clamps to the horizon AND supports the functional
  // updater form (Flow's play uses setWeek(w => …)), so no lens can drive the
  // cursor out of range (was: NaN → weeks[NaN].totals crash on Play).
  const scrub = useCallback((w) => setWeek((prev) => {
    const next = typeof w === "function" ? w(prev) : w;
    return Math.max(0, Math.min(weeks.length - 1, Number.isFinite(next) ? next : prev));
  }), [weeks.length]);

  const stratName = base.strategies.find((s) => s.id === sel.sid)?.name || sel.sid;
  const grpName = base.groups.find((g) => g.id === sel.gid)?.name || sel.gid;

  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><div className="mark">C</div>
          <div><h1>{cfg.brands && cfg.brands[0] ? cfg.brands[0].name : "Simulation"}</h1><small>Capacity Simulator</small></div></div>
        <div className="tabs" role="tablist" aria-label="Sections">
          {NAV.map(([k, label]) => (
            <button key={k} role="tab" className={k === "results" ? "on" : ""} aria-selected={k === "results"} onClick={() => onNav(k)}>{label}</button>
          ))}
        </div>
      </header>

      <div className="ctx">
        <label>Strategy</label>
        <select value={sel.sid} onChange={(e) => setSelected({ gid: sel.gid, sid: e.target.value })}>
          {base.strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label>Scenario</label>
        <select value={sel.gid} onChange={(e) => setSelected({ gid: e.target.value, sid: sel.sid })}>
          {base.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button className="btn" disabled title="Saved runs are not available in this build yet">Save run</button>
        <span className={"fresh" + (pending ? " stale" : "")}>{pending ? "recalculating…" : "● Up to date"}</span>
      </div>

      <div className="sub" role="tablist" aria-label="Lenses">
        {["Summary", "Plan", "Intraday", "Data", "Flow"].map((l, i) => (
          <button key={l} role="tab" aria-selected={lens === i} className={lens === i ? "on" : ""} onClick={() => setLens(i)}>{l}</button>
        ))}
      </div>

      {lens === 0 && <Summary base={base} sel={sel} setSelected={setSelected} summary={summary} weeks={weeks} cfg={cfg} stratName={stratName} grpName={grpName} weight={weight} setWeight={setWeight} model={model} />}
      {lens === 1 && <Plan weeks={weeks} cfg={cfg} week={week} setWeek={scrub} />}
      {lens === 2 && <Intraday weeks={weeks} cfg={cfg} week={week} setWeek={scrub} />}
      {lens === 3 && <DataLens weeks={weeks} cfg={cfg} />}
      {lens === 4 && <Flow weeks={weeks} cfg={cfg} week={week} setWeek={scrub} />}

      <p className="note"><b>Design notes:</b> one context bar, five lenses, one week cursor · Summary = year (matrix + six family cards + risk register) · Plan sets the cursor · Intraday &amp; Flow inherit it · Data grouped by path, export = template · Flow animates cached weekly results — no re-simulation.</p>
    </div>
  );
}

// ---- SUMMARY -----------------------------------------------------------------
function Summary({ base, sel, setSelected, summary, weeks, cfg, stratName, grpName, weight, setWeight, model }) {
  const redOf = (gid, sid) => base.matrix.cells[gid][sid].redWeeks;
  const costOf = (gid, sid) => base.matrix.cells[gid][sid].allIn;
  const best = useMemo(() => bestUnderWeight(base, weight / 100), [base, weight]);

  // Six KPI-family headline numbers from the real run.
  const totalVol = weeks.reduce((a, w) => a + w.totals.volume, 0);
  const greenWeeks = weeks.reduce((a, w) => a + (cfg.queues.every((q) => w.queues[q.id].status === "green") ? 1 : 0), 0);
  const slaAtt = weeks.length ? greenWeeks / weeks.length : 1;
  let occN = 0, occD = 0;
  for (const w of weeks) for (const q of cfg.queues) { occN += w.queues[q.id].occ; occD++; }
  const avgOcc = occD ? occN / occD : 0;
  const lastWk = weeks[weeks.length - 1];
  const availFte = cfg.queues.reduce((a, q) => a + (lastWk.queues[q.id].active || 0), 0);
  const redQW = weeks.reduce((a, w) => a + cfg.queues.filter((q) => w.queues[q.id].status === "red").length, 0);
  const atRiskQW = weeks.reduce((a, w) => a + cfg.queues.filter((q) => w.queues[q.id].status === "amber").length, 0);
  const cards = [
    { key: "inputs", name: "Inputs", v: fmtN(totalVol), s: "contacts over horizon" },
    { key: "performance", name: "Performance", v: pct(slaAtt), s: slaAtt >= 0.95 ? "● on track" : "▲ watch" },
    { key: "efficiency", name: "Efficiency", v: pct(avgOcc), s: "avg occupancy" },
    { key: "workforce", name: "Workforce", v: fmtN(availFte) + " FTE", s: "active, final week" },
    { key: "customer", name: "Customer", v: fmtN(summary.lost), s: "customers lost" },
    { key: "outputs", name: "Outputs", v: fmtM(summary.allIn), s: (totalVol ? fmtGBP(summary.allIn / totalVol) : "£0") + " / contact" },
  ];

  return (<>
    <div className="panel">
      <h3>Decision matrix <small>tap a cell — the whole page reviews that mix · full editing in Levers</small></h3>
      <div className="weight">
        <label>Lowest cost</label>
        <input type="range" min="0" max="100" value={weight} onChange={(e) => setWeight(+e.target.value)} aria-label="cost versus service weighting" />
        <label>Best service</label>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="mx"><thead><tr><th className="rh" />{base.strategies.map((s) => <th key={s.id}>{s.name}</th>)}</tr></thead>
          <tbody>
            {base.groups.map((g) => (
              <tr key={g.id}><th className="rh">{g.name}</th>
                {base.strategies.map((s) => {
                  const isSel = sel.gid === g.id && sel.sid === s.id;
                  const red = redOf(g.id, s.id);
                  const flag = red === 0 ? "ok" : red <= 2 ? "warn" : "bad";
                  const isBest = best && best.gid === g.id && best.sid === s.id;
                  return (<td key={s.id}>
                    <button className={"cell" + (isSel ? " sel" : "")} onClick={() => setSelected({ gid: g.id, sid: s.id })} aria-label={`${g.name} × ${s.name}`}>
                      {isBest ? <span className="best">Best fit</span> : null}
                      <div className="c1 num">{fmtM(costOf(g.id, s.id))}</div>
                      <div className={"c3 " + flag}>{GLYPH[flag === "ok" ? "g" : flag === "warn" ? "a" : "r"]} {red} red</div>
                    </button></td>);
                })}
              </tr>
            ))}
          </tbody></table>
      </div>
      <p className="wklabel">Reviewing <b>{stratName} × {grpName}</b> — every lens on this page shows this mix.</p>
    </div>

    <div className="panel">
      <p className="verdict">Across {weeks.length} weeks, {cfg.queues.length} queues, <b>{weeks.length * cfg.queues.length - redQW - atRiskQW} queue-weeks meet SLA, {atRiskQW} at risk, {redQW} red</b> under {stratName} × {grpName}. All-in <b>{fmtM(summary.allIn)}</b>; {fmtGBP(summary.churnCost)} lost to poor experience ({fmtN(summary.lost)} customers).</p>
      <div className="fam6">
        {cards.map((c) => (
          <div className="fcard" style={{ borderLeftColor: FAMILY_COLORS[c.key] }} key={c.key}>
            <div className="fl" style={{ color: FAMILY_COLORS[c.key] }}>{c.name}</div>
            <div className="fv num">{c.v}</div><div className="fs">{c.s}</div>
          </div>
        ))}
      </div>
    </div>

    <RiskRegister summary={summary} cfg={cfg} model={model} />
  </>);
}

function RiskRegister({ summary, cfg, model }) {
  const [bu, setBu] = useState("all");
  const [ch, setCh] = useState("all");
  const bus = useMemo(() => (model.brands || []).flatMap((b) => b.businessUnits.map((x) => x.name)), [model]);
  const channels = useMemo(() => [...new Set((cfg.queues || []).map((q) => q.channel))], [cfg]);
  // Map each queue to the Business unit it sits under (via the v2 structure), so
  // the BU filter works against the engine's queue-named findings.
  const queueBu = useMemo(() => {
    const chBu = {};
    for (const b of model.brands || []) for (const bu of b.businessUnits || []) for (const p of bu.products || []) for (const c of p.channels || []) chBu[c.id] = bu.name;
    const map = {};
    for (const q of model.queues || []) map[q.name] = q.attachment && q.attachment.kind === "structural" ? (chBu[q.attachment.channelInstanceId] || null) : "Shared";
    return map;
  }, [model]);
  // Tag each finding with the queue it names, and that queue's BU + channel.
  const rows = useMemo(() => summary.findings.filter((f) => f.tone !== "green").map((f) => {
    const q = cfg.queues.find((qq) => f.text.includes(qq.name));
    return { tone: f.tone, text: f.text, channel: q ? q.channel : null, bu: q ? queueBu[q.name] : null };
  }), [summary, cfg, queueBu]);
  const shown = rows.filter((r) => (bu === "all" || r.bu === bu) && (ch === "all" || r.channel === ch));
  return (
    <div className="panel">
      <h3>Risk register <small>{shown.length} risk(s) shown · thresholds in Setup</small></h3>
      <div className="filters">
        <label>Business unit</label>
        <select value={bu} onChange={(e) => setBu(e.target.value)}><option value="all">All</option>{bus.map((n) => <option key={n}>{n}</option>)}</select>
        <label>Channel</label>
        <select value={ch} onChange={(e) => setCh(e.target.value)}><option value="all">All</option>{channels.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      </div>
      <table className="risk"><thead><tr><th>Risk</th><th>Severity</th></tr></thead>
        <tbody>
          {shown.length ? shown.map((r, i) => (
            <tr key={i}><td>{r.text}</td>
              <td><span className={"sev " + (r.tone === "red" ? "red" : "amb")}>{r.tone === "red" ? "✕ red" : "▲ amber"}</span></td></tr>
          )) : <tr><td colSpan={2} className="hint">No risks under this mix — every queue holds SLA.</td></tr>}
        </tbody></table>
    </div>
  );
}

// ---- PLAN --------------------------------------------------------------------
function Plan({ weeks, cfg, week, setWeek }) {
  const grouped = groupQueues(cfg);
  return (<>
    <div className="panel">
      <h3>RAG ribbon <small>tap a week — every lens follows it</small></h3>
      <div className="ribwrap">
        <table className="ribbon"><tbody>
          <tr><th aria-hidden="true" />{weeks.map((w, i) => <th key={i}>{(i === 0 || (i + 1) % 4 === 0) ? i + 1 : ""}</th>)}</tr>
          {grouped.map((grp) => (
            <Fragment key={grp.key}>
              <tr><td className="gh" colSpan={weeks.length + 1}>{grp.label}</td></tr>
              {grp.queues.map((q) => (
                <tr key={q.id}><th className="qh">{q.name}</th>
                  {weeks.map((w, i) => {
                    const st = RC[w.queues[q.id].status] || "g";
                    return <td key={i}><button className={"rc " + st + (i === week ? " cur" : "")} onClick={() => setWeek(i)} aria-label={`${q.name} week ${i + 1}`}>{GLYPH[st]}</button></td>;
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody></table>
      </div>
      <p className="wklabel">Selected: <b>week {week + 1}</b> — Intraday and Flow follow this cursor.</p>
    </div>
    <div className="panel">
      <h3>Required vs active FTE <small>total operation</small></h3>
      <FteChart weeks={weeks} cfg={cfg} week={week} />
    </div>
  </>);
}

function FteChart({ weeks, cfg, week }) {
  const req = weeks.map((w) => w.totals.reqFte);
  const act = weeks.map((w) => w.totals.active || w.totals.paid);
  const max = Math.max(1, ...req, ...act);
  const X = (i) => 12 + (i * 596) / Math.max(1, weeks.length - 1);
  const Y = (v) => 112 - (v / max) * 100;
  const line = (arr) => arr.map((v, i) => X(i) + "," + Y(v)).join(" ");
  const cx = X(week);
  return (
    <svg width="100%" viewBox="0 0 620 130" aria-label="Required versus active FTE across the horizon">
      <polyline fill="none" stroke={FAMILY_COLORS.workforce} strokeWidth="2" points={line(req)} />
      <polyline fill="none" stroke={FAMILY_COLORS.inputs} strokeWidth="2" points={line(act)} />
      <line x1={cx} x2={cx} y1="6" y2="112" stroke="#EF9F27" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="10" y="14" fontSize="10.5" fill={FAMILY_COLORS.workforce}>required</text>
      <text x="70" y="14" fontSize="10.5" fill={FAMILY_COLORS.inputs}>active</text>
      <text x="10" y="126" fontSize="10" fill="#8a887f">wk 1</text><text x="588" y="126" fontSize="10" fill="#8a887f">wk {weeks.length}</text>
    </svg>
  );
}

// ---- INTRADAY ----------------------------------------------------------------
function Intraday({ weeks, cfg, week, setWeek }) {
  const wk = weeks[week];
  const q0 = cfg.queues[0];
  const intr = wk && wk.intraday && wk.intraday.res && wk.intraday.res[q0.id];
  const byInt = intr && intr.byInterval ? intr.byInterval : [];
  const max = Math.max(1, ...byInt.map((b) => Math.max(b.req || 0, b.agents || 0)));
  return (
    <div className="panel">
      <span className="inherit">Week <b className="num">{week + 1}</b> · inherited from Plan
        <button onClick={() => setWeek(week - 1)} aria-label="previous week">−</button>
        <button onClick={() => setWeek(week + 1)} aria-label="next week">+</button></span>
      <h3>Required vs available agents <small>{q0.name} · first day of week {week + 1}</small></h3>
      <svg width="100%" viewBox="0 0 620 140" aria-label="Intraday required versus available agents">
        {byInt.map((b, i) => {
          const x = 12 + (i * 596) / Math.max(1, byInt.length);
          const wdt = Math.max(3, 596 / byInt.length / 2 - 1);
          const rH = ((b.req || 0) / max) * 110, aH = ((b.agents || 0) / max) * 110;
          return <g key={i}>
            <rect x={x} y={120 - rH} width={wdt} height={rH} fill="#F0997B" />
            <rect x={x + wdt + 1} y={120 - aH} width={wdt} height={aH} fill={FAMILY_COLORS.inputs} />
          </g>;
        })}
        <text x="12" y="136" fontSize="10" fill="#8a887f">required</text><text x="80" y="136" fontSize="10" fill={FAMILY_COLORS.inputs}>available</text>
      </svg>
      <p className="wklabel">{byInt.length ? `Week ${week + 1} · ${byInt.length} intervals` : "No intraday detail captured for this queue."}</p>
    </div>
  );
}

// ---- DATA --------------------------------------------------------------------
function DataLens({ weeks, cfg }) {
  const grouped = groupQueues(cfg);
  const csv = useCallback(() => {
    const head = ["Group", "Queue", "Week", "Volume", "AHT", "SLA", "Abandon", "ReqFTE", "Active", "RunCost", "ChurnCost"];
    const lines = [head.join(",")];
    for (const grp of grouped) for (const q of grp.queues) weeks.forEach((w, i) => {
      const s = w.queues[q.id];
      lines.push([grp.label, q.name, i + 1, Math.round(s.volume), Math.round(s.ahtInEffect), (s.sl * 100).toFixed(1), (s.abandon * 100).toFixed(1), s.reqFte.toFixed(1), (s.active || 0).toFixed(1), Math.round(s.cost), Math.round(s.churnCost)].join(","));
    });
    return lines.join("\n");
  }, [weeks, grouped]);
  const [csvOut, setCsvOut] = useState("");
  const q0 = cfg.queues[0];
  const someWeeks = [0, Math.floor(weeks.length / 2), weeks.length - 1];
  return (
    <div className="panel">
      <h3>Weekly data <small>grouped by path · columns by KPI family · export matches the template</small></h3>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <span className="sev" style={{ background: "var(--blue-tint)", color: "var(--blue-deep)" }}>Inputs</span>
        <span className="sev" style={{ background: "var(--teal-bg)", color: "var(--teal)" }}>Performance</span>
        <span className="sev" style={{ background: "var(--coral-bg)", color: "var(--coral)" }}>Workforce</span>
        <span className="sev" style={{ background: "var(--amber-bg)", color: "var(--amber-ink)" }}>Outputs</span>
        <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setCsvOut(csv())}>Export CSV</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="dtab">
          <thead><tr><th className="l">Week</th><th className="gInp">Volume</th><th className="gInp">AHT</th><th className="gPerf">SLA</th><th className="gPerf">Abandon</th><th className="gWf">Req FTE</th><th className="gWf">Active</th><th className="gOut">Run £</th><th className="gOut">Churn £</th></tr></thead>
          <tbody>
            {groupQueues(cfg).map((grp) => grp.queues.map((q) => (
              <Fragment key={q.id}>
                <tr className="grp"><td colSpan={9}>{grp.label} · {q.name}</td></tr>
                {someWeeks.map((i) => { const s = weeks[i].queues[q.id]; return (
                  <tr key={q.id + i}><td className="l num">{i + 1}</td><td className="num">{fmtN(s.volume)}</td><td className="num">{Math.round(s.ahtInEffect)} s</td>
                    <td className="num">{pct(s.sl)}</td><td className="num">{(s.abandon * 100).toFixed(1)}%</td>
                    <td className="num">{s.reqFte.toFixed(1)}</td><td className="num">{(s.active || 0).toFixed(1)}</td>
                    <td className="num">{fmtGBP(s.cost)}</td><td className="num">{fmtGBP(s.churnCost)}</td></tr>
                ); })}
              </Fragment>
            )))}
          </tbody>
        </table>
      </div>
      {csvOut ? <textarea readOnly className="num" data-testid="csv" style={{ width: "100%", height: 60, marginTop: 8, fontSize: 11 }} value={csvOut} /> : null}
    </div>
  );
}

// ---- FLOW --------------------------------------------------------------------
function Flow({ weeks, cfg, week, setWeek }) {
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => setWeek((w) => (w >= weeks.length - 1 ? 0 : w + 1)), 300);
    return () => clearInterval(timer.current);
  }, [playing, weeks.length, setWeek]);

  const wk = weeks[week];
  const vol = wk.totals.volume;
  const lost = cfg.queues.reduce((a, q) => a + (wk.queues[q.id].churnCustomers || 0), 0);
  const failPct = vol > 0 ? Math.min(0.5, lost / vol) : 0;
  const anyRed = cfg.queues.some((q) => wk.queues[q.id].status === "red");
  const anyAmb = cfg.queues.some((q) => wk.queues[q.id].status === "amber");
  const tint = anyRed ? "#F09595" : anyAmb ? "#FAC775" : "#E6F1FB";
  const H = 210, y0 = 30, resH = H * (1 - failPct), failH = Math.max(8, H * failPct);
  return (
    <div className="panel">
      <h3>Flow <small>the plan, played through the horizon</small></h3>
      <div className="flowctl">
        <button className="btn primary" onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
        <input type="range" min="1" max={weeks.length} value={week + 1} onChange={(e) => setWeek(+e.target.value - 1)} aria-label="week scrubber" />
        <span className="wk num">Week {week + 1}</span>
      </div>
      <svg width="100%" viewBox="0 0 640 300" aria-label="Volume flow for the selected week">
        <text x="60" y="18" textAnchor="middle" fontSize="10.5" fill="#8a887f">Brand</text>
        <text x="330" y="18" textAnchor="middle" fontSize="10.5" fill="#8a887f">Queues</text>
        <text x="590" y="18" textAnchor="middle" fontSize="10.5" fill="#8a887f">Outcome</text>
        <rect x="16" y={y0} width="88" height={H} rx="8" fill="#E6F1FB" stroke="#185FA5" />
        <text x="60" y={y0 + H / 2} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#0C447C">{fmtN(vol)}/day</text>
        <polygon points={`104,${y0} 250,${y0} 250,${y0 + H} 104,${y0 + H}`} fill={tint} fillOpacity="0.35" />
        <rect x="250" y={y0} width="160" height={H} rx="8" fill={tint} stroke="#185FA5" />
        <text x="330" y={y0 + H / 2} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0C447C">{cfg.queues.length} stations {anyRed ? "✕" : anyAmb ? "▲" : "●"}</text>
        <polygon points={`410,${y0} 540,${y0} 540,${y0 + resH} 410,${y0 + resH}`} fill="#1D9E75" fillOpacity="0.25" />
        <rect x="540" y={y0} width="84" height={resH} rx="8" fill="#E1F5EE" stroke="#0F6E56" />
        <text x="582" y={y0 + resH / 2} textAnchor="middle" fontSize="11" fontWeight="600" fill="#085041">Resolved {Math.round((1 - failPct) * 100)}%</text>
        <rect x="540" y={y0 + resH + 6} width="84" height={failH} rx="6" fill="#FAEEDA" stroke="#BA7517" />
        <text x="582" y={y0 + resH + 6 + failH / 2 + 3} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#633806">Failed {(failPct * 100).toFixed(1)}%</text>
      </svg>
      <p className="wklabel">Week {week + 1} — {anyRed ? "queues strained, failure widening." : anyAmb ? "volume climbing, tinting amber." : "flows within capacity."} Animated from cached results — no re-simulation.</p>
    </div>
  );
}

// ---- shared helpers ----------------------------------------------------------
function groupQueues(cfg) {
  // Group by brand › channel (v1 cfg queue shape), volume-agnostic order.
  const groups = new Map();
  for (const q of cfg.queues) {
    const brand = (cfg.brands || []).find((b) => b.id === q.brandId);
    const key = (q.brandId || "b") + "|" + q.channel;
    const label = `${brand ? brand.name : "Brand"} › ${q.channel}`;
    if (!groups.has(key)) groups.set(key, { key, label, queues: [] });
    groups.get(key).queues.push(q);
  }
  return [...groups.values()];
}

// Best cell under a cost↔service weighting (0 = all cost, 1 = all service).
function bestUnderWeight(base, w) {
  const cells = [];
  for (const g of base.groups) for (const s of base.strategies) {
    const c = base.matrix.cells[g.id][s.id];
    cells.push({ gid: g.id, sid: s.id, cost: c.allIn, svc: -c.redWeeks });
  }
  const costs = cells.map((c) => c.cost), svcs = cells.map((c) => c.svc);
  const cmin = Math.min(...costs), cmax = Math.max(...costs), smin = Math.min(...svcs), smax = Math.max(...svcs);
  let best = null, bestScore = -Infinity;
  for (const c of cells) {
    const cs = 1 - (c.cost - cmin) / (cmax - cmin || 1);
    const ss = (c.svc - smin) / (smax - smin || 1);
    const score = (1 - w) * cs + w * ss;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}
