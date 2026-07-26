/* v2.4 rebuild — Ecosystem Sankey layout (Step 5). PURE. Turns a v2 model into a
 * proportional volume flow (brand → channel → service mix → journey queues →
 * outcome) straight from the derivation module — queue volumes are DERIVED, never
 * entered, and the picture proves it. Returns positioned nodes + ribbon polygons
 * the Home/Ecosystem view renders as SVG. Built to home-page-v2.html's overlay.
 */
import { indexStructure, deriveServiceVolumes, deriveQueueWorkload } from "../../model/derive.js";

const COLW = 96, GAPX = 40, H = 250, TOP = 28, GAPY = 6;

// Stack a column's nodes to fill H, scaled by total value; returns y/h per node.
function stack(nodes, total) {
  const gaps = GAPY * Math.max(0, nodes.length - 1);
  const scale = total > 0 ? (H - gaps) / total : 0;
  let y = TOP;
  for (const n of nodes) { n.h = Math.max(3, n.value * scale); n.y = y; y += n.h + GAPY; }
  return scale;
}

// A ribbon polygon from a source slice (x2,ys..ys+w) to a target slice.
function ribbon(x1, ys, x2, yt, wSrc, wTgt) {
  return `${x1},${ys} ${x2},${yt} ${x2},${yt + wTgt} ${x1},${ys + wSrc}`;
}

export function sankeyLayout(model, opts = {}) {
  const struct = indexStructure(model);
  const sv = deriveServiceVolumes(model, struct);
  const qd = deriveQueueWorkload(model, { struct, serviceVolumes: sv });
  const failedPct = Math.max(0, Math.min(0.6, opts.failedPct || 0));

  const brandName = (model.brands && model.brands[0] && model.brands[0].name) || "Brand";

  // Services with volume + their primary feeding channel.
  const chLabel = { voice: "Voice", third_party: "Third party", digital: "Digital", customer_management: "Customer mgmt" };
  const services = [];
  for (const s of model.services || []) {
    const rec = sv.get(s.id); const vol = rec ? rec.volume : 0;
    if (vol <= 0) continue;
    const src = (rec.sources || []).filter((x) => !x.superseded && x.volume > 0).sort((a, b) => b.volume - a.volume)[0];
    const node = src ? struct.nodes.get(src.nodeId) : null;
    const chKey = node && node.level === "channel" ? node.name : "mixed";
    services.push({ id: s.id, name: s.name, value: vol, channel: chKey, journey: s.journey || [] });
  }
  const total = services.reduce((a, s) => a + s.value, 0) || 1;

  // Channel column.
  const chMap = new Map();
  for (const s of services) chMap.set(s.channel, (chMap.get(s.channel) || 0) + s.value);
  const channels = [...chMap.entries()].map(([k, v]) => ({ id: "ch_" + k, label: chLabel[k] || k, value: v }));

  // Queue column (derived volumes).
  const queues = (model.queues || []).map((q) => {
    const d = qd.get(q.id) || { volume: 0 };
    return { id: q.id, name: q.name, type: q.type, value: d.volume, shared: q.attachment && q.attachment.kind === "shared" };
  }).filter((q) => q.value > 0).sort((a, b) => b.value - a.value);
  const totalQ = queues.reduce((a, q) => a + q.value, 0) || 1;

  // Outcome column.
  const resolved = { id: "resolved", label: "Resolved", value: totalQ * (1 - failedPct) };
  const failed = { id: "failed", label: "Failed", value: Math.max(totalQ * failedPct, totalQ * 0.001) };

  // Positions.
  const X = (col) => 16 + col * (COLW + GAPX);
  const brand = [{ id: "brand", label: brandName, value: total }];
  stack(brand, total); stack(channels, total); stack(services, total);
  const qScale = stack(queues, totalQ); stack([resolved, failed], totalQ);

  const nodeX = { brand: X(0), channel: X(1), service: X(2), queue: X(3), outcome: X(4) };

  // Links with ribbon polygons. Cursors track stacked offsets on each side.
  const links = [];
  const cur = {};
  const push = (fromNode, fromX, toNode, toX, value, colScaleFrom, colScaleTo, cls) => {
    const wFrom = value * colScaleFrom, wTo = value * colScaleTo;
    const ysKey = "s" + fromNode.id, ytKey = "t" + toNode.id;
    const ys = (cur[ysKey] = (cur[ysKey] ?? fromNode.y)); cur[ysKey] += wFrom;
    const yt = (cur[ytKey] = (cur[ytKey] ?? toNode.y)); cur[ytKey] += wTo;
    links.push({ points: ribbon(fromX + COLW, ys, toX, yt, wFrom, wTo), cls });
  };
  const scaleTotal = (H - GAPY * Math.max(0, services.length - 1)) / total; // shared for brand/channel/service
  const scaleQ = qScale;
  // brand → channel
  for (const c of channels) push(brand[0], nodeX.brand, c, nodeX.channel, c.value, scaleTotal, scaleTotal, "vol");
  // channel → service
  for (const s of services) { const c = channels.find((x) => x.id === "ch_" + s.channel); if (c) push(c, nodeX.channel, s, nodeX.service, s.value, scaleTotal, scaleTotal, "vol"); }
  // service → queue (per journey step)
  const qById = new Map(queues.map((q) => [q.id, q]));
  for (const s of services) for (const step of s.journey) {
    const q = qById.get(step.queueId); if (!q) continue;
    const split = (step.splitPct != null ? step.splitPct : 100) / 100;
    const sampling = (step.samplingPct != null ? step.samplingPct : 100) / 100;
    const v = s.value * split * sampling;
    push(s, nodeX.service, q, nodeX.queue, v, scaleTotal, scaleQ, q.type === "governance" ? "gov" : "vol");
  }
  // queue → outcome
  for (const q of queues) {
    push(q, nodeX.queue, resolved, nodeX.outcome, q.value * (1 - failedPct), scaleQ, scaleQ, "res");
    push(q, nodeX.queue, failed, nodeX.outcome, q.value * failedPct, scaleQ, scaleQ, "fail");
  }

  return {
    brandName, total, totalQ, failedPct,
    width: X(4) + COLW + 16, height: H + TOP + 20,
    columns: [
      { key: "brand", x: nodeX.brand, label: "Brand", nodes: brand },
      { key: "channel", x: nodeX.channel, label: "Channel", nodes: channels },
      { key: "service", x: nodeX.service, label: "Service mix", nodes: services.map((s) => ({ id: s.id, label: s.name, value: s.value, y: s.y, h: s.h })) },
      { key: "queue", x: nodeX.queue, label: "Journey queues", nodes: queues.map((q) => ({ id: q.id, label: q.name, value: q.value, y: q.y, h: q.h, gov: q.type === "governance", shared: q.shared })) },
      { key: "outcome", x: nodeX.outcome, label: "Outcome", nodes: [resolved, failed] },
    ],
    links, colw: COLW,
  };
}
