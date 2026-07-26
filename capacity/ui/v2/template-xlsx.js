/* v2.4 rebuild — SheetJS binding for the template (Step 6). Lazy-loads xlsx
 * (~400 KB — most sessions never import Excel) and wraps the pure serialization
 * in template.js. Four sheets mirror the Setup sections; export is pre-filled
 * with the current model; import returns { model, report }.
 */
import { modelToSheets, sheetsToModel, SHEET_NAMES } from "./template.js";

const sheetKey = (name) => name.slice(0, 31); // Excel truncates sheet names at 31

// model → XLSX bytes (Uint8Array), pre-filled with current values.
export async function exportWorkbook(model) {
  const XLSX = await import("xlsx");
  const sheets = modelToSheets(model);
  const wb = XLSX.utils.book_new();
  for (const name of SHEET_NAMES) {
    const ws = XLSX.utils.json_to_sheet(sheets[name] || [], { skipHeader: false });
    XLSX.utils.book_append_sheet(wb, ws, sheetKey(name));
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

// XLSX bytes → { model, report }, with a round-trip validation flag.
export async function importWorkbook(data) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array" });
  const sheets = {};
  for (const name of SHEET_NAMES) {
    const ws = wb.Sheets[sheetKey(name)] || wb.Sheets[name];
    sheets[name] = ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
  }
  return sheetsToModel(sheets);
}

// Browser download helper (kept out of the pure layer; DOM-only).
export async function downloadTemplate(model, filename = "capacity-template.xlsx") {
  const bytes = await exportWorkbook(model);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
