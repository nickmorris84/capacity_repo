import { NumField, Card, Hint } from "../components/primitives.jsx";

/* Workforce editor (SPEC §4): hiring pipeline, attrition, burnout, learning
   curve — plus the per-queue manual hires table that is strategy S4's input. */
export function WorkforceEditor({ config, ops }) {
  return (
    <div className="grid" style={{ gap: 14 }}>
      <p className="note">Manual hires below feed strategy <strong>S4 (Manual plan)</strong>. Select S4 as the active strategy in Money &amp; engine to drive the dashboard from them.</p>
      <div className="rows">
        {config.queues.map((q, qi) => {
          const wf = q.wf, burn = q.burn;
          return (
            <details className="erow" key={q.id} open={qi === 0}>
              <summary>
                <span className="chev">▶</span>
                <strong>{q.name}</strong>
                <span className="pill">{q.type}</span>
                <span className="spacer" />
                <span className="pill">{(wf.hires || []).length} manual hire row(s)</span>
              </summary>
              <div className="erow-b">
                <div className="fieldrow">
                  <NumField label="Attrition" unit="%/mo" value={+(wf.attrition * 100).toFixed(2)} onChange={(v) => ops.patchQueue(q.id, ["wf", "attrition"], v / 100)} />
                  <NumField label="Attrition growth" unit="×/mo" value={wf.attritionGrowth} step="0.01" onChange={(v) => ops.patchQueue(q.id, ["wf", "attritionGrowth"], v)} hint="Compounding drift in the monthly attrition rate over the horizon." />
                  <NumField label="Req-to-start" unit="wk" value={wf.reqToStart} onChange={(v) => ops.patchQueue(q.id, ["wf", "reqToStart"], v)} hint="Weeks from raising a requisition to a new hire starting." />
                  <NumField label="Training" unit="wk" value={wf.trainingWeeks} onChange={(v) => ops.patchQueue(q.id, ["wf", "trainingWeeks"], v)} hint="Trainees cost full salary and deliver zero productivity." />
                </div>

                <div>
                  <div className="lab" style={{ marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }}>
                    Learning curve <Hint text="Productive share of a fully-ramped agent, one entry per week after training. Ramping agents deliver their curve share." />
                  </div>
                  <div className="rowflex">
                    {wf.learningCurve.map((c, ci) => (
                      <div key={ci} style={{ width: 92 }}>
                        <NumField label={"wk " + (ci + 1)} unit="%" value={+(c * 100).toFixed(0)} onChange={(v) => {
                          const next = wf.learningCurve.slice();
                          next[ci] = v / 100;
                          ops.patchQueue(q.id, ["wf", "learningCurve"], next);
                        }} />
                      </div>
                    ))}
                    <div className="btnbar">
                      <button type="button" className="btn sm" onClick={() => ops.patchQueue(q.id, ["wf", "learningCurve"], [...wf.learningCurve, 1])}>+ stage</button>
                      <button type="button" className="btn sm" disabled={wf.learningCurve.length <= 1} onClick={() => ops.patchQueue(q.id, ["wf", "learningCurve"], wf.learningCurve.slice(0, -1))}>− stage</button>
                    </div>
                  </div>
                </div>

                <Card title="Burnout" hint="Accumulates while occupancy exceeds the threshold; multiplies attrition and adds absence shrinkage.">
                  <div className="fieldrow">
                    <NumField label="Occ. threshold" unit="%" value={+(burn.occThreshold * 100).toFixed(0)} onChange={(v) => ops.patchQueue(q.id, ["burn", "occThreshold"], v / 100)} />
                    <NumField label="Sensitivity" value={burn.sensitivity} step="0.1" onChange={(v) => ops.patchQueue(q.id, ["burn", "sensitivity"], v)} />
                    <NumField label="Recovery" unit="/wk" value={burn.recovery} onChange={(v) => ops.patchQueue(q.id, ["burn", "recovery"], v)} />
                    <NumField label="Max attrition ×" value={burn.maxAttritionMult} step="0.1" onChange={(v) => ops.patchQueue(q.id, ["burn", "maxAttritionMult"], v)} />
                    <NumField label="Absence uplift" unit="%" value={+(burn.absenceUplift * 100).toFixed(0)} onChange={(v) => ops.patchQueue(q.id, ["burn", "absenceUplift"], v / 100)} />
                  </div>
                </Card>

                <Card
                  title="Manual hires (S4)"
                  hint="Per-queue requisitions by week. Strategy S4 uses these exactly as entered and ignores the global cap."
                  right={<button type="button" className="btn sm primary" onClick={() => ops.addHire(q.id)}>+ Add hire</button>}
                >
                  {(wf.hires || []).length === 0 ? (
                    <div className="empty">No manual hires yet.</div>
                  ) : (
                    <div className="rows">
                      {wf.hires.map((h, hi) => (
                        <div className="rowflex" key={hi}>
                          <div style={{ width: 130 }}>
                            <NumField label="Week" value={h.week + 1} min={1} onChange={(v) => ops.patchHire(q.id, hi, "week", Math.max(0, v - 1))} />
                          </div>
                          <div style={{ width: 130 }}>
                            <NumField label="Heads" value={h.heads} onChange={(v) => ops.patchHire(q.id, hi, "heads", v)} />
                          </div>
                          <button type="button" className="btn sm danger" style={{ alignSelf: "flex-end" }} onClick={() => ops.deleteHire(q.id, hi)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
