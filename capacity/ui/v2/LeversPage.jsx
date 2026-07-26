/* v2.4 rebuild — Levers page (Step 4). The decision matrix flanked by strategy
 * and scenario-group cards, hiring caps at the foot. Built to levers-page-v2.html.
 * The matrix is the SAME computeBase() Results consumes — one source of truth,
 * two surfaces (Levers edits; Results reviews). Editing a lever (buffer %, look-
 * ahead months, hiring caps) mutates the carried engineConfig and re-scores the
 * matrix live — every cell is a real engine run.
 */
import { useState, useMemo, Fragment } from "react";
import { computeBase } from "./compute.js";
import * as Ops from "./model.js";

const fmtM = (n) => "£" + (n / 1e6).toFixed(1) + "m";
const pct = (n) => Math.round(n * 100) + "%";
const GLYPH = { ok: "●", warn: "▲", bad: "✕" };

export default function LeversPage({ model: initialModel }) {
  const [model, setModel] = useState(initialModel);
  const base = useMemo(() => computeBase(model), [model]);
  const [weight, setWeight] = useState(50);
  const [sel, setSel] = useState(null);
  const best = useMemo(() => bestUnderWeight(base, weight / 100), [base, weight]);
  const cfg = base.cfg;
  const set = (m) => setModel(m);

  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><div className="mark">C</div>
          <div><h1>{cfg.brands && cfg.brands[0] ? cfg.brands[0].name : "Simulation"}</h1><small>Capacity Simulator</small></div></div>
        <div className="tabs" role="tablist" aria-label="Sections">
          <button role="tab">Home</button><button role="tab">Setup</button>
          <button role="tab" className="on" aria-selected="true">Levers</button><button role="tab">Results</button>
        </div>
      </header>

      <h2 style={{ marginBottom: 14 }}>Levers</h2>

      <div className="panel">
        <h3>Decision matrix <small>every scenario group × every strategy</small></h3>
        <div className="weight">
          <label>Lowest cost</label>
          <input type="range" min="0" max="100" value={weight} onChange={(e) => setWeight(+e.target.value)} aria-label="cost versus service weighting" />
          <label>Best service</label>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="mx"><thead><tr><th className="rh" aria-hidden="true" />{base.strategies.map((s) => <th key={s.id}>{s.name}</th>)}</tr></thead>
            <tbody>
              {base.groups.map((g) => (
                <tr key={g.id}><th className="rh">{g.name}</th>
                  {base.strategies.map((s) => {
                    const c = base.matrix.cells[g.id][s.id];
                    const flag = c.redWeeks === 0 ? "ok" : c.redWeeks <= 2 ? "warn" : "bad";
                    const isSel = sel && sel.gid === g.id && sel.sid === s.id;
                    const isBest = best && best.gid === g.id && best.sid === s.id;
                    return (<td key={s.id}>
                      <button className={"cell" + (isSel ? " sel" : "")} onClick={() => setSel({ gid: g.id, sid: s.id })} aria-label={`${g.name} × ${s.name}`}>
                        {isBest ? <span className="best">Best fit</span> : null}
                        <div className="c1 num">{fmtM(c.allIn)}</div>
                        <div className="c2 num">{pct(c.sla)} SLA</div>
                        <div className={"c3 " + flag}>{GLYPH[flag]} {c.redWeeks} red wk</div>
                      </button></td>);
                  })}
                </tr>
              ))}
            </tbody></table>
        </div>
        <p className="mxnote">Tap a cell to make that pair the live context on every tab. Badge = best fit under your weighting.
          {sel ? <> Selected: <b>{base.strategies.find((s) => s.id === sel.sid).name} × {base.groups.find((g) => g.id === sel.gid).name}</b>.</> : null}</p>
      </div>

      <div className="cols">
        <div className="panel">
          <h3>Strategies <small>what we could do</small></h3>
          <div className="cardlist">
            {base.strategies.map((s) => <StrategyCard key={s.id} s={s} cfg={cfg} model={model} set={set} />)}
          </div>
        </div>

        <div className="panel">
          <h3>Scenario groups <small>what could happen</small></h3>
          <div className="cardlist">
            {base.groups.map((g) => <GroupCard key={g.id} g={g} cfg={cfg} />)}
          </div>
        </div>
      </div>

      <HiringCaps cfg={cfg} model={model} set={set} />

      <p className="note"><b>Design notes:</b> strategies and scenarios flank the matrix they feed · each cell = cost (amber) + SLA (teal) + red weeks (glyph) · Best fit follows the cost↔service slider · cell tap sets live context · caps live here (a lever, not a setting).</p>
    </div>
  );
}

const BLURB = {
  meet: "Close the requirement gap at the landing week.",
  buffer: "Requirement × (1 + buffer).",
  backfill: "Replace projected leavers only — never hire for growth.",
  manual: "Your per-queue hires exactly as entered; ignores the cap.",
};

function StrategyCard({ s, cfg, model, set }) {
  const [open, setOpen] = useState(false);
  const buffer = Math.round((cfg.hiring.buffer || 0) * 100);
  const grouped = groupQueues(cfg);
  return (
    <div className={"scard" + (open ? " open" : "")}>
      <button className="schead" onClick={() => setOpen((o) => !o)}>
        <span><b>{s.name}</b> <span className="pill builtin">built-in</span><br />
          <span className="desc">{BLURB[s.baseType] || ""}</span></span>
        {s.baseType === "buffer" ? (
          <span className="param" onClick={(e) => e.stopPropagation()}>Buffer <input className="num" style={{ width: 52 }} value={buffer}
            onChange={(e) => set(Ops.setHiringBuffer(model, e.target.value))} aria-label="buffer percent" /> %</span>
        ) : s.baseType === "backfill" ? (
          <span className="param" onClick={(e) => e.stopPropagation()}>Look-ahead <input className="num" style={{ width: 46 }} value={s.forwardMonths || 3}
            onChange={(e) => set(Ops.setForwardMonths(model, s.id, e.target.value))} aria-label="look-ahead months" /> mo</span>
        ) : null}
        <span className="chev">▼</span>
      </button>
      <div className="scbody">
        {grouped.map((grp) => (
          <Fragment key={grp.key}>
            <div className="grph"><span className="path">{grp.label}</span></div>
            {grp.queues.map((q) => <div className="qtoggle" key={q.id}><span>{q.name}</span><b>included</b></div>)}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function GroupCard({ g, cfg }) {
  const [open, setOpen] = useState(false);
  const ids = groupScenarioIdsLocal(cfg, g.id);
  const factors = (cfg.scenarios || []).filter((s) => ids.includes(s.id));
  return (
    <div className={"scard" + (open ? " open" : "")}>
      <button className="schead" onClick={() => setOpen((o) => !o)}>
        <span><b>{g.name}</b> <span className="pill builtin">built-in</span> <span className="pill">{g.id === "g_none" ? "reference" : "all services"}</span><br />
          <span className="desc">{factors.length} factor{factors.length === 1 ? "" : "s"} in force</span></span>
        <span className="chev">▼</span>
      </button>
      <div className="scbody">
        {factors.length ? factors.map((f) => (
          <Fragment key={f.id}>
            <div className="grph">{f.name} · from week {(f.startWeek || 0) + 1}</div>
            <div className="tl">{Array.from({ length: 13 }, (_, i) => {
              const wk = i * 4;
              const on = wk >= (f.startWeek || 0);
              return <span key={i} className={on ? "on" : ""} />;
            })}</div>
          </Fragment>
        )) : <span>Empty by design — every delta is measured against this.</span>}
      </div>
    </div>
  );
}

function HiringCaps({ cfg, model, set }) {
  const brands = cfg.brands || [];
  const channels = [...new Set(cfg.queues.map((q) => q.channel))];
  const caps = (cfg.hiring.caps || {});
  const segVal = (bid, ch) => { const v = caps.segments ? caps.segments[bid + "|" + ch] : null; return v != null ? v : ""; };
  const total = caps.total != null ? caps.total : cfg.hiring.cap;
  return (
    <div className="panel">
      <h3>Hiring caps <small>brand × channel · effective limit = tightest of segment, brand and total</small></h3>
      <div style={{ overflowX: "auto" }}>
        <table className="caps">
          <thead><tr><th>Brand</th>{channels.map((ch) => <th key={ch} style={{ textTransform: "capitalize" }}>{ch}</th>)}</tr></thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id}><td><b>{b.name}</b></td>
                {channels.map((ch) => (
                  <td key={ch}><input className="num" value={segVal(b.id, ch)} placeholder="—"
                    onChange={(e) => set(Ops.setSegmentCap(model, b.id, ch, e.target.value))} aria-label={`${b.name} ${ch} cap`} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>Total ceiling <input className="num" style={{ width: 60 }} value={total}
        onChange={(e) => set(Ops.setTotalCap(model, e.target.value))} aria-label="total ceiling" /> / week across all segments.</p>
    </div>
  );
}

// ---- shared helpers ----------------------------------------------------------
function groupQueues(cfg) {
  const groups = new Map();
  for (const q of cfg.queues) {
    const brand = (cfg.brands || []).find((b) => b.id === q.brandId);
    const key = (q.brandId || "b") + "|" + q.channel;
    if (!groups.has(key)) groups.set(key, { key, label: `${brand ? brand.name : "Brand"} › ${q.channel}`, queues: [] });
    groups.get(key).queues.push(q);
  }
  return [...groups.values()];
}
function groupScenarioIdsLocal(cfg, gid) {
  const g = (cfg.groups || []).find((x) => x.id === gid);
  if (g && Array.isArray(g.scenarioIds)) return g.scenarioIds;
  return (cfg.scenarios || []).filter((s) => s.enabled).map((s) => s.id); // Plan of record
}
function bestUnderWeight(base, w) {
  const cells = [];
  for (const g of base.groups) for (const s of base.strategies) {
    const c = base.matrix.cells[g.id][s.id];
    cells.push({ gid: g.id, sid: s.id, cost: c.allIn, svc: c.sla - c.redWeeks * 0.01 });
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
