import { NumField, SelectField, Card } from "../components/primitives.jsx";
import { PresetBar } from "./PresetBar.jsx";
import { makeSeasonalityPreset } from "../presets.js";
import { MONTHS } from "../format.js";

function MonthSliders({ months, onChange }) {
  return (
    <div className="fieldrow">
      {MONTHS.map((m, i) => (
        <div key={m} style={{ width: 88 }}>
          <NumField label={m} value={+(months[i] * 100).toFixed(0)} unit="%" onChange={(v) => {
            const next = months.slice();
            next[i] = v / 100;
            onChange(next);
          }} />
        </div>
      ))}
    </div>
  );
}

/* Seasonality editor (SPEC §2, §1 preset mechanic). System-level pattern always
   applies; each queue can layer its own on top (multiplicative stacking). */
export function SeasonalityEditor({ config, ops, seasonalityPresets, setSeasonalityPresets }) {
  const seas = config.seasonality;
  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title="System-level seasonality" sub="applies to every queue" hint="Multiplier by calendar month, applied from the editable start month across the horizon.">
        <div className="fieldrow" style={{ maxWidth: 320, marginBottom: 12 }}>
          <SelectField
            label="Start month"
            value={String(seas.startMonth)}
            onChange={(v) => ops.patch(["seasonality", "startMonth"], Number(v))}
            options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
          />
        </div>
        <PresetBar
          presets={seasonalityPresets}
          applyLabel="Seasonality preset"
          onApply={(p) => ops.patch(["seasonality", "system"], [...p.months])}
          onSaveAs={(name) => setSeasonalityPresets((lib) => [...lib, makeSeasonalityPreset(name, seas.system)])}
        />
        <hr className="sep" style={{ margin: "12px 0" }} />
        <MonthSliders months={seas.system} onChange={(next) => ops.patch(["seasonality", "system"], next)} />
      </Card>

      <div className="rows">
        {config.queues.map((q) => {
          const hasOwn = Array.isArray(q.seasonal);
          return (
            <details className="erow" key={q.id}>
              <summary>
                <span className="chev">▶</span>
                <strong>{q.name}</strong>
                <span className="pill">{hasOwn ? "queue overlay active" : "flat (system only)"}</span>
              </summary>
              <div className="erow-b">
                <div className="rowflex">
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => ops.patchQueue(q.id, ["seasonal"], hasOwn ? null : new Array(12).fill(1))}
                  >{hasOwn ? "Remove queue overlay" : "Add queue overlay"}</button>
                  <span className="note" style={{ padding: "6px 10px" }}>Queue overlay multiplies on top of the system pattern above.</span>
                </div>
                {hasOwn && (
                  <>
                    <PresetBar
                      presets={seasonalityPresets}
                      applyLabel="Apply preset to overlay"
                      onApply={(p) => ops.patchQueue(q.id, ["seasonal"], [...p.months])}
                      onSaveAs={(name) => setSeasonalityPresets((lib) => [...lib, makeSeasonalityPreset(name, q.seasonal)])}
                    />
                    <MonthSliders months={q.seasonal} onChange={(next) => ops.patchQueue(q.id, ["seasonal"], next)} />
                  </>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
