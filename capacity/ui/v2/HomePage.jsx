/* v2.4 rebuild — Home page (Step 5). Simulation cards with mini dependency-graph
 * thumbnails and KPI-family stat chips, the New-simulation fork modal, and the
 * full-screen Ecosystem volume Sankey (the hero of Home) rendered from the
 * derivation module. Built to home-page-v2.html.
 */
import { useState, useMemo, useEffect } from "react";
import { quickHeadline } from "./compute.js";
import { sankeyLayout } from "./ecosystem.js";

const fmtM = (n) => "£" + (n / 1e6).toFixed(1) + "m";
const fmtN = (n) => Math.round(n).toLocaleString("en-GB");
const RAG = { green: { cls: "ok", glyph: "●", label: "on track" }, amber: { cls: "warn", glyph: "▲", label: "at risk" }, red: { cls: "bad", glyph: "✕", label: "red risks" } };

export default function HomePage({ simulations, onOpen }) {
  const [modal, setModal] = useState(false);
  const [eco, setEco] = useState(null); // the sim whose ecosystem is open
  const [query, setQuery] = useState("");
  const shown = simulations.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
  const soon = "Not available in this build yet";
  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><div className="mark">C</div>
          <div><h1>Capacity Simulator</h1><small>Acme workspace</small></div></div>
        <div className="avatar" aria-label="Nick Morris">NM</div>
      </header>

      <div className="pagehead">
        <h2>Simulations</h2>
        <button className="btn primary" onClick={() => setModal(true)}>+ New simulation</button>
      </div>

      <div className="toolbar">
        <label className="search">⌕ <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search simulations" aria-label="Search simulations" style={{ border: "none", background: "none", font: "inherit", flex: 1, outline: "none", color: "var(--ink)" }} /></label>
        <button className="btn" onClick={() => setEco(simulations[0])}>Ecosystem</button>
        <button className="btn" disabled title={soon}>Compare</button>
        <button className="btn" disabled title={soon}>Presets</button>
      </div>

      <div className="grid">
        {shown.map((sim) => <SimCard key={sim.id} sim={sim} onEco={() => setEco(sim)} onOpen={onOpen} soon={soon} />)}
        {query && !shown.length ? <p className="hint" style={{ gridColumn: "1 / -1" }}>No simulations match “{query}”.</p> : null}
        <button className="newcard" onClick={() => setModal(true)}>
          <span className="plus">+</span>New simulation<small>Ecosystem, subset, or single service</small>
        </button>
      </div>

      <p className="note"><b>Design notes:</b> one primary action per view · destructive actions behind ⋯ with type-to-confirm · thumbnails show scope · status always colour + glyph (✕ ▲ ●) · chips use KPI-family colours · tabular numerals throughout.</p>

      {modal ? <ForkModal onClose={() => setModal(false)} onOpen={onOpen} /> : null}
      {eco ? <Ecosystem sim={eco} onClose={() => setEco(null)} onEditInSetup={() => { setEco(null); onOpen && onOpen(); }} /> : null}
    </div>
  );
}

function SimCard({ sim, onEco, onOpen, soon }) {
  const h = sim.headline;
  const rag = RAG[h.worst];
  return (
    <article className="card">
      <div className="head">
        <button className="thumb" onClick={onEco} aria-label={"Open ecosystem view for " + sim.name}>
          <Thumb model={sim.model} />
        </button>
        <div style={{ minWidth: 0 }}>
          <h3>{sim.name}</h3>
          <p className="meta">{sim.scope} · updated {sim.updated} · {sim.runs} runs</p>
        </div>
        <button className="dots" aria-label={"More actions for " + sim.name} disabled title={soon}>⋯</button>
      </div>
      <div className="chips">
        <span className="chip num">{h.horizon} wk</span>
        <span className="chip num">{sim.services} svc · {h.queues} queues</span>
        <span className="chip hc num">{fmtN(h.availFte)} FTE avail.</span>
        <span className="chip money num">{fmtM(h.allIn)} all-in</span>
        <span className={"chip " + rag.cls}>{rag.glyph} {h.worst === "green" ? "on track" : rag.label}</span>
      </div>
      <button className="btn open" onClick={onOpen}>Open</button>
    </article>
  );
}

// Mini dependency-graph thumbnail: queue nodes coloured by channel, all in scope.
function Thumb({ model }) {
  const nodes = (model.queues || []).slice(0, 6);
  const pts = [[20, 14], [56, 12], [14, 45], [46, 49], [66, 38], [38, 31]];
  return (
    <svg width="76" height="62" viewBox="0 0 76 62" aria-hidden="true">
      {nodes.map((q, i) => {
        const [cx, cy] = pts[i % pts.length];
        const voice = q.type === "inbound_call" || q.type === "outbound_call";
        return <circle key={q.id} cx={cx} cy={cy} r={i === 0 ? 7 : 6} fill={voice ? "#185FA5" : q.type === "governance" ? "#534AB7" : "#378ADD"} />;
      })}
    </svg>
  );
}

function ForkModal({ onClose, onOpen }) {
  const forks = [
    { t: "Whole ecosystem", d: "Every service, every journey, every queue." },
    { t: "Subset", d: "Pick services and their journey queues on a live map. Severed journeys are flagged." },
    { t: "Single service", d: "One service and its journey. Ready in under a minute." },
  ];
  const enter = () => { onClose(); onOpen && onOpen(); };
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="forktitle">
        <h3 id="forktitle">New simulation</h3>
        <p>Choose the scope — it opens in Setup, where you can refine everything.</p>
        <div className="forks">
          {forks.map((f) => (
            <button className="fork" key={f.t} onClick={enter}>
              <span><span className="t">{f.t}</span><br /><span className="d">{f.d}</span></span>
            </button>
          ))}
        </div>
        <div className="foot">
          <button className="link" disabled title="Not available in this build yet" style={{ opacity: 0.5, cursor: "not-allowed" }}>Start from a template</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// Full-screen Ecosystem view: the proportional volume Sankey from derive().
function Ecosystem({ sim, onClose, onEditInSetup }) {
  const layout = useMemo(() => sankeyLayout(sim.model, { failedPct: sim.headline.allIn && sim.headline ? failedFrac(sim) : 0.02 }), [sim]);
  const fill = (cls) => cls === "gov" ? "#7F77DD" : cls === "res" ? "#1D9E75" : cls === "fail" ? "#EF9F27" : "#378ADD";
  const nodeFill = (col, n) => col.key === "outcome" ? (n.id === "failed" ? "#FAEEDA" : "#E1F5EE")
    : col.key === "service" ? "#fff" : n.gov ? "#EEEDFE" : "#E6F1FB";
  const nodeStroke = (col, n) => col.key === "outcome" ? (n.id === "failed" ? "#BA7517" : "#0F6E56") : n.gov ? "#534AB7" : "#185FA5";
  return (
    <div className="eco-scrim on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="eco" role="dialog" aria-modal="true" aria-labelledby="ecotitle">
        <h3 id="ecotitle">Ecosystem — {layout.brandName}</h3>
        <p className="sub">Volume flow · brand → channel → service mix → journey queues → outcome · view only, edit in Setup</p>
        <div style={{ overflowX: "auto" }}>
          <svg width="100%" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-label="Ecosystem volume flow" style={{ minWidth: 560 }}>
            {layout.columns.map((col) => (
              <text key={col.key} x={col.x + layout.colw / 2} y="16" textAnchor="middle" fontSize="10.5" fill="#8a887f">{col.label}</text>
            ))}
            {layout.links.map((lk, i) => <polygon key={i} points={lk.points} fill={fill(lk.cls)} fillOpacity={lk.cls === "fail" ? "0.5" : "0.28"} />)}
            {layout.columns.map((col) => col.nodes.map((n) => (
              <g key={n.id}>
                <rect x={col.x} y={n.y} width={layout.colw} height={n.h} rx="7" fill={nodeFill(col, n)} stroke={nodeStroke(col, n)} />
                <text x={col.x + layout.colw / 2} y={n.y + n.h / 2 + 3} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#0C447C">
                  {clip(n.label)}{col.key === "outcome" ? " " + Math.round((n.value / layout.totalQ) * 100) + "%" : ""}
                </text>
              </g>
            )))}
          </svg>
        </div>
        <p className="ecohint" style={{ marginTop: 6 }}>Channel volume profiles split by service mix %; journeys route it onward. Governance stations (purple) sample a % of cases. <b>Queue volumes are derived, never entered.</b></p>
        <div className="legend">
          <span className="lg pool">ribbon = volume share</span><span className="lg sup">green = resolved</span><span className="lg ovf">amber = failed</span>
        </div>
        <div className="ecofoot">
          <span className="ecohint">Flows shown for the current plan; scrub weeks in Results › Flow.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onEditInSetup}>Edit in Setup</button>
            <button className="btn primary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const clip = (s) => (s && s.length > 16 ? s.slice(0, 15) + "…" : s);
function failedFrac(sim) {
  // A modest failed share for the one-plan view: horizon customers lost over a
  // rough contact base. Bounded; the animated per-week detail lives in Results.
  const h = sim.headline;
  const est = h.lost && h.queues ? Math.min(0.12, h.lost / Math.max(1, h.horizon * 5000 * h.queues)) : 0.02;
  return est;
}
