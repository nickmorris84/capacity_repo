import { useState } from "react";
import { NumField, TextField, SelectField, Hint } from "../components/primitives.jsx";
import { FilesCard } from "../components/FilesCard.jsx";
import { clamp } from "../../engine/engine.js";

const CHANNELS = [{ key: "voice", label: "Voice" }, { key: "digital", label: "Digital" }, { key: "support", label: "Support" }];
const KIND_LABEL = { voice: "Voice · Erlang", digitalCustomer: "Digital Customer · live", digitalWorkflow: "Digital Workflow · backlog", serviceWorkflow: "Service Workflow · support" };

/* §26.4 collapsible full-width section. All collapsed by default except the
   first (Start); each is an independent disclosure. */
function Sec({ title, sub, hint, open, testid, children }) {
  return (
    <details className="set-sec" open={open || undefined} data-testid={testid}>
      <summary>
        <span className="chev" aria-hidden="true">▸</span>
        <span className="set-sec-t">{title}</span>
        {sub ? <span className="sub">{sub}</span> : null}
        {hint ? <Hint text={hint} /> : null}
      </summary>
      <div className="set-b">{children}</div>
    </details>
  );
}

function ChannelTemplateFields({ d, ops }) {
  const t = d.template || {};
  const T = (path, v) => ops.patchChannelDef(d.id, ["template", ...path], v);
  return (
    <div className="fieldrow">
      {d.kind === "voice" && (
        <>
          <NumField label="ASA target" unit="s" value={t.asaTarget} onChange={(v) => T(["asaTarget"], v)} id={"chdef-" + d.id + "-asa"} />
          <NumField label="Max abandon" unit="%" value={+((t.maxAbandon || 0) * 100).toFixed(1)} onChange={(v) => T(["maxAbandon"], v / 100)} />
          <NumField label="Patience" unit="s" value={t.patience} onChange={(v) => T(["patience"], v)} />
        </>
      )}
      {d.kind === "digitalCustomer" && (
        <>
          <NumField label="Concurrency" value={t.concurrency} onChange={(v) => T(["concurrency"], v)} id={"chdef-" + d.id + "-concurrency"} />
          <NumField label="SLA within" unit="min" value={t.digitalSlaMinutes} onChange={(v) => T(["digitalSlaMinutes"], v)} id={"chdef-" + d.id + "-slamins"} />
          <NumField label="SLA target" unit="%" value={+((t.digitalSlaPct || 0) * 100).toFixed(0)} onChange={(v) => T(["digitalSlaPct"], v / 100)} />
        </>
      )}
      {d.kind === "digitalWorkflow" && (
        <>
          <NumField label="SLA within" unit="h" value={t.workflowSlaHours} onChange={(v) => T(["workflowSlaHours"], v)} id={"chdef-" + d.id + "-slahours"} />
          <NumField label="SLA target" unit="%" value={+((t.workflowSlaPct || 0) * 100).toFixed(0)} onChange={(v) => T(["workflowSlaPct"], v / 100)} />
        </>
      )}
      {d.kind === "serviceWorkflow" && (
        <>
          <NumField label="SLA within" unit="days" value={Math.round((t.workflowSlaHours || 0) / 24)} onChange={(v) => T(["workflowSlaHours"], (v || 0) * 24)} id={"chdef-" + d.id + "-sladays"} />
          <NumField label="SLA target" unit="%" value={+((t.workflowSlaPct || 0) * 100).toFixed(0)} onChange={(v) => T(["workflowSlaPct"], v / 100)} />
        </>
      )}
    </div>
  );
}

function ChannelsManager({ config, ops, channelPresets }) {
  const [name, setName] = useState("");
  const lib = channelPresets && channelPresets.length ? channelPresets : [];
  const [presetId, setPresetId] = useState(lib[0] ? lib[0].id : "");
  const chosen = lib.find((p) => p.id === presetId) || lib[0];
  return (
    <>
      <div className="rowflex" style={{ marginBottom: 10 }}>
        <input type="text" className="inp" style={{ maxWidth: 200 }} placeholder="new channel name" value={name} onChange={(e) => setName(e.target.value)} data-testid="channel-name" />
        <div style={{ minWidth: 210 }}>
          <SelectField label="From global channel preset" value={presetId} onChange={setPresetId} options={lib.map((p) => ({ value: p.id, label: p.name }))} id="channel-preset" />
        </div>
        <button type="button" className="btn sm primary" style={{ alignSelf: "flex-end" }} onClick={() => { ops.addChannel(name.trim() || undefined, chosen); setName(""); }} data-testid="add-channel">+ Add channel</button>
      </div>
      <p className="note" style={{ marginBottom: 10 }}>Channel presets are created and edited on the landing under Global presets. Adding a channel copies the chosen preset — later preset edits don't touch it.</p>
      <div className="rows">
        {(config.channelDefs || []).map((d) => {
          const count = (config.queues || []).filter((q) => q.channelId === d.id).length;
          return (
            <div className="erow" key={d.id} data-testid={"chdef-" + d.id}>
              <div className="erow-h">
                <input type="text" className="inp" style={{ maxWidth: 200 }} value={d.name} aria-label="Channel name" onChange={(e) => ops.patchChannelDef(d.id, ["name"], e.target.value)} />
                <span className="pill">{KIND_LABEL[d.kind] || d.kind}</span>
                <span className="pill">{d.group}</span>
                <span className="pill">{count} queue(s)</span>
                <span className="spacer" />
                <button type="button" className="btn sm danger" onClick={() => ops.deleteChannelDef(d.id)} data-testid={"chdef-del-" + d.id}>Delete</button>
              </div>
              <div className="erow-b"><ChannelTemplateFields d={d} ops={ops} /></div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function BrandsManager({ config, ops }) {
  return (
    <>
      <div className="rowflex" style={{ marginBottom: 10 }}>
        <button type="button" className="btn sm primary" onClick={() => ops.addBrand()} data-testid="add-brand">+ Add brand</button>
        <span className="note" style={{ padding: "6px 10px" }}>A queue's channel and digital subtype are chosen per queue on the Queues tab.</span>
      </div>
      <div className="rows">
        {(config.brands || []).map((b) => (
          <div className="erow" key={b.id}>
            <div className="erow-h">
              <input type="text" className="inp" style={{ maxWidth: 220 }} value={b.name} aria-label="Brand name" onChange={(e) => ops.patchBrand(b.id, ["name"], e.target.value)} />
              <span className="pill">{(config.queues || []).filter((q) => q.brandId === b.id).length} queue(s)</span>
              <span className="spacer" />
              <label className="switch"><input type="checkbox" checked={!!b.training} onChange={(e) => ops.toggleBrandTraining(b.id, e.target.checked)} /><span className="track" aria-hidden="true" /><span style={{ fontSize: 11 }}>Training profile</span></label>
              {(config.brands || []).length > 1 && <button type="button" className="btn sm danger" onClick={() => ops.deleteBrand(b.id)}>Delete</button>}
            </div>
            {b.training && (
              <div className="erow-b">
                <div className="fieldrow">
                  <NumField label="Training weeks" value={b.training.trainingWeeks} onChange={(v) => ops.patchBrand(b.id, ["training", "trainingWeeks"], v)} />
                  <NumField label="Training shrinkage" unit="%" value={+((b.training.trainingShrinkagePct || 0) * 100).toFixed(1)} onChange={(v) => ops.patchBrand(b.id, ["training", "trainingShrinkagePct"], v / 100)} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function CapsMatrix({ config, ops }) {
  const caps = config.hiring.caps || { segments: {}, brands: {}, total: config.hiring.cap };
  const brands = config.brands || [];
  const segVal = (bid, ch) => { const v = (caps.segments || {})[bid + "|" + ch]; return v == null ? "" : v; };
  return (
    <>
      <div className="tbl-wrap">
        <table className="data" data-testid="caps-matrix">
          <thead><tr><th>Brand</th>{CHANNELS.map((c) => <th key={c.key}>{c.label}</th>)}<th>Brand ceiling</th></tr></thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id}>
                <td style={{ textAlign: "left", fontWeight: 600 }}>{b.name}</td>
                {CHANNELS.map((c) => (
                  <td key={c.key}>
                    <input type="number" className="inp" style={{ width: 72 }} value={segVal(b.id, c.key)} placeholder="∞"
                      data-testid={"cap-" + b.id + "-" + c.key}
                      onChange={(e) => ops.patchCapSegment(b.id, c.key, e.target.value === "" ? null : Number(e.target.value))} aria-label={b.name + " " + c.label + " cap"} />
                  </td>
                ))}
                <td>
                  <input type="number" className="inp" style={{ width: 72 }} value={(caps.brands || {})[b.id] == null ? "" : (caps.brands || {})[b.id]} placeholder="∞"
                    data-testid={"cap-brand-" + b.id}
                    onChange={(e) => ops.patchCapBrand(b.id, e.target.value === "" ? null : Number(e.target.value))} aria-label={b.name + " ceiling"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rowflex" style={{ marginTop: 10 }}>
        <NumField label="Total ceiling" unit="/wk" id="cap-total" value={caps.total == null ? "" : caps.total} onChange={(v) => ops.patchCapTotal(v)} hint="The operation-wide weekly cap across all segments. Blank = no total ceiling." />
        <span className="note" style={{ padding: "6px 10px" }}>Effective limit for a segment = the tightest of its segment cap, its brand ceiling and the total ceiling.</span>
      </div>
    </>
  );
}

/* Simulation Settings (§26.4) — full-width collapsible sections, all collapsed
   by default except Start. The preset libraries and the Files card remain
   reachable here until the Session-B landing libraries take over. */
export function SettingsEditor({ config, ops, channelPresets, sim, sims, activeStrategy, activeGroupId, onImportConfig }) {
  const eng = config.engine, hir = config.hiring, costs = config.costs, cx = config.cx, loops = config.loops;
  const set = config.settings || {};
  const cal = set.calendar || {};
  const ot = set.ot || {}, tr = set.training || {}, debt = set.trainingDebt || {}, kn = set.knockOn || {}, risk = set.risk || {};
  const P = (path, v) => ops.patch(path, v);
  const S = (path, v) => ops.patch(["settings", ...path], v);
  const band = (fam, key, testid) => (
    <div className="rowflex" style={{ gap: 8 }}>
      <span style={{ minWidth: 150, fontSize: 12, fontWeight: 600 }}>{key}</span>
      <div style={{ width: 96 }}><NumField label="Amber" value={(risk[fam] || {}).amber} onChange={(v) => S(["risk", fam, "amber"], v)} id={testid + "-amber"} /></div>
      <div style={{ width: 96 }}><NumField label="Red" value={(risk[fam] || {}).red} onChange={(v) => S(["risk", fam, "red"], v)} id={testid + "-red"} /></div>
    </div>
  );

  return (
    <div className="set-secs" data-testid="settings-sections">
      <Sec title="Start" open testid="settings-sec-start"
        hint="Where this simulation starts from: the shared starting headcount pool and the calendar date week 1 lands on.">
        <div className="fieldrow" style={{ maxWidth: 560 }}>
          <label className="field" style={{ maxWidth: 240 }}>
            <span className="lab">Global starting HC <Hint text="Queues left blank share this pool, weighted by workload (volume × AHT ÷ concurrency). Explicit per-queue HC wins; unmanned queues are excluded." /></span>
            <input type="number" value={eng.globalStartingHC == null ? "" : eng.globalStartingHC} placeholder="(none — blanks resolve to 0)"
              onChange={(e) => P(["engine", "globalStartingHC"], e.target.value === "" ? null : Number(e.target.value))} data-testid="global-hc" />
          </label>
          <label className="field" style={{ maxWidth: 220 }}>
            <span className="lab">Week-1 date <Hint text="The calendar date week 1 of the horizon starts on. Anchors the seasonality wizard and month-granular scenarios to real months. Blank = start from January." /></span>
            <input type="date" value={cal.weekOneDate || ""} onChange={(e) => ops.setWeekOneDate(e.target.value || null)} data-testid="week-one-date" />
          </label>
        </div>
      </Sec>

      <Sec title="Simulation window & currency" testid="settings-sec-window">
        <div className="fieldrow">
          <NumField id="horizon-input" label="Simulation window" unit="wk" value={eng.horizonWeeks} min={24} max={78}
            onChange={(v) => P(["engine", "horizonWeeks"], clamp(Math.round(v || 52), 24, 78))}
            hint="Weekly horizon, clamped to [24, 78]. 24 floors it because the 10-week hire-to-productive pipeline plus ramp needs room to matter; default 52." />
          <NumField label="Occupancy ceiling" unit="%" value={+(eng.occupancyCeiling * 100).toFixed(0)} onChange={(v) => P(["engine", "occupancyCeiling"], v / 100)} />
          <TextField label="Currency" value={eng.currency} onChange={(v) => P(["engine", "currency"], v || "£")} />
        </div>
        <div className="fieldrow">
          <NumField label="Day start" unit="h" value={eng.dayStart} onChange={(v) => P(["engine", "dayStart"], v)} />
          <NumField label="Day end" unit="h" value={eng.dayEnd} onChange={(v) => P(["engine", "dayEnd"], v)} />
          <NumField label="Interval" unit="min" value={eng.intervalMin} onChange={(v) => P(["engine", "intervalMin"], v)} />
          <NumField label="Support prof." unit="%" value={+(eng.crossSkillProficiency * 100).toFixed(0)} onChange={(v) => P(["engine", "crossSkillProficiency"], v / 100)} />
        </div>
      </Sec>

      <Sec title="Organisation & brands" testid="settings-sec-brands"
        hint="Create brands here (name only) and optional per-brand training profiles.">
        <BrandsManager config={config} ops={ops} />
      </Sec>

      <Sec title="Channels" testid="settings-sec-channels"
        hint="Create a channel from a global channel preset — its template carries the mechanics of that kind. Queues attach to a channel on the Queues tab and inherit its sections.">
        <ChannelsManager config={config} ops={ops} channelPresets={channelPresets} />
      </Sec>

      <Sec title="Hiring caps" sub="brand × channel matrix" testid="settings-sec-caps"
        hint="Requisitions per week allowed in each brand × channel segment (blank = unlimited), plus optional per-brand and total ceilings. When a ceiling binds, scarce hires are trimmed from the lowest marginal-churn grant first.">
        <CapsMatrix config={config} ops={ops} />
      </Sec>

      <Sec title="Workforce physics" sub="overtime · training · debt · burnout" testid="settings-sec-physics">
        <h4 className="set-h4">Overtime rules</h4>
        <div className="fieldrow">
          <NumField label="Max / agent / day" unit="h" value={ot.maxDailyHours} step="0.5" onChange={(v) => S(["ot", "maxDailyHours"], v)} />
          <NumField label="Weekly ceiling" unit="h" value={ot.weeklyCeiling} onChange={(v) => S(["ot", "weeklyCeiling"], v)} />
          <NumField label="Premium" unit="×" value={ot.premium} step="0.1" onChange={(v) => S(["ot", "premium"], v)} />
          <NumField label="Burnout load" value={ot.burnoutLoad} onChange={(v) => S(["ot", "burnoutLoad"], v)} />
        </div>
        <h4 className="set-h4">Training & debt</h4>
        <div className="fieldrow">
          <NumField label="Default training" unit="wk" value={tr.weeks} onChange={(v) => S(["training", "weeks"], v)} />
          <NumField label="Training shrinkage" unit="%" value={+((tr.shrinkagePct || 0) * 100).toFixed(1)} onChange={(v) => S(["training", "shrinkagePct"], v / 100)} />
        </div>
        <div className="fieldrow">
          <NumField label="Debt accrual" value={debt.accumRate} onChange={(v) => S(["trainingDebt", "accumRate"], v)} />
          <NumField label="Debt recovery" value={debt.recoveryRate} onChange={(v) => S(["trainingDebt", "recoveryRate"], v)} />
          <NumField label="Max AHT penalty" unit="%" value={+((debt.maxAhtPenalty || 0) * 100).toFixed(0)} onChange={(v) => S(["trainingDebt", "maxAhtPenalty"], v / 100)} />
          <NumField label="Max attrition" unit="×" value={debt.maxAttritionMult} step="0.1" onChange={(v) => S(["trainingDebt", "maxAttritionMult"], v)} />
        </div>
      </Sec>

      <Sec title="Knock-on defaults" testid="settings-sec-knockon"
        hint="Repeat and spill shares a queue inherits unless it overrides them. Voice repeat defaults to the legacy redial; digital spill to the legacy deflection.">
        {["voice", "digital", "support"].map((ch) => (
          <div className="fieldrow" key={ch}>
            <div style={{ minWidth: 70, alignSelf: "flex-end", fontSize: 12, fontWeight: 600, paddingBottom: 8, textTransform: "capitalize" }}>{ch}</div>
            <NumField label="Repeat" unit="%" value={(kn[ch] || {}).repeatPct == null ? "" : +(((kn[ch] || {}).repeatPct) * 100).toFixed(0)} onChange={(v) => S(["knockOn", ch, "repeatPct"], v === 0 ? 0 : v / 100)} />
            <NumField label="Spill" unit="%" value={(kn[ch] || {}).spillPct == null ? "" : +(((kn[ch] || {}).spillPct) * 100).toFixed(0)} onChange={(v) => S(["knockOn", ch, "spillPct"], v === 0 ? 0 : v / 100)} />
          </div>
        ))}
        <p className="note" style={{ marginTop: 8 }}>Blank = inherit the legacy loop (voice redial {Math.round(loops.redial * 100)}%, digital deflection {Math.round(loops.deflection * 100)}%).</p>
      </Sec>

      <Sec title="CX economics" sub="hiring · costs · customer experience" testid="settings-sec-cx">
        <div className="fieldrow">
          <NumField label="Default buffer" unit="%" value={+(hir.buffer * 100).toFixed(0)} onChange={(v) => P(["hiring", "buffer"], v / 100)} hint="Fallback buffer for buffer strategies that don't set their own. Hiring caps live in the Hiring caps section above." />
          <NumField label="Manager cost" unit="/mo" value={costs.managerCostMonthly != null ? costs.managerCostMonthly : (costs.managerCost != null ? costs.managerCost / 12 : 0)} onChange={(v) => { P(["costs", "managerCostMonthly"], v); P(["costs", "managerCost"], v * 12); }} hint="Monthly manager cost. The engine works weekly (× 12 ÷ 52); outputs report monthly and annual." />
          <NumField label="Manager ratio" unit="1:n" value={costs.managerRatio} onChange={(v) => P(["costs", "managerRatio"], v)} />
        </div>
        <div className="fieldrow">
          <NumField label="£ / lost customer" value={cx.costPerLostCustomer} onChange={(v) => P(["cx", "costPerLostCustomer"], v)} />
          <NumField label="Repeat uplift" unit="×" value={cx.repeatUplift} step="0.1" onChange={(v) => P(["cx", "repeatUplift"], v)} />
          <NumField label="Redial rate" unit="%" value={+(loops.redial * 100).toFixed(0)} onChange={(v) => P(["loops", "redial"], v / 100)} />
          <NumField label="Deflection rate" unit="%" value={+(loops.deflection * 100).toFixed(0)} onChange={(v) => P(["loops", "deflection"], v / 100)} />
        </div>
      </Sec>

      <Sec title="Risk parameters" testid="settings-sec-risk"
        hint="Amber and red bands per risk family. The Summary risk register re-scores from these instantly — changing a band does not re-run the simulation.">
        <div className="grid cols-2" style={{ gap: 10 }}>
          {band("slaBreachRun", "SLA breach run (wk)", "risk-slabreach")}
          {band("burnout", "Burnout peak (/100)", "risk-burnout")}
          {band("trainingDebt", "Training-debt peak", "risk-debt")}
          {band("otStreakWeeks", "Overtime streak (wk)", "risk-otstreak")}
          {band("tippingMargin", "Tipping margin (/wk)", "risk-tipping")}
          {band("knockOnShare", "Knock-on share", "risk-knockon")}
        </div>
        <hr className="sep" style={{ margin: "12px 0" }} />
        <div className="grid cols-2" style={{ gap: 10 }}>
          <div className="rowflex" style={{ gap: 8 }}>
            <span style={{ minWidth: 150, fontSize: 12, fontWeight: 600 }}>Borrowed-capacity share</span>
            <div style={{ width: 96 }}><NumField label="Amber" unit="%" value={+(((risk.borrowedShare || {}).amber || 0) * 100).toFixed(0)} onChange={(v) => S(["risk", "borrowedShare", "amber"], v / 100)} id="risk-borrowed-amber" /></div>
            <div style={{ width: 96 }}><NumField label="Red" unit="%" value={+(((risk.borrowedShare || {}).red || 0) * 100).toFixed(0)} onChange={(v) => S(["risk", "borrowedShare", "red"], v / 100)} id="risk-borrowed-red" /></div>
          </div>
          <div className="rowflex" style={{ gap: 8 }}>
            <span style={{ minWidth: 150, fontSize: 12, fontWeight: 600 }}>Unmanned starvation</span>
            <div style={{ width: 110 }}><NumField label="Floor cover" unit="%" value={+(((risk.unmannedStarvation || {}).floorCover || 0) * 100).toFixed(0)} onChange={(v) => S(["risk", "unmannedStarvation", "floorCover"], v / 100)} /></div>
            <div style={{ width: 96 }}><NumField label="≥ weeks" value={(risk.unmannedStarvation || {}).weeks} onChange={(v) => S(["risk", "unmannedStarvation", "weeks"], v)} /></div>
          </div>
        </div>
      </Sec>

      <Sec title="Files & import/export" testid="settings-sec-files">
        <FilesCard sim={sim} strategySims={sims} config={config} activeStrategy={activeStrategy} activeViewId={activeGroupId} onImportConfig={onImportConfig} title="Files" />
      </Sec>
    </div>
  );
}
