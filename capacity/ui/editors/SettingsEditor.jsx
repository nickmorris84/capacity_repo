import { NumField, TextField, Card } from "../components/primitives.jsx";
import { FilesCard } from "../components/FilesCard.jsx";

/* Settings (§14, renamed from Money & engine). Engine, hiring cap/buffer, costs,
   CX economics, endogenous loops, the global starting-HC field (§14.4), the full
   Excel package (§14.8), and the model notes (E1–E3) folded in from the removed
   Notes tab so the ten-tab order stays exact. Service teams now live on Queues. */
export function SettingsEditor({ config, ops, sim, sims, activeStrategy, activeViewId, onImportConfig }) {
  const eng = config.engine, hir = config.hiring, costs = config.costs, cx = config.cx, loops = config.loops;
  const P = (path, v) => ops.patch(path, v);
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <Card title="Engine">
          <div className="fieldrow">
            <NumField label="Horizon" unit="wk" value={eng.horizonWeeks} min={1} onChange={(v) => P(["engine", "horizonWeeks"], Math.max(1, Math.round(v)))} />
            <NumField label="Occupancy ceiling" unit="%" value={+(eng.occupancyCeiling * 100).toFixed(0)} onChange={(v) => P(["engine", "occupancyCeiling"], v / 100)} hint="Maximum sustainable utilisation before requirement is inflated." />
            <TextField label="Currency" value={eng.currency} onChange={(v) => P(["engine", "currency"], v || "£")} />
          </div>
          <div className="fieldrow">
            <NumField label="Day start" unit="h" value={eng.dayStart} onChange={(v) => P(["engine", "dayStart"], v)} />
            <NumField label="Day end" unit="h" value={eng.dayEnd} onChange={(v) => P(["engine", "dayEnd"], v)} />
            <NumField label="Interval" unit="min" value={eng.intervalMin} onChange={(v) => P(["engine", "intervalMin"], v)} />
          </div>
          <div className="fieldrow">
            <NumField label="Days / week" value={eng.daysPerWeek} onChange={(v) => P(["engine", "daysPerWeek"], v)} />
            <NumField label="FTE hrs / day" value={eng.hoursPerFteDay} onChange={(v) => P(["engine", "hoursPerFteDay"], v)} />
            <NumField label="FTE days" value={eng.daysWorkedPerFte} onChange={(v) => P(["engine", "daysWorkedPerFte"], v)} />
            <NumField label="Support prof." unit="%" value={+(eng.crossSkillProficiency * 100).toFixed(0)} onChange={(v) => P(["engine", "crossSkillProficiency"], v / 100)} hint="Proficiency of a supporter working a supported queue's contacts." />
          </div>
        </Card>

        <Card title="Global starting HC (§14.4)" hint="Queues left blank in the Workforce section share this pool, weighted by workload (volume × AHT ÷ concurrency). Explicit per-queue HC always wins; supported queues are excluded.">
          <div className="fieldrow">
            <label className="field">
              <span className="lab">Global starting HC</span>
              <input type="number" value={eng.globalStartingHC == null ? "" : eng.globalStartingHC} placeholder="(none — blanks resolve to 0)"
                onChange={(e) => P(["engine", "globalStartingHC"], e.target.value === "" ? null : Number(e.target.value))} data-testid="global-hc" />
            </label>
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            Set a headcount to distribute across queues with a blank starting HC. Each blank queue receives a share proportional to its workload (volume × AHT ÷ concurrency). Leave blank to require every queue to declare its own HC.
          </p>
        </Card>

        <Card title="Hiring & cap">
          <div className="fieldrow">
            <NumField label="Global cap" unit="/wk" value={hir.cap} onChange={(v) => P(["hiring", "cap"], v)} hint="Max total requisitions per week across all queues." />
            <NumField label="Default buffer" unit="%" value={+(hir.buffer * 100).toFixed(0)} onChange={(v) => P(["hiring", "buffer"], v / 100)} hint="Buffer-type strategies without their own bufferPct use this." />
          </div>
          <p className="note" style={{ marginTop: 10 }}>Strategies (incl. schedules) are built on the <strong>Strategies</strong> tab; pick the active plan in the context bar.</p>
        </Card>

        <Card title="Costs">
          <div className="fieldrow">
            <NumField label="Manager cost" unit="/yr" value={costs.managerCost} onChange={(v) => P(["costs", "managerCost"], v)} />
            <NumField label="Manager ratio" unit="1:n" value={costs.managerRatio} onChange={(v) => P(["costs", "managerRatio"], v)} />
          </div>
          <p className="note" style={{ marginTop: 10 }}>Per-agent fully-loaded cost is set per queue in Queues.</p>
        </Card>

        <Card title="CX economics" hint="How poor experience converts to churn and lost revenue.">
          <div className="fieldrow">
            <NumField label="Customer base" value={cx.customerBase} onChange={(v) => P(["cx", "customerBase"], v)} />
            <NumField label="£ per lost customer" value={cx.costPerLostCustomer} onChange={(v) => P(["cx", "costPerLostCustomer"], v)} />
            <NumField label="Repeat uplift" unit="×" value={cx.repeatUplift} step="0.1" onChange={(v) => P(["cx", "repeatUplift"], v)} />
          </div>
          <div className="fieldrow">
            <NumField label="Churn — abandon" unit="%" value={+(cx.churnAbandon * 100).toFixed(1)} onChange={(v) => P(["cx", "churnAbandon"], v / 100)} />
            <NumField label="Churn — long wait" unit="%" value={+(cx.churnWait * 100).toFixed(1)} onChange={(v) => P(["cx", "churnWait"], v / 100)} />
            <NumField label="Churn — digital breach" unit="%" value={+(cx.churnDigital * 100).toFixed(1)} onChange={(v) => P(["cx", "churnDigital"], v / 100)} />
          </div>
        </Card>

        <Card title="Endogenous loops">
          <div className="fieldrow">
            <NumField label="Redial rate" unit="%" value={+(loops.redial * 100).toFixed(0)} onChange={(v) => P(["loops", "redial"], v / 100)} hint="Share of abandoned callers who call back — fixed point, capped at 4× base." />
            <NumField label="Deflection rate" unit="%" value={+(loops.deflection * 100).toFixed(0)} onChange={(v) => P(["loops", "deflection"], v / 100)} hint="Share of over-limit digital backlog that becomes next-day voice volume." />
          </div>
        </Card>
      </div>

      <FilesCard sim={sim} strategySims={sims} config={config} activeStrategy={activeStrategy} activeViewId={activeViewId} onImportConfig={onImportConfig} title="Excel package & files (§14.8)" />

      <ModelNotes />
    </div>
  );
}

// E1–E3 model notes (§13), folded into Settings since the tab list is exact.
function ModelNotes() {
  return (
    <Card title="Model notes" sub="how the engine works, in plain language">
      <h4 style={{ margin: "0 0 6px" }}>E1 — Callers abandon (Erlang A, not Erlang C)</h4>
      <p style={{ marginTop: 0 }}>Classic Erlang C assumes callers wait forever, so its predicted waits explode as a queue gets busy. We use Erlang A: some callers abandon, which lightens the load on the agents who remain. The engine solves this self-consistently so the speed-of-answer stays realistic and bounded by caller patience — matching textbook Erlang C when patience is effectively infinite, and simple flow conservation in deep overload.</p>
      <h4 style={{ margin: "16px 0 6px" }}>E2 — Staff follow the requirement curve, not the demand curve</h4>
      <p style={{ marginTop: 0 }}>Busy intervals need proportionally fewer agents per call than quiet ones. So the engine computes the agents required in each interval and lays available hours along that shape; coverage becomes one honest number (100% = SLA met everywhere). It's a best-case rostering assumption, stated as such.</p>
      <h4 style={{ margin: "16px 0 6px" }}>E3 — Digital is a fluid backlog, not a phone queue</h4>
      <p style={{ marginTop: 0 }}>Chat and messaging wait in a backlog that agents handle several at once. The engine models it as a fluid that fills and drains, with the in-SLA share derived from the linear wait ramp within each interval; backlog carries across intervals, days and weeks. Over-limit backlog deflects into next-day voice volume.</p>
    </Card>
  );
}
