import { useState } from "react";
import { NumField, TextField, SelectField, Card, Hint } from "../components/primitives.jsx";
import { PresetLibrary } from "./PresetLibrary.jsx";
import { CHANNEL_PRESET_LIST } from "../config-ops.js";
import { clamp } from "../../engine/engine.js";

const CHANNELS = [{ key: "voice", label: "Voice" }, { key: "digital", label: "Digital" }, { key: "support", label: "Support" }];
const KIND_LABEL = { voice: "Voice · Erlang", digitalCustomer: "Digital Customer · live", digitalWorkflow: "Digital Workflow · backlog", serviceWorkflow: "Service Workflow · support" };

/* §24.5/§7 channel creation. A channel carries a template seeded from a preset —
   Voice (Erlang), Digital Customer (concurrency + minutes SLA), Digital Workflow
   (no concurrency, hours SLA, default 90%/24h) or Service Workflow (support,
   deferrable, days SLA, default 95%/5d). Queues attach to a channel on the Queues
   tab and inherit its template sections. */
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

function ChannelsManager({ config, ops }) {
  const [name, setName] = useState("");
  const [preset, setPreset] = useState("voice");
  return (
    <Card title="Channels" hint="Create a channel from a preset — its template carries the mechanics of that kind (Voice Erlang; Digital Customer concurrency + minutes SLA; Digital Workflow no concurrency + hours SLA; Service Workflow days SLA). Queues attach to a channel on the Queues tab and inherit its sections.">
      <div className="rowflex" style={{ marginBottom: 10 }}>
        <input type="text" className="inp" style={{ maxWidth: 200 }} placeholder="new channel name" value={name} onChange={(e) => setName(e.target.value)} data-testid="channel-name" />
        <div style={{ minWidth: 210 }}>
          <SelectField label="Preset" value={preset} onChange={setPreset} options={CHANNEL_PRESET_LIST} id="channel-preset" />
        </div>
        <button type="button" className="btn sm primary" style={{ alignSelf: "flex-end" }} onClick={() => { ops.addChannel(name.trim() || undefined, preset); setName(""); }} data-testid="add-channel">+ Add channel</button>
      </div>
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
    </Card>
  );
}

/* §24.10 organisation setup — brand creation (name only; a queue's channel and
   digital subtype are chosen per queue on the Queues tab) and the week-1
   calendar date that anchors the volume series and seasonality. */
function OrgSetup({ config, ops }) {
  const cal = (config.settings && config.settings.calendar) || {};
  return (
    <Card title="Organisation & calendar" hint="Create brands here (name only). A queue's channel — Voice, Digital or Support — and, for digital, its Customer/Workflow subtype are chosen per queue on the Queues tab.">
      <div className="rowflex" style={{ marginBottom: 10 }}>
        <label className="field" style={{ maxWidth: 220 }}>
          <span className="lab">Week-1 date <Hint text="The calendar date week 1 of the horizon starts on. Anchors the seasonality wizard and month-granular scenarios to real months. Blank = start from January." /></span>
          <input type="date" value={cal.weekOneDate || ""} onChange={(e) => ops.setWeekOneDate(e.target.value || null)} data-testid="week-one-date" />
        </label>
        <button type="button" className="btn sm primary" onClick={() => ops.addBrand()} data-testid="add-brand" style={{ alignSelf: "flex-end" }}>+ Add brand</button>
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
    </Card>
  );
}

/* §24.3 hiring cap hierarchy — a required cap per brand × channel, optional
   per-brand ceilings and an optional total ceiling. The effective limit is the
   tightest applicable; the allocator trims from the lowest marginal-churn grant
   and names the binding level in the Plan's holistic trace. */
function CapsMatrix({ config, ops }) {
  const caps = config.hiring.caps || { segments: {}, brands: {}, total: config.hiring.cap };
  const brands = config.brands || [];
  const segVal = (bid, ch) => { const v = (caps.segments || {})[bid + "|" + ch]; return v == null ? "" : v; };
  return (
    <Card title="Hiring caps" sub="brand × channel" hint="Requisitions per week allowed in each brand × channel segment (blank = unlimited), plus optional per-brand and total ceilings. When a ceiling binds, scarce hires are trimmed from the lowest marginal-churn grant first.">
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
    </Card>
  );
}

/* Settings — where the globals and pattern libraries live: engine window, OT
   rules, training + debt constants, knock-on channel defaults, hiring cap, costs,
   CX, the editable risk-threshold bands (which re-score the register without
   re-simulating), and the Seasonality and Arrival pattern libraries. The
   libraries are LISTS only — create/edit/delete named patterns here; applying a
   pattern to the system or a queue happens on the Queues tab. Import/export lives
   in the Files card on the Snapshots tab. */
export function SettingsEditor({ config, ops, intradayPresets, setIntradayPresets, seasonalityPresets, setSeasonalityPresets }) {
  const eng = config.engine, hir = config.hiring, costs = config.costs, cx = config.cx, loops = config.loops;
  const set = config.settings || {};
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
    <div className="grid" style={{ gap: 16 }}>
      <OrgSetup config={config} ops={ops} />
      <ChannelsManager config={config} ops={ops} />
      <CapsMatrix config={config} ops={ops} />
      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <Card title="Engine & simulation window">
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
        </Card>

        <Card title="Global starting HC" hint="Queues left blank share this pool, weighted by workload (volume × AHT ÷ concurrency). Explicit per-queue HC wins; unmanned queues are excluded.">
          <label className="field" style={{ maxWidth: 240 }}>
            <span className="lab">Global starting HC</span>
            <input type="number" value={eng.globalStartingHC == null ? "" : eng.globalStartingHC} placeholder="(none — blanks resolve to 0)"
              onChange={(e) => P(["engine", "globalStartingHC"], e.target.value === "" ? null : Number(e.target.value))} data-testid="global-hc" />
          </label>
        </Card>

        <Card title="Overtime rules" hint="Rung 2 of the supply ladder: own overtime, capped per agent per day AND by a weekly ceiling, costed at a premium and feeding the burnout index.">
          <div className="fieldrow">
            <NumField label="Max / agent / day" unit="h" value={ot.maxDailyHours} step="0.5" onChange={(v) => S(["ot", "maxDailyHours"], v)} />
            <NumField label="Weekly ceiling" unit="h" value={ot.weeklyCeiling} onChange={(v) => S(["ot", "weeklyCeiling"], v)} />
            <NumField label="Premium" unit="×" value={ot.premium} step="0.1" onChange={(v) => S(["ot", "premium"], v)} />
            <NumField label="Burnout load" value={ot.burnoutLoad} onChange={(v) => S(["ot", "burnoutLoad"], v)} />
          </div>
        </Card>

        <Card title="Training & debt" hint="Rung 3: training reclaim converts up to the training-shrinkage share back to service, accruing a debt index that lifts AHT and attrition until training is restored.">
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
        </Card>

        <Card title="Knock-on channel defaults" hint="Repeat and spill shares a queue inherits unless it overrides them. Voice repeat defaults to the legacy redial; digital spill to the legacy deflection.">
          {["voice", "digital", "support"].map((ch) => (
            <div className="fieldrow" key={ch}>
              <div style={{ minWidth: 70, alignSelf: "flex-end", fontSize: 12, fontWeight: 600, paddingBottom: 8, textTransform: "capitalize" }}>{ch}</div>
              <NumField label="Repeat" unit="%" value={(kn[ch] || {}).repeatPct == null ? "" : +(((kn[ch] || {}).repeatPct) * 100).toFixed(0)} onChange={(v) => S(["knockOn", ch, "repeatPct"], v === 0 ? 0 : v / 100)} />
              <NumField label="Spill" unit="%" value={(kn[ch] || {}).spillPct == null ? "" : +(((kn[ch] || {}).spillPct) * 100).toFixed(0)} onChange={(v) => S(["knockOn", ch, "spillPct"], v === 0 ? 0 : v / 100)} />
            </div>
          ))}
          <p className="note" style={{ marginTop: 8 }}>Blank = inherit the legacy loop (voice redial {Math.round(loops.redial * 100)}%, digital deflection {Math.round(loops.deflection * 100)}%).</p>
        </Card>

        <Card title="Hiring, costs & CX">
          <div className="fieldrow">
            <NumField label="Default buffer" unit="%" value={+(hir.buffer * 100).toFixed(0)} onChange={(v) => P(["hiring", "buffer"], v / 100)} hint="Fallback buffer for buffer strategies that don't set their own. Hiring caps live in the Hiring caps card below." />
            <NumField label="Manager cost" unit="/mo" value={costs.managerCostMonthly != null ? costs.managerCostMonthly : (costs.managerCost != null ? costs.managerCost / 12 : 0)} onChange={(v) => { P(["costs", "managerCostMonthly"], v); P(["costs", "managerCost"], v * 12); }} hint="Monthly manager cost. The engine works weekly (× 12 ÷ 52); outputs report monthly and annual." />
            <NumField label="Manager ratio" unit="1:n" value={costs.managerRatio} onChange={(v) => P(["costs", "managerRatio"], v)} />
          </div>
          <div className="fieldrow">
            <NumField label="£ / lost customer" value={cx.costPerLostCustomer} onChange={(v) => P(["cx", "costPerLostCustomer"], v)} />
            <NumField label="Repeat uplift" unit="×" value={cx.repeatUplift} step="0.1" onChange={(v) => P(["cx", "repeatUplift"], v)} />
            <NumField label="Redial rate" unit="%" value={+(loops.redial * 100).toFixed(0)} onChange={(v) => P(["loops", "redial"], v / 100)} />
            <NumField label="Deflection rate" unit="%" value={+(loops.deflection * 100).toFixed(0)} onChange={(v) => P(["loops", "deflection"], v / 100)} />
          </div>
        </Card>
      </div>

      <Card title="Risk parameters" hint="Amber and red bands per risk family. The Summary risk register re-scores from these instantly — changing a band does not re-run the simulation.">
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
      </Card>

      <Card title="Seasonality patterns" sub="library" hint="Named monthly-multiplier patterns. Create, edit and delete them here; apply a pattern to the system or a queue on the Queues tab.">
        <PresetLibrary kind="seasonality" presets={seasonalityPresets} setPresets={setSeasonalityPresets} eng={config.engine} />
      </Card>

      <Card title="Arrival patterns" sub="library" hint="Named intraday arrival curves. Create, edit and delete them here; apply a pattern to a queue on the Queues tab.">
        <PresetLibrary kind="arrival" presets={intradayPresets} setPresets={setIntradayPresets} eng={config.engine} />
      </Card>
    </div>
  );
}
