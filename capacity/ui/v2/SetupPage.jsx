/* v2.4 rebuild — Setup page (Step 2). One page, four collapsible sections in
 * dependency order (Structure · Queues · Service catalog · Channel volume
 * profiles), each with a completion badge; the empty state IS the wizard. Queue
 * volume and Effective AHT are DERIVED (model/derive.js) and rendered read-only —
 * there is no queue-volume input anywhere. Matches setup-page-v3.html.
 */
import { useState, useMemo, useCallback } from "react";
import { CHANNELS } from "../../model/taxonomy.js";
import { FAMILY_COLORS } from "./tokens.js";
import * as Ops from "./model.js";

const fmt = (n) => (n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("en-GB"));
const fmt1 = (n) => (n == null || isNaN(n) ? "—" : (Math.round(n * 10) / 10).toLocaleString("en-GB"));

// A generic collapsible with controlled open state.
function useOpenSet(initial = []) {
  const [open, setOpen] = useState(() => new Set(initial));
  const toggle = useCallback((id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  return [open, toggle];
}

const NAV = [["home", "Home"], ["setup", "Setup"], ["levers", "Levers"], ["results", "Results"]];

export default function SetupPage({ model, onModelChange, onDownloadTemplate, onUploadTemplate, onNav = () => {} }) {
  const derived = useMemo(() => Ops.deriveModel(model), [model]);
  const [openSec, toggleSec] = useOpenSet(["s1"]);
  const [openBu, toggleBu] = useOpenSet(["bu_retail", "qg_ci_cards_voice", "qg_ci_cards_digital", "qg_shared"]);
  const [openCard, toggleCard] = useOpenSet(["pf_cards_voice"]);
  const [drawerQ, setDrawerQ] = useState(null);

  const set = onModelChange;

  // ---- completion badges ----
  const struct = useMemo(() => {
    let bus = 0, prods = 0, chans = 0;
    for (const b of model.brands) for (const bu of b.businessUnits) { bus++; for (const p of bu.products) { prods++; chans += p.channels.length; } }
    return { bus, prods, chans };
  }, [model]);
  const sharedCount = model.queues.filter((q) => q.attachment && q.attachment.kind === "shared").length;
  const mixSums = useMemo(() => model.profiles.map((p) => (p.mix || []).reduce((a, m) => a + (+m.pct || 0), 0)), [model]);
  const allMix100 = mixSums.every((s) => Math.abs(s - 100) < 1e-6);

  const crossByProfile = useMemo(() => {
    const map = {};
    for (const w of derived.validation.warnings) if (w.kind === "cross_structure") (map[w.profileId] = map[w.profileId] || []).push(w);
    return map;
  }, [derived]);

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <div className="mark">C</div>
          <div><h1>{model.brands[0] ? model.brands[0].name : "Simulation"}</h1><small>Capacity Simulator</small></div>
        </div>
        <div className="tabs" role="tablist" aria-label="Sections">
          {NAV.map(([k, label]) => (
            <button key={k} role="tab" className={k === "setup" ? "on" : ""} aria-selected={k === "setup"} onClick={() => onNav(k)}>{label}</button>
          ))}
        </div>
      </header>

      <h2>Setup</h2>
      <p className="lede">Four sections, in order — each unlocks the next. A new simulation is this page, empty, with Structure open.</p>

      {/* 1 STRUCTURE */}
      <Section id="s1" n="1" title="Structure" sub="Brand › business unit › product › channel"
        badge={`${struct.bus} BUs · ${struct.prods} products · ${struct.chans} channels`} openSet={openSec} toggle={toggleSec}>
        {model.brands.map((b) => b.businessUnits.map((bu) => (
          <div className={"bu" + (openBu.has(bu.id) ? " open" : "")} key={bu.id}>
            <button className="buhead" onClick={() => toggleBu(bu.id)}>
              <b>{bu.name}</b>
              <span className="sum">{bu.products.length} products · {bu.products.reduce((a, p) => a + p.channels.length, 0)} channels</span>
              <span className="chev">▼</span>
            </button>
            <div className="bubody">
              {bu.products.map((p) => (
                <div className="prod" key={p.id}>
                  <b>{p.name}</b>
                  {CHANNELS.map((ch) => {
                    const on = p.channels.some((c) => c.channel === ch);
                    return (
                      <button key={ch} className={"chip" + (on ? " on-toggle" : " off")} onClick={() => set(Ops.toggleChannel(model, p.id, ch))}
                        aria-pressed={on} aria-label={(on ? "Remove " : "Add ") + Ops.CHANNEL_LABELS[ch]}>
                        {on ? Ops.CHANNEL_LABELS[ch] : "+ " + Ops.CHANNEL_LABELS[ch]}
                      </button>
                    );
                  })}
                </div>
              ))}
              <button className="btn sm" onClick={() => set(Ops.addProduct(model, bu.id))}>+ Product</button>
            </div>
          </div>
        )))}
        <button className="btn sm" onClick={() => set(Ops.addBusinessUnit(model, model.brands[0].id))}>+ Business unit</button>
        <p className="hint" style={{ marginTop: 8 }}>Tap a dashed chip to switch a channel on for that product. Channels come from the taxonomy: Voice, Third party, Digital, Customer management.</p>
      </Section>

      {/* 2 QUEUES */}
      <Section id="s2" n="2" title="Queues" sub="Stations — attached to a structure path, or shared"
        badge={`${model.queues.length - sharedCount} stations · ${sharedCount} shared`} openSet={openSec} toggle={toggleSec}>
        {groupQueues(model).map((grp) => (
          <div className={"bu" + (openBu.has(grp.key) ? " open" : "")} key={grp.key}>
            <button className="buhead" onClick={() => toggleBu(grp.key)}>
              {grp.shared ? <><span className="chip shared">shared</span> <b style={{ fontSize: "12.5px" }}>Serves any structure</b></>
                : <span className="path">{grp.label}</span>}
              <span className="sum">{grp.queues.length} queue{grp.queues.length === 1 ? "" : "s"}</span>
              <span className="chev">▼</span>
            </button>
            <div className="bubody">
              {grp.queues.map((q) => {
                const d = derived.queues[q.id] || { volume: 0, effectiveAht: q.fallbackAhtSec, ahtMarker: "queue" };
                return (
                  <button className="qline" key={q.id} onClick={() => setDrawerQ(q.id)} aria-label={"Edit " + q.name}>
                    <b>{q.name}</b>
                    <span className="tax" style={{ fontSize: "9.5px" }}>{Ops.QTYPE_LABELS[q.type]}</span>
                    {q._modified ? <span className="moddot" aria-label="modified" /> : null}
                    {grp.shared ? <span className="chip shared">shared</span> : null}
                    <span className="qstats">
                      <span className="num"><span className="lab">vol/day</span>{fmt(d.volume)}</span>
                      <span className="num"><span className="lab">eff. AHT</span>{fmt(d.effectiveAht)} s{d.ahtMarker === "weighted" ? " · weighted" : d.ahtMarker === "svc" ? " · svc" : ""}</span>
                    </span>
                  </button>
                );
              })}
              {grp.shared ? <p className="hint" style={{ marginTop: 6 }}>Shared queues can appear in any service's journey; their cost is allocated back to feeding structures by handling minutes.</p> : null}
            </div>
          </div>
        ))}
        <AddQueue model={model} onAdd={(spec) => { set(Ops.addQueue(model, spec)); }} />
      </Section>

      {/* 3 SERVICE CATALOG */}
      <Section id="s3" n="3" title="Service catalog" sub="Define once, use in any profile"
        badge={`${model.services.length} services · ${model.services.filter((s) => s.journey.length).length} journeys`} openSet={openSec} toggle={toggleSec}>
        {model.services.map((s) => {
          const usedIn = model.profiles.filter((p) => (p.mix || []).some((m) => m.serviceId === s.id)).length;
          return (
            <div className={"card" + (openCard.has(s.id) ? " open" : "")} key={s.id}>
              <button className="cardhead" onClick={() => toggleCard(s.id)}>
                <b>{s.name}</b>
                <span className="tax">{Ops.ACTIVITY_LABELS[s.activity]}</span>
                <span className="tax">{s.productRequest === "new" ? "New product" : "Existing product"}</span>
                <span className="hint" style={{ marginLeft: "auto" }}>used in {usedIn} profile{usedIn === 1 ? "" : "s"}</span>
                <span className="chev">▼</span>
              </button>
              <div className="cardbody">
                <div className="fields">
                  <div className="field"><label>Name</label><input value={s.name} onChange={(e) => set(Ops.updateService(model, s.id, { name: e.target.value }))} /></div>
                  <div className="field"><label>Activity</label>
                    <select value={s.activity} onChange={(e) => set(Ops.updateService(model, s.id, { activity: e.target.value }))}>
                      {Ops.ACTIVITIES.map((a) => <option key={a} value={a}>{Ops.ACTIVITY_LABELS[a]}</option>)}
                    </select></div>
                  <div className="field"><label>Product request</label>
                    <select value={s.productRequest} onChange={(e) => set(Ops.updateService(model, s.id, { productRequest: e.target.value }))}>
                      <option value="existing">Existing product</option><option value="new">New product</option>
                    </select></div>
                  <div className="field"><label>Service AHT (s) — optional</label>
                    <input className="num" placeholder="— uses queue AHT" value={s.ahtSec != null ? s.ahtSec : ""}
                      onChange={(e) => set(Ops.updateService(model, s.id, { ahtSec: e.target.value === "" ? undefined : +e.target.value }))} /></div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <span className="hint">Journey — each step routes a % of this service's volume to a queue:</span>
                  {s.journey.length === 0 ? <p className="hint" style={{ marginTop: 4 }}>No steps yet. Add the first queue this service is handled at.</p> : null}
                  {s.journey.map((step, i) => {
                    const q = model.queues.find((x) => x.id === step.queueId);
                    const gov = q && q.type === "governance";
                    return (
                      <div className="mixrow" key={i}>
                        <span className="jarr" style={{ minWidth: 14 }}>{i + 1}.</span>
                        <select value={step.queueId} onChange={(e) => set(Ops.updateJourneyStep(model, s.id, i, { queueId: e.target.value }))} aria-label={`step ${i + 1} queue`}>
                          {model.queues.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                        </select>
                        <span className="hint">split</span>
                        <input className="num" value={step.splitPct} onChange={(e) => set(Ops.updateJourneyStep(model, s.id, i, { splitPct: +e.target.value || 0 }))} aria-label={`step ${i + 1} split percent`} />
                        <span className="hint">%</span>
                        {gov ? <>
                          <span className="hint">sample</span>
                          <input className="num" value={step.samplingPct != null ? step.samplingPct : ""} placeholder="—" onChange={(e) => set(Ops.updateJourneyStep(model, s.id, i, { samplingPct: e.target.value === "" ? undefined : +e.target.value }))} aria-label={`step ${i + 1} sampling percent`} />
                          <span className="hint">%</span>
                        </> : null}
                        <button className="btn sm" onClick={() => set(Ops.removeJourneyStep(model, s.id, i))} aria-label={`remove step ${i + 1}`}>✕</button>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button className="btn sm" onClick={() => set(Ops.addJourneyStep(model, s.id))}>+ Step</button>
                    <DeleteControl kind="service" guard={Ops.canDeleteService(model, s.id)} label="Delete service"
                      blockedNoun="profile mix" onDelete={() => set(Ops.deleteService(model, s.id))} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <button className="btn sm" onClick={() => set(Ops.addService(model))}>+ Add service</button>
      </Section>

      {/* 4 CHANNEL VOLUME PROFILES */}
      <Section id="s4" n="4" title="Channel volume profiles" sub="Total volume at a channel (or higher node), split by service mix %"
        badge={<>{model.profiles.length} profiles · {allMix100 ? "100% mix" : "mix incomplete"}</>} badgeTodo={!allMix100} openSet={openSec} toggle={toggleSec}>
        {model.profiles.map((p, pi) => {
          const sum = mixSums[pi];
          const ok100 = Math.abs(sum - 100) < 1e-6;
          const perDay = p.totalVolume;
          const crossWarn = crossByProfile[p.id] || [];
          return (
            <div className={"card" + (openCard.has(p.id) ? " open" : "")} key={p.id}>
              <button className="cardhead" onClick={() => toggleCard(p.id)}>
                <span className="path">{Ops.nodeLabel(model, p.appliesAt.nodeId)}</span>
                <b className="num">{fmt(perDay)} / day</b>
                <span className={"badge" + (ok100 ? "" : " todo")} style={{ marginLeft: "auto" }}>{ok100 ? "● 100%" : "▲ " + fmt1(sum) + "%"}</span>
                <span className="chev">▼</span>
              </button>
              <div className="cardbody">
                <div className="fields" style={{ marginBottom: 8 }}>
                  <div className="field"><label>Applies at</label>
                    <select value={p.appliesAt.nodeId} onChange={(e) => {
                      const node = Ops.structureNodes(model).find((n) => n.id === e.target.value);
                      set(Ops.updateProfileNode(model, p.id, node.level, node.id));
                    }}>
                      {Ops.structureNodes(model).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                    </select></div>
                  <div className="field"><label>Total volume / day</label>
                    <input className="num" value={p.totalVolume} onChange={(e) => set(Ops.updateProfile(model, p.id, { totalVolume: +e.target.value || 0 }))} /></div>
                </div>
                {(p.mix || []).map((m, mi) => (
                  <div className="mixrow" key={mi}>
                    <select value={m.serviceId} onChange={(e) => set(Ops.updateMixRow(model, p.id, mi, { serviceId: e.target.value }))}>
                      {model.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input className="num" value={m.pct} onChange={(e) => set(Ops.updateMixRow(model, p.id, mi, { pct: +e.target.value || 0 }))} />
                    <span className="hint">%</span>
                    <button className="btn sm" onClick={() => set(Ops.removeMixRow(model, p.id, mi))} aria-label="Remove mix row">✕</button>
                  </div>
                ))}
                <div className={"mixsum" + (ok100 ? "" : " warn")}><span>Mix total</span><span className="num">{ok100 ? "● 100%" : "▲ " + fmt1(sum) + "%"}</span></div>
                <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => set(Ops.addMixRow(model, p.id))}>+ Add service to mix</button></div>
                {crossWarn.map((w, wi) => (
                  <p className="warnmsg" key={wi}>▲ {w.message} Fine for shared queues; structural targets outside this path are flagged.</p>
                ))}
                {!ok100 && sum < 100 ? <p className="warnmsg">▲ Mix sums to {fmt1(sum)}% — {fmt1(100 - sum)}% of volume is unmodelled.</p> : null}
              </div>
            </div>
          );
        })}
        <button className="btn sm" onClick={() => set(Ops.addProfile(model))}>+ Add profile</button>
        <p className="hint" style={{ marginTop: 8 }}>Precedence: the deepest node wins — channel over product over BU. Under 100% flags the remainder as unmodelled.</p>
      </Section>

      <div className="importbox">
        <p><b>Load from the template.</b> Sheets mirror these sections — Structure, Queues, Services, Volume profiles. Download comes pre-filled; re-upload validates before anything changes.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn sm" onClick={() => onDownloadTemplate && onDownloadTemplate(model)}>Download template</button>
          <button className="btn sm primary" onClick={() => onUploadTemplate && onUploadTemplate()}>Upload data</button>
        </div>
      </div>

      <StaffingDrawer model={model} derived={derived} queueId={drawerQ} onClose={() => setDrawerQ(null)} set={set} />
    </div>
  );
}

function Section({ id, n, title, sub, badge, badgeTodo, openSet, toggle, children }) {
  const open = openSet.has(id);
  return (
    <div className={"sec" + (open ? " open" : "")}>
      <button className="sechead" onClick={() => toggle(id)} aria-expanded={open}>
        <span className="secnum">{n}</span>
        <span><b>{title}</b><small>{sub}</small></span>
        <span className={"badge" + (badgeTodo ? " todo" : "")}>{badge}</span><span className="chev">▼</span>
      </button>
      <div className="secbody">{children}</div>
    </div>
  );
}

// Group queues by structure path (channel instance) + one shared group.
function groupQueues(model) {
  const nodes = new Map();
  for (const b of model.brands) for (const bu of b.businessUnits) for (const p of bu.products) for (const ch of p.channels)
    nodes.set(ch.id, `${bu.name} › ${p.name} › ${Ops.CHANNEL_LABELS[ch.channel]}`);
  const groups = new Map();
  for (const q of model.queues) {
    if (q.attachment && q.attachment.kind === "structural") {
      const key = "qg_" + q.attachment.channelInstanceId;
      if (!groups.has(key)) groups.set(key, { key, label: nodes.get(q.attachment.channelInstanceId) || "—", queues: [] });
      groups.get(key).queues.push(q);
    }
  }
  const out = [...groups.values()];
  const shared = model.queues.filter((q) => q.attachment && q.attachment.kind === "shared");
  if (shared.length) out.push({ key: "qg_shared", shared: true, queues: shared });
  return out;
}

// Six KPI-family accordions; derived volume read-only, physics editable.
function StaffingDrawer({ model, derived, queueId, onClose, set }) {
  const [open, toggle] = useOpenSet(["a_inputs"]);
  const q = model.queues.find((x) => x.id === queueId);
  const d = q ? derived.queues[q.id] : null;
  const stf = (q && q.staffing) || {};
  const grpLabel = q ? drawerPath(model, q) : "";
  const upd = (patch) => set(Ops.updateQueueStaffing(model, q.id, patch));
  const fams = [
    { id: "a_inputs", key: "inputs", name: "Inputs", sum: q ? `${fmt(d.volume)}/day derived · fallback AHT ${q.fallbackAhtSec} s` : "", fields: (
      <div className="fields">
        <div className="field"><label>Derived volume/day</label><input value={q ? fmt(d.volume) + " (from profiles)" : ""} disabled style={{ background: "var(--canvas)", color: "var(--ink-3)" }} /></div>
        <div className="field"><label>Fallback AHT (s)</label><input className="num" value={q ? q.fallbackAhtSec : ""} onChange={(e) => set(Ops.updateQueue(model, q.id, { fallbackAhtSec: +e.target.value || 0 }))} /></div>
      </div>) },
    { id: "a_perf", key: "performance", name: "Performance", sum: `ASA ${stf.asaTarget || 30} s · abandon < ${Math.round((stf.maxAbandon || 0.05) * 100)}%`, fields: (
      <div className="fields">
        <div className="field"><label>ASA target (s)</label><input className="num" value={stf.asaTarget ?? 30} onChange={(e) => upd({ asaTarget: +e.target.value || 0 })} /></div>
        <div className="field"><label>Max abandon (%)</label><input className="num" value={Math.round((stf.maxAbandon ?? 0.05) * 100)} onChange={(e) => upd({ maxAbandon: (+e.target.value || 0) / 100 })} /></div>
      </div>) },
    { id: "a_eff", key: "efficiency", name: "Efficiency", sum: `Occupancy ≤ ${Math.round((stf.occupancyCeiling || 0.85) * 100)}%`, fields: (
      <div className="fields"><div className="field"><label>Occupancy ceiling (%)</label><input className="num" value={Math.round((stf.occupancyCeiling ?? 0.85) * 100)} onChange={(e) => upd({ occupancyCeiling: (+e.target.value || 0) / 100 })} /></div></div>) },
    { id: "a_wf", key: "workforce", name: "Workforce", sum: `${stf.resourcing || "dedicated"} · attrition ${stf.attritionPct || 26}%/yr`, fields: (
      <div className="fields">
        <div className="field" style={{ gridColumn: "1/-1" }}><label>Resourcing model</label>
          <select value={stf.resourcing || "dedicated"} onChange={(e) => upd({ resourcing: e.target.value })}>
            <option value="dedicated">Dedicated — own headcount</option><option value="leveraged">Leveraged — shared pool</option><option value="overflow_only">Overflow only — spill-served</option>
          </select></div>
        <div className="field"><label>Attrition (%/yr)</label><input className="num" value={stf.attritionPct ?? 26} onChange={(e) => upd({ attritionPct: +e.target.value || 0 })} /></div>
        <div className="field"><label>Shrinkage (%)</label><input className="num" value={Math.round((stf.shrinkage ?? 0.3) * 100)} onChange={(e) => upd({ shrinkage: (+e.target.value || 0) / 100 })} /></div>
      </div>) },
    { id: "a_cust", key: "customer", name: "Customer", sum: `Churn £${stf.churnCost || 500} · failed→churn ${stf.failedToChurnPct || 6}%`, fields: (
      <div className="fields">
        <div className="field"><label>Churn cost (£)</label><input className="num" value={stf.churnCost ?? 500} onChange={(e) => upd({ churnCost: +e.target.value || 0 })} /></div>
        <div className="field"><label>Failed → churn (%)</label><input className="num" value={stf.failedToChurnPct ?? 6} onChange={(e) => upd({ failedToChurnPct: +e.target.value || 0 })} /></div>
      </div>) },
    { id: "a_out", key: "outputs", name: "Outputs", sum: `Agent £${fmt(stf.agentCost || 32000)}/yr`, fields: (
      <div className="fields"><div className="field"><label>Agent cost (£/yr)</label><input className="num" value={stf.agentCost ?? 32000} onChange={(e) => upd({ agentCost: +e.target.value || 0 })} /></div></div>) },
  ];
  return (
    <>
      <div className={"scrim" + (q ? " on" : "")} onClick={onClose} />
      <aside className={"drawer" + (q ? " on" : "")} aria-label="Edit queue" aria-hidden={!q}>
        {q ? <>
          <div className="dhead">
            <div><h3>{q.name}</h3><p>{grpLabel} · {Ops.QTYPE_LABELS[q.type]}</p></div>
            <button className="close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="dbody">
            {fams.map((f) => (
              <div className={"acc" + (open.has(f.id) ? " open" : "")} key={f.id}>
                <button className="acchead" onClick={() => toggle(f.id)}>
                  <span className="fam" style={{ background: FAMILY_COLORS[f.key] }} />
                  <span><b>{f.name}</b><small>{f.sum}</small></span>
                  <span className="chev" style={{ marginLeft: "auto" }}>▼</span>
                </button>
                <div className="accbody">{f.fields}</div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center", flexWrap: "wrap", borderTop: "0.5px solid var(--line)", paddingTop: 12 }}>
              <DeleteControl kind="queue" guard={Ops.canDeleteQueue(model, q.id)} label="Delete queue" blockedNoun="service journey"
                onDelete={() => { set(Ops.deleteQueue(model, q.id)); onClose(); }} />
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn sm" onClick={() => set(Ops.resetQueueStaffing(model, q.id))}>Reset to defaults</button>
                <button className="btn sm primary" onClick={onClose}>Done</button>
              </div>
            </div>
          </div>
        </> : null}
      </aside>
    </>
  );
}

// Add-queue chooser: name, type, and where it attaches — a structure path or
// shared — per the mockup's "attach to a structure path, or mark shared".
function AddQueue({ model, onAdd }) {
  const channels = Ops.structureNodes(model).filter((n) => n.level === "channel");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("inbound_call");
  const [attach, setAttach] = useState("shared");
  const submit = () => {
    const attachment = attach === "shared" ? { kind: "shared" } : { kind: "structural", channelInstanceId: attach };
    onAdd({ attachment, type, name: name.trim() || undefined });
    setName(""); setType("inbound_call"); setAttach("shared"); setOpen(false);
  };
  if (!open) return (
    <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button className="btn sm" onClick={() => setOpen(true)}>+ Add queue</button>
      <span className="hint">Attach to a structure path, or mark <b>shared</b>. Volume &amp; Eff. AHT are derived; tap a row for staffing physics.</span>
    </div>
  );
  return (
    <div style={{ marginTop: 10, border: "0.5px solid var(--blue-line)", borderRadius: 10, padding: 12, background: "var(--blue-tint)" }}>
      <div className="fields">
        <div className="field"><label>Name</label><input value={name} placeholder="New queue" onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {Ops.QUEUE_TYPES.map((t) => <option key={t} value={t}>{Ops.QTYPE_LABELS[t]}</option>)}
          </select></div>
        <div className="field"><label>Attaches to</label>
          <select value={attach} onChange={(e) => setAttach(e.target.value)}>
            <option value="shared">Shared — serves any structure</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
        <button className="btn sm" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn sm primary" onClick={submit}>Add queue</button>
      </div>
    </div>
  );
}

// Delete action with the referential-integrity guard surfaced: a live button
// when safe, an amber explanation naming the blockers when not.
function DeleteControl({ guard, label, blockedNoun, onDelete }) {
  if (guard.ok) return <button className="btn sm" style={{ color: "var(--red-ink)", borderColor: "#F0B4B4" }} onClick={onDelete}>{label}</button>;
  const n = guard.blockedBy.length;
  return <span className="hint" style={{ color: "var(--amber-ink)" }}>▲ {label} blocked — referenced by {n} {blockedNoun}{n === 1 ? "" : "s"}. Remove {n === 1 ? "it" : "them"} first.</span>;
}

function drawerPath(model, q) {
  if (!q.attachment || q.attachment.kind === "shared") return "Shared · serves any structure";
  for (const b of model.brands) for (const bu of b.businessUnits) for (const p of bu.products) for (const ch of p.channels)
    if (ch.id === q.attachment.channelInstanceId) return `${bu.name} › ${p.name} › ${Ops.CHANNEL_LABELS[ch.channel]}`;
  return "—";
}
