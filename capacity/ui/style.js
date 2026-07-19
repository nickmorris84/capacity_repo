/* Single self-contained stylesheet, exported as a string so it can be injected
   into a <style> tag both in the browser and in the P5 standalone build.
   Design intent: an instrument panel for capacity planners — dense, calm,
   distinctly not a bootstrap template. Ink base, a cyan signal accent, RAG kept
   for status only. Fully responsive to phone width; visible focus rings. */
export const CSS = `
:root {
  --ink: #0f1720; --ink-2: #17222e; --panel: #ffffff; --panel-2: #f5f7f9;
  --line: #e2e7ec; --line-2: #cdd6de; --text: #1b2733; --muted: #5c6b7a;
  --accent: #0e7c86; --accent-2: #12a3b0; --accent-ink: #063e44;
  --green: #1f9d55; --amber: #d98a0b; --red: #d63b3b;
  --green-s: #e6f4ec; --amber-s: #fbf0dc; --red-s: #f9e3e3;
  --shadow: 0 1px 2px rgba(15,23,32,.06), 0 4px 16px rgba(15,23,32,.05);
  --radius: 12px; --radius-s: 8px;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: var(--sans); color: var(--text); background: var(--panel-2); -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.45; }
.app { min-height: 100vh; display: flex; flex-direction: column; }

/* ---- top bar ---- */
.topbar { display: flex; align-items: center; gap: 14px; padding: 10px 18px; background: var(--ink); color: #eaf2f4; position: sticky; top: 0; z-index: 30; }
.brand { display: flex; align-items: baseline; gap: 9px; font-weight: 700; letter-spacing: .2px; }
.brand .mark { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; background: linear-gradient(135deg, var(--accent-2), var(--accent)); color: #fff; font-size: 15px; font-weight: 800; box-shadow: inset 0 0 0 1px rgba(255,255,255,.15); }
.brand small { color: #90a4b0; font-weight: 500; letter-spacing: .3px; }
.topbar .spacer { flex: 1; }
.topctrls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.topctrl { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #90a4b0; }
.topctrl > span { font-weight: 600; letter-spacing: .2px; }
.topctrl select { font: inherit; font-size: 12px; font-weight: 600; padding: 5px 8px; border-radius: 7px; border: 1px solid rgba(255,255,255,.14); background: #0b131b; color: #eaf2f4; }
.topctrl select:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.recalc { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: #bfe9ee; background: rgba(18,163,176,.16); padding: 5px 11px; border-radius: 999px; }
.recalc .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-2); animation: pulse 1s ease-in-out infinite; }
.recalc.idle { color: #7f93a0; background: rgba(255,255,255,.05); }
.recalc.idle .dot { background: #4a5a67; animation: none; }
@keyframes pulse { 0%,100% { opacity: .35; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.15); } }

/* ---- context bar (§14.8) ---- */
.ctxbar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 8px 18px; background: var(--ink-2); color: #d6e3ea; border-bottom: 1px solid rgba(255,255,255,.06); position: sticky; top: 85px; z-index: 24; }
.ctx-item { display: flex; align-items: center; gap: 7px; position: relative; }
.ctx-label { font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #7f93a0; font-weight: 700; }
.ctx-chip { appearance: none; border: 1px solid rgba(255,255,255,.14); background: #0b131b; color: #eaf2f4; border-radius: 8px; padding: 5px 10px; font: inherit; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; white-space: nowrap; max-width: 340px; }
.ctx-chip strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ctx-strat { position: relative; }
.ctx-chip:hover { border-color: var(--accent-2); }
.ctx-chip:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.ctx-chip .ctx-sub { font-size: 11px; color: #9db6c2; font-weight: 500; }
.ctx-select { font: inherit; font-size: 13px; font-weight: 600; padding: 5px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,.14); background: #0b131b; color: #eaf2f4; }
.ctx-select:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.ctx-snapshot { font-size: 13px; font-weight: 600; color: #bfe9ee; }
.ctx-pop { top: 40px; left: 0; transform: none; width: 320px; max-width: 88vw; text-align: left; }
.ctx-pop .field .lab { color: #c9d6de; }
.ctx-pop select, .ctx-pop input { background: #0b131b; color: #eaf2f4; border-color: rgba(255,255,255,.16); }
@media (max-width: 760px) { .ctxbar { position: static; } }

/* ---- tabs ---- */
.tabs { display: flex; gap: 2px; overflow-x: auto; background: var(--ink-2); padding: 0 8px; position: sticky; top: 46px; z-index: 25; scrollbar-width: thin; }
.tab { appearance: none; border: 0; background: transparent; color: #9db0bd; font: inherit; font-weight: 600; font-size: 13px; padding: 11px 15px; cursor: pointer; white-space: nowrap; border-bottom: 3px solid transparent; }
.tab:hover { color: #d6e3ea; }
.tab[aria-selected="true"] { color: #fff; border-bottom-color: var(--accent-2); }
.tab:focus-visible { outline: 2px solid var(--accent-2); outline-offset: -2px; border-radius: 4px; }

/* ---- layout ---- */
/* Rule 9: the document itself never scrolls horizontally. Sticky chrome (topbar,
   tabs, context bar) are siblings of .main, so clipping overflow here is safe and
   never disables their stickiness. Intrinsically-wide content still scrolls
   internally inside its own width-capped .tbl-wrap / .ribbon-wrap / .chart. */
.main { flex: 1; padding: 18px; max-width: 1360px; width: 100%; margin: 0 auto; overflow-x: clip; }
.grid { display: grid; gap: 16px; min-width: 0; }
.grid > * { min-width: 0; }
.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 900px) { .cols-2, .cols-3 { grid-template-columns: 1fr; } }

/* ---- card ---- */
.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); max-width: 100%; min-width: 0; }
.card > .card-h { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--line); }
.card > .card-h h3, .card > .card-h h4 { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: .2px; }
.card > .card-h .sub { color: var(--muted); font-size: 12px; font-weight: 500; }
.card > .card-b { padding: 14px; }
.section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin: 4px 2px 10px; }

/* ---- findings strip ---- */
.findings { display: flex; gap: 10px; overflow-x: auto; padding: 2px; scrollbar-width: thin; }
.finding { flex: 0 0 auto; max-width: 340px; display: flex; gap: 9px; align-items: flex-start; padding: 10px 12px; border-radius: var(--radius-s); border: 1px solid var(--line); background: var(--panel); font-size: 12.5px; line-height: 1.4; }
.finding .pip { width: 9px; height: 9px; border-radius: 50%; margin-top: 4px; flex: 0 0 auto; }
.finding.red { background: var(--red-s); border-color: #eec4c4; }
.finding.amber { background: var(--amber-s); border-color: #ecd8ac; }
.finding.green { background: var(--green-s); border-color: #c4e3d0; }
.finding.red .pip { background: var(--red); } .finding.amber .pip { background: var(--amber); } .finding.green .pip { background: var(--green); }

/* ---- RAG ribbon ---- */
.ribbon-wrap { overflow-x: auto; scrollbar-width: thin; max-width: 100%; }
.ribbon { border-collapse: separate; border-spacing: 3px; }
.ribbon th { font-size: 11px; font-weight: 600; color: var(--muted); text-align: right; padding: 2px 6px; white-space: nowrap; position: sticky; left: 0; background: var(--panel); z-index: 2; }
.ribbon thead th { text-align: center; position: static; }
.ribbon .wk { font-size: 10px; color: var(--muted); font-weight: 600; }
.cell { width: 22px; height: 22px; border-radius: 5px; border: 0; padding: 0; cursor: pointer; position: relative; transition: transform .08s ease; }
.cell:hover { transform: scale(1.18); z-index: 3; }
.cell:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
.cell[data-st="green"] { background: var(--green); } .cell[data-st="amber"] { background: var(--amber); } .cell[data-st="red"] { background: var(--red); }
.cell.scrubbed { box-shadow: 0 0 0 2px var(--ink); }
.evmark { position: relative; }
.evmark::after { content: ""; position: absolute; top: -1px; right: -1px; width: 6px; height: 6px; border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 1.5px #fff; }
.ribbon-scrub { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
.scrub-week { font-weight: 700; font-size: 13px; }
.legend { display: flex; gap: 12px; align-items: center; font-size: 11.5px; color: var(--muted); }
.legend .sw { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }

/* ---- intraday week strip (§14, R1) ---- */
.week-strip { display: flex; flex-wrap: wrap; gap: 4px; }
.wk-cell { width: 34px; height: 30px; border-radius: 6px; border: 1px solid var(--line); color: #fff; font-size: 11px; font-weight: 700; cursor: pointer; font-variant-numeric: tabular-nums; }
.wk-cell[data-st="green"] { background: var(--green); } .wk-cell[data-st="amber"] { background: var(--amber); } .wk-cell[data-st="red"] { background: var(--red); }
.wk-cell:hover { filter: brightness(1.08); }
.wk-cell.sel { box-shadow: 0 0 0 2px var(--ink); }
.wk-cell:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }

/* ---- queue status cards ---- */
.qcards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.qcard { border: 1px solid var(--line); border-radius: var(--radius-s); padding: 12px; background: var(--panel); border-left: 4px solid var(--line-2); }
.qcard.green { border-left-color: var(--green); } .qcard.amber { border-left-color: var(--amber); } .qcard.red { border-left-color: var(--red); }
.qcard .qn { font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 7px; }
.qcard .qtype { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 1px 7px; }
.qcard .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin-top: 10px; }
.qcard .kpi .l { font-size: 11px; color: var(--muted); }
.qcard .kpi .v { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; padding: 2px 7px; border-radius: 999px; }
.badge.green { background: var(--green-s); color: #10673a; } .badge.amber { background: var(--amber-s); color: #8a5a06; } .badge.red { background: var(--red-s); color: #952727; }

/* ---- charts ---- */
.chart { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; max-width: 100%; min-width: 0; }
.chart-h { display: flex; align-items: center; gap: 8px; padding: 11px 14px 6px; }
.chart-h h4 { margin: 0; font-size: 13px; font-weight: 700; }
.chart-b { padding: 4px 8px 10px; overflow-x: auto; }
.recharts-text { font-size: 11px; fill: var(--muted); }
.recharts-cartesian-axis-tick-value { font-size: 11px; }

/* ---- tables ---- */
.tbl-wrap { overflow-x: auto; scrollbar-width: thin; border: 1px solid var(--line); border-radius: var(--radius-s); max-width: 100%; }
table.data { border-collapse: collapse; width: 100%; font-size: 12px; font-variant-numeric: tabular-nums; }
table.data th, table.data td { padding: 7px 10px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line); }
table.data th:first-child, table.data td:first-child { text-align: left; }
table.data thead th { position: sticky; top: 0; background: var(--panel-2); font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); z-index: 1; }
table.data tbody tr:hover { background: var(--panel-2); }
table.data td.st-green { color: #10673a; } table.data td.st-amber { color: #8a5a06; } table.data td.st-red { color: #952727; font-weight: 700; }
/* Data-tab column-group tints (§14.6) */
table.data.grouped td.grp-demand { background: rgba(14,124,134,.055); }
table.data.grouped td.grp-service { background: rgba(58,123,213,.06); }
table.data.grouped td.grp-people { background: rgba(90,84,201,.055); }
table.data.grouped td.grp-money { background: rgba(217,138,11,.06); }
table.data.grouped thead th.grp-demand { border-bottom: 2px solid var(--accent); }
table.data.grouped thead th.grp-service { border-bottom: 2px solid #3a7bd5; }
table.data.grouped thead th.grp-people { border-bottom: 2px solid #5a54c9; }
table.data.grouped thead th.grp-money { border-bottom: 2px solid var(--amber); }
table.data.grouped tbody tr:hover td { background: var(--panel-2); }
/* hiring summary group rows */
table.data tr.grp td { background: var(--panel-2); border-top: 1px solid var(--line-2); }
table.data tr.grp.total td { background: rgba(14,124,134,.08); font-weight: 700; }

/* ---- form controls ---- */
.field { display: flex; flex-direction: column; gap: 4px; }
.field > .lab { font-size: 11.5px; color: var(--muted); font-weight: 600; display: flex; align-items: center; gap: 6px; }
.field input, .field select, input.inp, select.inp { font: inherit; font-size: 13px; padding: 7px 9px; border: 1px solid var(--line-2); border-radius: var(--radius-s); background: var(--panel); color: var(--text); width: 100%; }
.field input:focus, .field select:focus, input.inp:focus, select.inp:focus, .field input:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 0; border-color: var(--accent-2); }
.field .unit { color: var(--muted); font-size: 11px; }
.fieldrow { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }

/* ---- buttons ---- */
.btn { appearance: none; font: inherit; font-weight: 600; font-size: 13px; padding: 8px 13px; border-radius: var(--radius-s); border: 1px solid var(--line-2); background: var(--panel); color: var(--text); cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
.btn:hover { background: var(--panel-2); }
.btn:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.primary:hover { background: var(--accent-ink); }
.btn.ghost { border-color: transparent; background: transparent; color: var(--accent); }
.btn.danger { color: var(--red); border-color: #e6bcbc; }
.btn.danger:hover { background: var(--red-s); }
.btn.sm { padding: 5px 9px; font-size: 12px; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btnbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

/* ---- toggle / switch ---- */
.switch { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; user-select: none; }
.switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.switch .track { width: 38px; height: 22px; border-radius: 999px; background: var(--line-2); position: relative; transition: background .15s; flex: 0 0 auto; }
.switch .track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform .15s; }
.switch input:checked + .track { background: var(--accent); }
.switch input:checked + .track::after { transform: translateX(16px); }
.switch input:focus-visible + .track { outline: 2px solid var(--accent-2); outline-offset: 2px; }

/* ---- hint (tap to reveal, not hover title) ---- */
.hint { position: relative; display: inline-flex; }
.hint > button { appearance: none; border: 1px solid var(--line-2); background: var(--panel-2); color: var(--muted); width: 16px; height: 16px; border-radius: 50%; font-size: 10px; font-weight: 700; line-height: 1; cursor: pointer; padding: 0; display: inline-grid; place-items: center; }
.hint > button:hover { color: var(--accent); border-color: var(--accent-2); }
.hint > button:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.hint .pop { position: absolute; top: 22px; left: 50%; transform: translateX(-50%); width: max-content; max-width: 260px; background: var(--ink); color: #eef4f6; font-size: 12px; font-weight: 400; line-height: 1.4; padding: 9px 11px; border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,.25); z-index: 40; text-transform: none; letter-spacing: 0; }
.hint .pop::before { content: ""; position: absolute; top: -5px; left: 50%; transform: translateX(-50%); border: 5px solid transparent; border-bottom-color: var(--ink); border-top: 0; }

/* ---- editor list rows ---- */
.rows { display: flex; flex-direction: column; gap: 12px; }
.erow { border: 1px solid var(--line); border-radius: var(--radius-s); background: var(--panel); }
.erow > summary, .erow .erow-h { list-style: none; cursor: pointer; padding: 12px 14px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.erow > summary::-webkit-details-marker { display: none; }
.erow-h .drag { color: var(--muted); }
.erow[open] > summary { border-bottom: 1px solid var(--line); }
.erow .erow-b { padding: 14px; display: flex; flex-direction: column; gap: 14px; }
.chev { transition: transform .12s; color: var(--muted); }
.erow[open] .chev { transform: rotate(90deg); }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--panel-2); border: 1px solid var(--line); color: var(--muted); }

/* ---- intraday sliders ---- */
.sliders { display: grid; grid-template-columns: repeat(auto-fit, minmax(52px, 1fr)); gap: 6px; align-items: end; }
.slider-cell { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.slider-cell input[type=range] { writing-mode: vertical-lr; direction: rtl; width: 20px; height: 90px; accent-color: var(--accent); }
.slider-cell .t { font-size: 9px; color: var(--muted); font-variant-numeric: tabular-nums; }
.slider-cell .val { font-size: 9px; color: var(--text); font-variant-numeric: tabular-nums; }

/* ---- misc ---- */
.stat-row { display: flex; gap: 18px; flex-wrap: wrap; }
.stat { min-width: 110px; }
.stat .l { font-size: 11px; color: var(--muted); }
.stat .v { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -.4px; }
.stat .v small { font-size: 12px; font-weight: 600; color: var(--muted); }
.empty { color: var(--muted); font-size: 13px; padding: 24px; text-align: center; }
.note { font-size: 12px; color: var(--muted); background: var(--panel-2); border: 1px dashed var(--line-2); border-radius: var(--radius-s); padding: 10px 12px; }
.tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: var(--accent); color: #fff; }
.tag.soft { background: rgba(14,124,134,.12); color: var(--accent-ink); }
.rowflex { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.spacer { flex: 1; }
hr.sep { border: 0; border-top: 1px solid var(--line); margin: 4px 0; }

@media (max-width: 760px) {
  .topbar { flex-wrap: wrap; }
  .topctrls { order: 3; width: 100%; }
  .topctrl { flex: 1; }
  .topctrl select { flex: 1; }
}
@media (max-width: 640px) {
  .main { padding: 12px; }
  .topbar { padding: 9px 12px; }
  .brand small { display: none; }
  .qcards { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 420px) { .qcards { grid-template-columns: 1fr; } }

/* ---- report ---- */
.report { display: flex; flex-direction: column; gap: 16px; }
.report-section { break-inside: avoid; }
.report-section h2 { font-size: 20px; }
.report-section h3 { font-size: 15px; margin: 0 0 10px; }
.report-section h4 { font-size: 13px; margin: 16px 0 8px; color: var(--muted); }
.report-chart { overflow-x: auto; margin: 4px 0; }

@media print {
  .topbar, .tabs, .recalc, .btnbar, .hint, .topctrls { display: none !important; }
  body { background: #fff; font-size: 12px; }
  .main { padding: 0; max-width: none; }
  .card, .chart { box-shadow: none; break-inside: avoid; }
  .report-section { break-inside: avoid; page-break-inside: avoid; }
  .report-chart { overflow: visible; }
  /* only the report panel prints; other tab panels are already hidden */
  [role="tabpanel"][hidden] { display: none !important; }
}

/* ---- P7b (Revision 2) additions ---- */
.ro-banner { background: var(--amber-s); color: #8a5a06; border-bottom: 1px solid var(--amber); padding: 8px 20px; font-size: 13px; display: flex; align-items: center; gap: 6px; }
table.data.grouped td.grp-week { background: rgba(120,130,140,.05); }
table.data.grouped td.grp-supply { background: rgba(16,150,110,.06); }
table.data.grouped td.grp-status { background: rgba(120,130,140,.04); }
table.data.grouped thead th.grp-week { border-bottom: 2px solid #7a828a; }
table.data.grouped thead th.grp-supply { border-bottom: 2px solid #10966e; }
table.data.grouped thead th.grp-status { border-bottom: 2px solid #7a828a; }

/* decision matrix (§19) */
table.matrix { border-collapse: separate; border-spacing: 4px; }
table.matrix th { font-size: 11px; color: var(--muted); font-weight: 700; padding: 4px 8px; text-align: center; }
table.matrix th.row-h { text-align: right; white-space: nowrap; }
.mx-cell { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; min-width: 116px; cursor: pointer; background: var(--panel); text-align: center; font-variant-numeric: tabular-nums; }
.mx-cell:hover { filter: brightness(0.98); box-shadow: 0 0 0 1px var(--line-2); }
.mx-cell.green { background: var(--green-s); } .mx-cell.amber { background: var(--amber-s); } .mx-cell.red { background: var(--red-s); }
.mx-cell.sel { box-shadow: 0 0 0 2px var(--ink); }
.mx-cell .mx-all { font-weight: 700; font-size: 13px; }
.mx-cell .mx-flags { font-size: 10px; color: var(--muted); margin-top: 2px; }
.mx-stale { background: var(--amber-s); color: #8a5a06; border: 1px solid var(--amber); border-radius: 8px; padding: 8px 12px; font-size: 12px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }

/* §24 holistic hierarchy blocks + filter chips */
.holo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.holo-block { border: 1px solid var(--line); border-radius: var(--radius-s); padding: 10px 12px; background: var(--panel-2); }
.holo-block-h { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.holo-block-h strong { font-size: 12.5px; }
.holo-mini { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.holo-mini .l { font-size: 10px; color: var(--muted); display: block; }
.holo-mini .v { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.chip { appearance: none; font: inherit; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--panel); color: var(--muted); cursor: pointer; }
.chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.chip:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.legend-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted); margin-right: 10px; }

/* §24.9 blank empty state */
.empty-state { text-align: center; padding: 40px 20px; border: 1px dashed var(--line-2); border-radius: var(--radius); background: var(--panel); margin-bottom: 16px; }
.empty-state .es-mark { font-size: 34px; color: var(--accent-2); }
.empty-state h2 { margin: 8px 0 6px; font-size: 20px; }
.empty-state p { color: var(--muted); max-width: 520px; margin: 0 auto 16px; }

/* files card rows */
.files-row { border: 1px solid var(--line); border-radius: var(--radius-s); padding: 12px 14px; background: var(--panel-2); }
.files-row-h { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.files-row-h strong { font-size: 12.5px; }
.files-row-h .note { font-size: 11.5px; }

/* preset library (Settings) rows */
.preset-lib { display: flex; flex-direction: column; gap: 10px; }
.preset-item { border: 1px solid var(--line); border-radius: var(--radius-s); background: var(--panel); padding: 10px 12px; }
.preset-item .preset-item-h { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }

/* inheritance indicator (§16) */
.inherit-ind { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; padding: 2px 7px; border-radius: 999px; }
.inherit-ind.inherited { background: rgba(58,123,213,.12); color: #2b5a9c; }
.inherit-ind.overridden { background: var(--amber-s); color: #8a5a06; }
.acc-sec { border: 1px solid var(--line); border-radius: 10px; margin-bottom: 8px; }
.acc-sec > summary { list-style: none; cursor: pointer; padding: 10px 12px; display: flex; align-items: center; gap: 8px; font-weight: 600; }
.acc-sec > summary::-webkit-details-marker { display: none; }
.acc-sec > .acc-b { padding: 0 12px 12px; }
`;
