import { useState } from "react";
import { Card } from "./primitives.jsx";
import { channelOfQueue } from "../views.js";
import { num } from "../format.js";

/* §24 dependency view. A Graph | Table toggle over the queue topology:
   nodes are queues (coloured by channel, badged dedicated/leveraged/unmanned),
   edges are shares-with (§24.2), leveraged support and converts-to-calls
   (§24.1) links. Tapping a node reveals the simulated flows — hours moved in,
   converted volume out — for the selected week. The table renders the same
   links as a from → to matrix. */

const CH_COLOR = { voice: "#0e7c86", digital: "#5a54c9", support: "#b0602a" };
const EDGE_STYLE = {
  share: { stroke: "#1f9d55", label: "shares with" },
  leverage: { stroke: "#d98a0b", label: "leverages to" },
  convert: { stroke: "#c0417a", label: "converts to" },
  support: { stroke: "#3a7bd5", label: "supports" },
};

function buildEdges(cfg) {
  const has = (id) => cfg.queues.some((q) => q.id === id);
  const edges = [];
  for (const q of cfg.queues) {
    const sh = q.sharing && Array.isArray(q.sharing.sharesWith) ? q.sharing.sharesWith : [];
    for (const t of sh) if (has(t)) edges.push({ from: q.id, to: t, type: "share" });
    if (q.resourcing === "leveraged" && q.leverage) {
      const tg = q.leverage.targets;
      const list = tg === "priority-above" ? [] : (Array.isArray(tg) ? tg : tg ? [tg] : []);
      for (const t of list) if (has(t)) edges.push({ from: q.id, to: t, type: "leverage" });
    }
    const ct = q.knock && q.knock.convertTarget;
    if (ct && has(ct)) edges.push({ from: q.id, to: ct, type: "convert" });
    for (const s of q.supports || []) if (has(s.queueId)) edges.push({ from: q.id, to: s.queueId, type: "support" });
  }
  return edges;
}

// Node inflows/outflows for one week, from the simulated weekly record.
function nodeFlows(sim, qid, w) {
  const wk = sim.weeks[Math.min(w, sim.weeks.length - 1)];
  const s = wk ? wk.queues[qid] : null;
  if (!s) return null;
  return {
    sharedIn: s.poolIn || 0, leveragedIn: s.leveragedIn || 0, supportIn: s.flexIn || 0,
    convertedOut: s.deflected || 0, redialOut: s.redial || 0,
  };
}

function Graph({ cfg, sim, edges, selected, onSelect, week }) {
  const qs = cfg.queues;
  const n = qs.length;
  const W = 640, H = Math.max(300, 120 + n * 8), cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 70;
  const pos = {};
  qs.forEach((q, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    pos[q.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const badge = (q) => (q.resourcing === "unmanned" ? "U" : q.resourcing === "leveraged" ? "L" : "D");
  return (
    <div className="tbl-wrap" style={{ border: 0 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%", height: "auto" }} data-testid="dep-graph" role="img" aria-label="Queue dependency graph">
        <defs>
          {Object.entries(EDGE_STYLE).map(([k, v]) => (
            <marker key={k} id={"arrow-" + k} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={v.stroke} />
            </marker>
          ))}
        </defs>
        {edges.map((e, i) => {
          const a = pos[e.from], b = pos[e.to];
          if (!a || !b) return null;
          const st = EDGE_STYLE[e.type];
          const hot = selected && (e.from === selected || e.to === selected);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={st.stroke} strokeWidth={hot ? 2.5 : 1.2} strokeOpacity={selected && !hot ? 0.15 : 0.7} markerEnd={"url(#arrow-" + e.type + ")"} />;
        })}
        {qs.map((q) => {
          const p = pos[q.id];
          const sel = selected === q.id;
          return (
            <g key={q.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: "pointer" }} onClick={() => onSelect(sel ? null : q.id)} data-testid={"dep-node-" + q.id}>
              <circle r={sel ? 16 : 13} fill={CH_COLOR[channelOfQueue(q)] || "#5c6b7a"} stroke={sel ? "#0f1720" : "#fff"} strokeWidth={sel ? 3 : 1.5} />
              <text textAnchor="middle" dy="4" fontSize="11" fontWeight="700" fill="#fff">{badge(q)}</text>
              <text textAnchor="middle" y={26} fontSize="10" fill="#1b2733">{q.name.length > 16 ? q.name.slice(0, 15) + "…" : q.name}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FlowsPanel({ cfg, sim, selected, week }) {
  if (!selected) return <p className="note" data-testid="dep-flows-empty">Tap a node to see its simulated flows for the selected week.</p>;
  const q = cfg.queues.find((x) => x.id === selected);
  const f = nodeFlows(sim, selected, week);
  if (!q || !f) return <p className="note">No simulated data for this queue.</p>;
  const row = (l, v, unit) => <div className="kpi"><div className="l">{l}</div><div className="v">{num(v, 0)}<small> {unit}</small></div></div>;
  return (
    <div className="qcard" data-testid="dep-flows" style={{ marginTop: 12 }}>
      <div className="qn"><span>{q.name}</span><span className="spacer" /><span className="qtype">week {Math.min(week, sim.weeks.length - 1) + 1}</span></div>
      <div className="kpis">
        {row("Shared in", f.sharedIn, "h")}
        {row("Leveraged in", f.leveragedIn, "h")}
        {row("Support in", f.supportIn, "h")}
        {row("Converted out", f.convertedOut, "vol")}
        {row("Repeat/redial", f.redialOut, "vol")}
      </div>
    </div>
  );
}

function LinkTable({ cfg, edges }) {
  const qn = (id) => (cfg.queues.find((q) => q.id === id) || { name: id }).name;
  return (
    <div className="tbl-wrap">
      <table className="data" data-testid="dep-table">
        <thead><tr><th>From</th><th>Link</th><th>To</th></tr></thead>
        <tbody>
          {edges.map((e, i) => (
            <tr key={i}>
              <td style={{ textAlign: "left" }}>{qn(e.from)}</td>
              <td><span className="pill" style={{ color: EDGE_STYLE[e.type].stroke, borderColor: EDGE_STYLE[e.type].stroke }}>{EDGE_STYLE[e.type].label}</span></td>
              <td style={{ textAlign: "left" }}>{qn(e.to)}</td>
            </tr>
          ))}
          {edges.length === 0 && <tr><td colSpan={3} className="empty">No dependency links yet. Add sharing, leverage or converts-to-calls on a queue below.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function DependencyView({ config, sim }) {
  const [view, setView] = useState("graph");
  const [selected, setSelected] = useState(null);
  const [week, setWeek] = useState(0);
  const edges = buildEdges(config);
  const maxWk = sim ? sim.weeks.length : 1;
  return (
    <Card
      title="Dependencies"
      sub="how capacity and contacts move between queues"
      hint="Nodes are queues (colour = channel, letter = D dedicated / L leveraged / U unmanned). Edges are sharing, leverage and converts-to-calls links. Tap a node to see the simulated flows for the chosen week."
      right={
        <div className="btnbar">
          <button type="button" className={"btn sm" + (view === "graph" ? " primary" : "")} onClick={() => setView("graph")} data-testid="dep-view-graph" aria-pressed={view === "graph"}>Graph</button>
          <button type="button" className={"btn sm" + (view === "table" ? " primary" : "")} onClick={() => setView("table")} data-testid="dep-view-table" aria-pressed={view === "table"}>Table</button>
        </div>
      }
    >
      {view === "graph" ? (
        <>
          <div className="rowflex" style={{ marginBottom: 8 }}>
            <label className="field" style={{ maxWidth: 260 }}>
              <span className="lab">Week {Math.min(week, maxWk - 1) + 1}</span>
              <input type="range" min={0} max={Math.max(0, maxWk - 1)} value={Math.min(week, maxWk - 1)} onChange={(e) => setWeek(Number(e.target.value))} data-testid="dep-week" aria-label="Selected week" />
            </label>
            <div className="legend" style={{ flexWrap: "wrap" }}>
              {Object.entries(EDGE_STYLE).map(([k, v]) => <span key={k} className="legend-item"><span className="sw" style={{ background: v.stroke }} />{v.label}</span>)}
            </div>
          </div>
          {sim ? <Graph cfg={config} sim={sim} edges={edges} selected={selected} onSelect={setSelected} week={week} /> : <p className="note">Recalculating…</p>}
          {sim && <FlowsPanel cfg={config} sim={sim} selected={selected} week={week} />}
        </>
      ) : (
        <LinkTable cfg={config} edges={edges} />
      )}
    </Card>
  );
}
