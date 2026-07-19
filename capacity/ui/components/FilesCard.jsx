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

/* Files card (SPEC §9): one-workbook export + Parameters/Volumes re-import,
   config JSON round-trip, saved-run .json, and CSV fallbacks. Export builders
   are pure (in exports.js); this card only wires them to buttons and file
   inputs. */
export function FilesCard({ sim, strategySims, config, activeStrategy, activeViewId, onImportConfig, title = "Files — export & import" }) {
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

  return (
    <Card title={title} hint="One workbook round-trips Parameters and Volumes; config and saved-run JSON share whole plans; CSVs are plain-text fallbacks.">
      <div className="btnbar">
        <button type="button" className="btn primary" data-testid="export-workbook" onClick={onWorkbook}>Export Excel workbook</button>
        <button type="button" className="btn" data-testid="export-config" onClick={() => downloadText("capacity-config.json", configJSON(config), "application/json")}>Export config JSON</button>
        <button type="button" className="btn" data-testid="export-run" onClick={() => downloadText("capacity-run.json", runJSON(sim, config), "application/json")}>Export saved run</button>
      </div>
      <div className="btnbar" style={{ marginTop: 8 }}>
        <button type="button" className="btn" data-testid="export-params-csv" onClick={() => downloadText("parameters.csv", parametersCSV(config), "text/csv")}>Parameters CSV</button>
        <button type="button" className="btn" data-testid="export-volumes-csv" onClick={() => downloadText("volumes.csv", volumesCSV(config), "text/csv")}>Volumes CSV</button>
      </div>

      <hr className="sep" style={{ margin: "14px 0" }} />

      <div className="btnbar">
        <button type="button" className="btn" onClick={() => wbInput.current && wbInput.current.click()}>Import Excel (Parameters + Volumes)</button>
        <button type="button" className="btn" onClick={() => cfgInput.current && cfgInput.current.click()}>Import config JSON</button>
        <button type="button" className="btn" onClick={() => runInput.current && runInput.current.click()}>Import saved run</button>
        <button type="button" className="btn" onClick={() => csvInput.current && csvInput.current.click()}>Import parameters CSV</button>
        <input ref={wbInput} type="file" accept=".xlsx" data-testid="import-workbook" style={{ display: "none" }} onChange={(e) => e.target.files[0] && importWorkbook(e.target.files[0])} />
        <input ref={cfgInput} type="file" accept=".json" data-testid="import-config" style={{ display: "none" }} onChange={(e) => e.target.files[0] && importConfig(e.target.files[0])} />
        <input ref={runInput} type="file" accept=".json" data-testid="import-run" style={{ display: "none" }} onChange={(e) => e.target.files[0] && importRun(e.target.files[0])} />
        <input ref={csvInput} type="file" accept=".csv" data-testid="import-params-csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && importParamsCSV(e.target.files[0])} />
      </div>

      {msg && <p className="note" style={{ marginTop: 12, color: msg.tone === "err" ? "var(--red)" : undefined }}>{msg.text}</p>}
      <p className="note" style={{ marginTop: 10 }}>Importing a workbook reads only the Parameters and Volumes sheets (output sheets are ignored) and patches your config by path. Config and saved-run JSON replace the whole plan.</p>
    </Card>
  );
}
