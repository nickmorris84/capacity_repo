import { useState, useRef } from "react";
import { Card } from "./primitives.jsx";
import {
  buildWorkbook, parseWorkbook, applyWorkbookImport,
  parametersCSV, volumesCSV, configJSON, parseConfigJSON, runJSON, parseRunJSON,
  parseParametersCSV, applyParameters,
  downloadBytes, downloadText,
} from "../exports.js";

const readArrayBuffer = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(new Uint8Array(r.result));
  r.onerror = rej;
  r.readAsArrayBuffer(file);
});
const readText = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsText(file);
});

/* Files card (SPEC §9): the single home for import/export. One Excel package
   (round-trips Parameters + Volumes), config JSON round-trip, and saved-run
   files, each its own labelled row. Export builders are pure (in exports.js);
   this card only wires them to buttons and file inputs. */
export function FilesCard({ sim, strategySims, config, activeStrategy, activeViewId, onImportConfig, title = "Files" }) {
  const [msg, setMsg] = useState(null);
  const wbInput = useRef(null), cfgInput = useRef(null), runInput = useRef(null), csvInput = useRef(null);
  const say = (text, tone = "ok") => setMsg({ text, tone });

  const onWorkbook = () => {
    const bytes = buildWorkbook(sim, strategySims, config, activeStrategy, activeViewId);
    downloadBytes("capacity-plan.xlsx", bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };

  const importWorkbook = async (file) => {
    try {
      const parsed = parseWorkbook(await readArrayBuffer(file));
      onImportConfig(applyWorkbookImport(config, parsed));
      say(`Imported ${parsed.params.length} parameter(s)${parsed.volumes ? " and volumes" : ""}.`);
    } catch (e) { say("Workbook import failed: " + e.message, "err"); }
  };
  const importConfig = async (file) => {
    try { onImportConfig(parseConfigJSON(await readText(file))); say("Config imported."); }
    catch (e) { say("Config import failed: " + e.message, "err"); }
  };
  const importRun = async (file) => {
    try { const o = parseRunJSON(await readText(file)); onImportConfig(o.config); say("Saved run loaded — its config is now active."); }
    catch (e) { say("Run import failed: " + e.message, "err"); }
  };
  const importParamsCSV = async (file) => {
    try {
      const rows = parseParametersCSV(await readText(file));
      onImportConfig(applyParameters(config, rows));
      say(`Imported ${rows.length} parameter(s) from CSV.`);
    } catch (e) { say("Parameters CSV import failed: " + e.message, "err"); }
  };

  const Section = ({ label, hint, children }) => (
    <div className="files-row">
      <div className="files-row-h">
        <strong>{label}</strong>
        {hint ? <span className="note" style={{ background: "none", border: 0, padding: 0 }}>{hint}</span> : null}
      </div>
      <div className="btnbar">{children}</div>
    </div>
  );

  return (
    <Card title={title} hint="One workbook round-trips Parameters and Volumes; config and saved-run JSON share whole plans; CSVs are plain-text fallbacks.">
      <div className="grid" style={{ gap: 14 }}>
        <Section label="Excel package" hint="One workbook carries every sheet; re-import reads only Parameters and Volumes.">
          <button type="button" className="btn primary" data-testid="export-workbook" onClick={onWorkbook}>Export workbook</button>
          <button type="button" className="btn" onClick={() => wbInput.current && wbInput.current.click()}>Import workbook</button>
          <button type="button" className="btn" data-testid="export-params-csv" onClick={() => downloadText("parameters.csv", parametersCSV(config), "text/csv")}>Parameters CSV</button>
          <button type="button" className="btn" data-testid="export-volumes-csv" onClick={() => downloadText("volumes.csv", volumesCSV(config), "text/csv")}>Volumes CSV</button>
          <button type="button" className="btn" onClick={() => csvInput.current && csvInput.current.click()}>Import parameters CSV</button>
        </Section>

        <Section label="Config JSON" hint="The whole plan as JSON — export to share, import to replace.">
          <button type="button" className="btn" data-testid="export-config" onClick={() => downloadText("capacity-config.json", configJSON(config), "application/json")}>Export config</button>
          <button type="button" className="btn" onClick={() => cfgInput.current && cfgInput.current.click()}>Import config</button>
        </Section>

        <Section label="Run files" hint="A saved run bundles the config with its results; importing one makes that config active.">
          <button type="button" className="btn" data-testid="export-run" onClick={() => downloadText("capacity-run.json", runJSON(sim, config), "application/json")}>Export run</button>
          <button type="button" className="btn" onClick={() => runInput.current && runInput.current.click()}>Import run</button>
        </Section>

        <input ref={wbInput} type="file" accept=".xlsx" data-testid="import-workbook" style={{ display: "none" }} onChange={(e) => e.target.files[0] && importWorkbook(e.target.files[0])} />
        <input ref={cfgInput} type="file" accept=".json" data-testid="import-config" style={{ display: "none" }} onChange={(e) => e.target.files[0] && importConfig(e.target.files[0])} />
        <input ref={runInput} type="file" accept=".json" data-testid="import-run" style={{ display: "none" }} onChange={(e) => e.target.files[0] && importRun(e.target.files[0])} />
        <input ref={csvInput} type="file" accept=".csv" data-testid="import-params-csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && importParamsCSV(e.target.files[0])} />
      </div>

      {msg && <p className="note" style={{ marginTop: 12, color: msg.tone === "err" ? "var(--red)" : undefined }}>{msg.text}</p>}
    </Card>
  );
}
