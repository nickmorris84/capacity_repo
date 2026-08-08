/* Domain redesign — SheetJS binding for template v3 (F1). Lazy-loads xlsx and
 * wraps the pure serialization in model/template-domain.js. Five sheets per
 * DOMAIN-MODEL §10; export pre-filled with the current model; import returns
 * { model } (engineConfig is a carry the caller re-attaches).
 */
import { modelToDomainSheets, domainSheetsToModel, SHEET_NAMES } from "../../model/template-domain.js";

const sheetKey = (name) => name.slice(0, 31);

export async function exportDomainWorkbook(model) {
  const XLSX = await import("xlsx");
  const sheets = modelToDomainSheets(model);
  const wb = XLSX.utils.book_new();
  for (const name of SHEET_NAMES) {
    const ws = XLSX.utils.json_to_sheet(sheets[name] || [], { skipHeader: false });
    XLSX.utils.book_append_sheet(wb, ws, sheetKey(name));
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

export async function importDomainWorkbook(data) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array" });
  const sheets = {};
  for (const name of SHEET_NAMES) {
    const ws = wb.Sheets[sheetKey(name)] || wb.Sheets[name];
    sheets[name] = ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
  }
  return domainSheetsToModel(sheets);
}

export async function downloadDomainTemplate(model, filename = "capacity-model.xlsx") {
  const bytes = await exportDomainWorkbook(model);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
