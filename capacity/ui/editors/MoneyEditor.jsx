import { NumField, TextField, Card, Hint } from "../components/primitives.jsx";

/* Money & engine editor: engine parameters, hiring strategy + global cap, costs,
   CX economics, endogenous loops, and the service-team pool. */
export function MoneyEditor({ config, ops }) {
  const eng = config.engine, hir = config.hiring, costs = config.costs, cx = config.cx, loops = config.loops;
  const P = (path, v) => ops.patch(path, v);
  return (
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
          <NumField label="Cross-skill prof." unit="%" value={+(eng.crossSkillProficiency * 100).toFixed(0)} onChange={(v) => P(["engine", "crossSkillProficiency"], v / 100)} />
        </div>
      </Card>

      <Card title="Hiring & strategy">
        <div className="fieldrow">
          <NumField label="Global cap" unit="/wk" value={hir.cap} onChange={(v) => P(["hiring", "cap"], v)} hint="Max total requisitions per week across all queues — a shared recruitment/training constraint." />
          <NumField label="Buffer" unit="%" value={+(hir.buffer * 100).toFixed(0)} onChange={(v) => P(["hiring", "buffer"], v / 100)} hint="S2 targets requirement × (1 + buffer)." />
        </div>
        <p className="note" style={{ marginTop: 10 }}>All four strategies run side by side on the <strong>Strategies</strong> tab; pick the active one from the strategy selector in the top bar.</p>
      </Card>

      <Card title="Costs">
        <div className="fieldrow">
          <NumField label="Manager cost" unit="/yr" value={costs.managerCost} onChange={(v) => P(["costs", "managerCost"], v)} />
          <NumField label="Manager ratio" unit="1:n" value={costs.managerRatio} onChange={(v) => P(["costs", "managerRatio"], v)} />
        </div>
        <p className="note" style={{ marginTop: 10 }}>Per-agent fully-loaded cost is set per queue in the Queues editor.</p>
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
          <NumField label="Redial rate" unit="%" value={+(loops.redial * 100).toFixed(0)} onChange={(v) => P(["loops", "redial"], v / 100)} hint="Share of abandoned callers who call back — solved as a fixed point, capped at 4× base." />
          <NumField label="Deflection rate" unit="%" value={+(loops.deflection * 100).toFixed(0)} onChange={(v) => P(["loops", "deflection"], v / 100)} hint="Share of over-limit digital backlog that becomes next-day voice volume." />
        </div>
      </Card>

      <Card
        title="Service teams"
        hint="Shared flex pools allocated worst-deficit-first at day level when a covered queue's occupancy exceeds the trigger."
        right={<button type="button" className="btn sm primary" onClick={ops.addServiceTeam}>+ Add team</button>}
      >
        {config.serviceTeams.length === 0 ? (
          <div className="empty">No service teams.</div>
        ) : (
          <div className="rows">
            {config.serviceTeams.map((t, ti) => (
              <div className="erow" key={t.id}>
                <div className="erow-h">
                  <strong>{t.name}</strong>
                  <span className="spacer" />
                  <button type="button" className="btn sm danger" onClick={() => ops.deleteServiceTeam(t.id)}>Delete</button>
                </div>
                <div className="erow-b">
                  <div className="fieldrow">
                    <TextField label="Name" value={t.name} onChange={(v) => ops.patchServiceTeam(ti, ["name"], v)} />
                    <NumField label="Size" value={t.size} onChange={(v) => ops.patchServiceTeam(ti, ["size"], v)} />
                    <NumField label="Premium" unit="%" value={+(t.premiumPct * 100).toFixed(0)} onChange={(v) => ops.patchServiceTeam(ti, ["premiumPct"], v / 100)} />
                    <NumField label="Proficiency" unit="%" value={+(t.proficiency * 100).toFixed(0)} onChange={(v) => ops.patchServiceTeam(ti, ["proficiency"], v / 100)} />
                  </div>
                  <div className="fieldrow">
                    <NumField label="Trigger occ." unit="%" value={+(t.triggerOccupancy * 100).toFixed(0)} onChange={(v) => ops.patchServiceTeam(ti, ["triggerOccupancy"], v / 100)} />
                    <NumField label="Max hours" unit="/wk" value={t.maxHoursPerWeek} onChange={(v) => ops.patchServiceTeam(ti, ["maxHoursPerWeek"], v)} />
                    <NumField label="Agent cost" unit="/yr" value={t.agentCost} onChange={(v) => ops.patchServiceTeam(ti, ["agentCost"], v)} />
                  </div>
                  <div>
                    <div className="lab" style={{ marginBottom: 6 }}>Covers queues</div>
                    <div className="rowflex">
                      {config.queues.map((q) => (
                        <label key={q.id} className="switch">
                          <input
                            type="checkbox"
                            checked={(t.coversQueues || []).includes(q.id)}
                            onChange={(e) => {
                              const cur = t.coversQueues || [];
                              const next = e.target.checked ? [...cur, q.id] : cur.filter((id) => id !== q.id);
                              ops.patchServiceTeam(ti, ["coversQueues"], next);
                            }}
                          />
                          <span className="track" aria-hidden="true" />
                          <span>{q.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
