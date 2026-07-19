import { NumField, TextField, Card, Hint } from "../components/primitives.jsx";
import { FilesCard } from "../components/FilesCard.jsx";
import { SeasonalityEditor } from "./SeasonalityEditor.jsx";
import { clamp } from "../../engine/engine.js";

/* Settings (§16 physics + §20a risk parameters + libraries). Everything that is
   "where the globals live": engine window, OT rules, training + debt constants,
   knock-on channel defaults, hiring cap, costs, CX, the editable risk-threshold
   bands (which re-score the register without re-simulating), seasonality
   (dissolved in from its own tab) and the Excel package. */
export function SettingsEditor({ config, ops, sim, sims, activeStrategy, activeViewId, onImportConfig, seasonalityPresets, setSeasonalityPresets }) {
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
      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <Card title="Engine & simulation window (§16)">
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

        <Card title="Global starting HC (§16)" hint="Queues left blank share this pool, weighted by workload (volume × AHT ÷ concurrency). Explicit per-queue HC wins; unmanned queues are excluded.">
          <label className="field" style={{ maxWidth: 240 }}>
            <span className="lab">Global starting HC</span>
            <input type="number" value={eng.globalStartingHC == null ? "" : eng.globalStartingHC} placeholder="(none — blanks resolve to 0)"
              onChange={(e) => P(["engine", "globalStartingHC"], e.target.value === "" ? null : Number(e.target.value))} data-testid="global-hc" />
          </label>
        </Card>

        <Card title="Overtime rules (§17)" hint="Rung 2 of the supply ladder: own overtime, capped per agent per day AND by a weekly ceiling, costed at a premium and feeding the burnout index.">
          <div className="fieldrow">
            <NumField label="Max / agent / day" unit="h" value={ot.maxDailyHours} step="0.5" onChange={(v) => S(["ot", "maxDailyHours"], v)} />
            <NumField label="Weekly ceiling" unit="h" value={ot.weeklyCeiling} onChange={(v) => S(["ot", "weeklyCeiling"], v)} />
            <NumField label="Premium" unit="×" value={ot.premium} step="0.1" onChange={(v) => S(["ot", "premium"], v)} />
            <NumField label="Burnout load" value={ot.burnoutLoad} onChange={(v) => S(["ot", "burnoutLoad"], v)} />
          </div>
        </Card>

        <Card title="Training & debt (§16/§17)" hint="Rung 3: training reclaim converts up to the training-shrinkage share back to service, accruing a debt index that lifts AHT and attrition until training is restored.">
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

        <Card title="Knock-on channel defaults (§18)" hint="Repeat and spill shares a queue inherits unless it overrides them. Voice repeat defaults to the legacy redial; digital spill to the legacy deflection.">
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
            <NumField label="Global cap" unit="/wk" value={hir.cap} onChange={(v) => P(["hiring", "cap"], v)} />
            <NumField label="Default buffer" unit="%" value={+(hir.buffer * 100).toFixed(0)} onChange={(v) => P(["hiring", "buffer"], v / 100)} />
            <NumField label="Manager cost" unit="/yr" value={costs.managerCost} onChange={(v) => P(["costs", "managerCost"], v)} />
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

      <Card title="Risk parameters (§20a)" hint="Amber and red bands per risk family. The Summary risk register re-scores from these instantly — changing a band does not re-run the simulation.">
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

      <Card title="Seasonality" sub="dissolved in from its own tab" hint="System-level pattern applies to every queue; each queue can layer its own overlay (multiplicative).">
        <SeasonalityEditor config={config} ops={ops} seasonalityPresets={seasonalityPresets} setSeasonalityPresets={setSeasonalityPresets} />
      </Card>

      <FilesCard sim={sim} strategySims={sims} config={config} activeStrategy={activeStrategy} activeViewId={activeViewId} onImportConfig={onImportConfig} title="Excel package & files (§20)" />
    </div>
  );
}
